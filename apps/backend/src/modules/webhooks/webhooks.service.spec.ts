import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bullmq';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../../queue/queue.module';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  webhookEndpoint: { findMany: jest.fn() },
  webhookDelivery: { create: jest.fn() },
};

const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job_1' }) };

// Capture the listeners registered via eventEmitter.on(event, handler)
type Handler = (payload: Record<string, unknown>) => void;
const registered = new Map<string, Handler>();
const mockEmitter = {
  on: jest.fn((event: string, handler: Handler) => registered.set(event, handler)),
};

const flush = () => new Promise((r) => setImmediate(r));

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEmitter },
        { provide: getQueueToken(QUEUE_NAMES.WEBHOOK_DELIVERY), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
    registered.clear();
  });

  describe('onModuleInit event wiring', () => {
    it('registers a listener for every internal event in the map (incl. NIL events)', () => {
      service.onModuleInit();

      // The old code only wired 6 events; the map has many more.
      expect(mockEmitter.on.mock.calls.length).toBeGreaterThan(6);

      const wired = new Set(mockEmitter.on.mock.calls.map((c) => c[0] as string));
      // NIL events that previously had NO listener and never dispatched:
      expect(wired).toContain('nil.disclosure.submitted');
      expect(wired).toContain('nil.deal.created');
      expect(wired).toContain('appearance.scheduled');
      expect(wired).toContain('guardian.approved');
      expect(wired).toContain('tax.document.submitted');
      // ...and the originally-wired ones still present:
      expect(wired).toContain('contract.created');
      expect(wired).toContain('payment.released');
    });
  });

  describe('internal → webhook name translation', () => {
    it('dispatches the *translated* webhook string (appearance.scheduled → nil.appearance.scheduled)', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);
      service.onModuleInit();

      const handler = registered.get('appearance.scheduled');
      expect(handler).toBeDefined();

      handler!({ appearanceId: 'ap_1' });
      await flush();

      // dispatch() queries endpoints subscribed to the external event name
      expect(mockPrisma.webhookEndpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            events: { has: 'nil.appearance.scheduled' },
          }),
        }),
      );
    });
  });

  describe('dispatch fan-out', () => {
    it('creates a delivery row and enqueues a job for each subscribed active endpoint', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
        { id: 'ep_1', url: 'https://a.example/hook', secret: 's1' },
        { id: 'ep_2', url: 'https://b.example/hook', secret: 's2' },
      ]);
      mockPrisma.webhookDelivery.create
        .mockResolvedValueOnce({ id: 'del_1' })
        .mockResolvedValueOnce({ id: 'del_2' });

      await service.dispatch('contract.created', { contractId: 'c_1' });

      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'deliver',
        expect.objectContaining({ endpointId: 'ep_1', event: 'contract.created' }),
        expect.objectContaining({ jobId: 'webhook-del_1' }),
      );
    });

    it('does nothing when no endpoints are subscribed', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);

      await service.dispatch('nil.deal.created', { dealId: 'd_1' });

      expect(mockPrisma.webhookDelivery.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
});
