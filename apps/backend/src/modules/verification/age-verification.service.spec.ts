import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgeCheckMethod, IdentityStatus } from '@prisma/client';
import { AgeVerificationService } from './age-verification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { AgeAssuranceProvider } from './providers/age-assurance.provider';

const adultDob = new Date('1996-01-01');
const minorDob = new Date();
minorDob.setFullYear(minorDob.getFullYear() - 15);

describe('AgeVerificationService', () => {
  let service: AgeVerificationService;

  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    ageVerification: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    creator: { findUnique: jest.fn(), update: jest.fn() },
    athlete: { findUnique: jest.fn(), update: jest.fn() },
  };
  const mockProvider = { name: 'stub', isLive: false, start: jest.fn(), parseWebhook: jest.fn() };
  const mockAudit = { log: jest.fn() };
  const mockEventBus = { emit: jest.fn() };
  const mockConfig = { get: jest.fn((_k: string, def?: unknown) => def) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgeVerificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AgeAssuranceProvider, useValue: mockProvider },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AgeVerificationService);
    jest.clearAllMocks();
    mockPrisma.athlete.findUnique.mockResolvedValue(null);
    mockPrisma.ageVerification.create.mockResolvedValue({ id: 'av1', method: AgeCheckMethod.ESTIMATION });
    mockPrisma.ageVerification.findUnique.mockResolvedValue({ id: 'av1', method: AgeCheckMethod.ESTIMATION });
  });

  it('approves an adult and marks isMinor=false', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr1', isMinor: false, dateOfBirth: adultDob });
    mockProvider.start.mockResolvedValue({
      sessionId: 'age_x',
      result: { status: IdentityStatus.APPROVED, isAdult: true, estimatedAge: 29 },
    });

    const res = await service.start('u1', AgeCheckMethod.ESTIMATION);

    expect(res.status).toBe(IdentityStatus.APPROVED);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ ageVerified: true }) }),
    );
    expect(mockPrisma.creator.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isMinor: false }) }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith('age.verified', expect.objectContaining({ userId: 'u1' }));
  });

  it('DOWNGRADES a self-declared adult found to be a minor, and flags it', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr1', isMinor: false, dateOfBirth: adultDob });
    mockProvider.start.mockResolvedValue({
      sessionId: 'age_y',
      result: { status: IdentityStatus.APPROVED, isAdult: false, confirmedDob: minorDob },
    });

    await service.start('u1', AgeCheckMethod.DOCUMENT);

    expect(mockPrisma.creator.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isMinor: true }) }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith('age.minor_downgraded', expect.objectContaining({ userId: 'u1' }));
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MINOR_DOWNGRADED' }));
  });

  it('leaves the check PENDING for a live vendor (no synchronous finalize)', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr1', isMinor: false, dateOfBirth: adultDob });
    mockProvider.start.mockResolvedValue({ sessionId: 'age_z', result: { status: IdentityStatus.PENDING } });

    const res = await service.start('u1', AgeCheckMethod.DOCUMENT);

    expect(res.status).toBe(IdentityStatus.PENDING);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  describe('handleWebhook', () => {
    it('finalizes a DECLINED result and emits age.declined', async () => {
      mockProvider.parseWebhook.mockReturnValue({ sessionId: 'age_x', result: { status: IdentityStatus.DECLINED, reason: 'no match' } });
      mockPrisma.ageVerification.findUnique.mockResolvedValue({ id: 'av1', userId: 'u1', status: IdentityStatus.PENDING, method: AgeCheckMethod.DOCUMENT });

      await service.handleWebhook({}, Buffer.from('{}'));

      expect(mockPrisma.ageVerification.update).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('age.declined', expect.objectContaining({ userId: 'u1' }));
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('is idempotent for an already-finalized record', async () => {
      mockProvider.parseWebhook.mockReturnValue({ sessionId: 'age_x', result: { status: IdentityStatus.APPROVED } });
      mockPrisma.ageVerification.findUnique.mockResolvedValue({ id: 'av1', userId: 'u1', status: IdentityStatus.APPROVED });

      await service.handleWebhook({}, Buffer.from('{}'));

      expect(mockPrisma.ageVerification.update).not.toHaveBeenCalled();
    });
  });
});
