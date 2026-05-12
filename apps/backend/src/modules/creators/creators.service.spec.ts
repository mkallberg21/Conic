import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { QUEUE_NAMES } from '../../queue/queue.module';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  creator: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  deliverable: { groupBy: jest.fn() },
  payment: { aggregate: jest.fn() },
  contract: { findMany: jest.fn() },
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delPattern: jest.fn().mockResolvedValue(undefined),
  wrap: jest.fn().mockImplementation((_key: string, fn: () => Promise<unknown>) => fn()),
};

const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job_1' }) };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreatorsService', () => {
  let service: CreatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: getQueueToken(QUEUE_NAMES.CREATOR_SCORING), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<CreatorsService>(CreatorsService);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('returns cached creator when cache hits', async () => {
      const cached = { id: 'cr_1', handle: 'test_creator' };
      mockCache.wrap.mockResolvedValueOnce(cached);

      const result = await service.findById('cr_1');
      expect(result).toEqual(cached);
    });

    it('throws NotFoundException when creator does not exist', async () => {
      mockCache.wrap.mockImplementationOnce((_key: string, fn: () => Promise<unknown>) => fn());
      mockPrisma.creator.findUnique.mockResolvedValue(null);

      await expect(service.findById('cr_missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('discover', () => {
    it('paginates correctly', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: `cr_${i}`, performanceScore: 80 - i }));
      mockPrisma.creator.findMany.mockResolvedValue(items);
      mockPrisma.creator.count.mockResolvedValue(100);

      const result = await service.discover({ page: 2, take: 10 });
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(10);
    });

    it('caps take at 100', async () => {
      mockPrisma.creator.findMany.mockResolvedValue([]);
      mockPrisma.creator.count.mockResolvedValue(0);

      await service.discover({ take: 9999 });
      expect(mockPrisma.creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('scheduleScoring', () => {
    it('enqueues creator scoring job', async () => {
      await service.scheduleScoring('cr_1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'score-creator',
        { creatorId: 'cr_1' },
        expect.any(Object),
      );
    });
  });
});
