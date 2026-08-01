import { Test, TestingModule } from '@nestjs/testing';
import { ContractStatus, UserRole } from '@prisma/client';
import { ContactScannerService } from './contact-scanner.service';
import { AntiCircumventionService } from './anti-circumvention.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

describe('ContactScannerService', () => {
  const scanner = new ContactScannerService();

  it('flags and redacts an email (high severity)', () => {
    const r = scanner.scan('reach me at jane@brand.com please');
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain('email');
    expect(r.severity).toBe('high');
    expect(r.redacted).not.toContain('jane@brand.com');
    expect(r.redacted).toContain('[redacted]');
  });

  it('flags a phone number', () => {
    const r = scanner.scan('call me on +1 (415) 555-0192');
    expect(r.categories).toContain('phone');
    expect(r.severity).toBe('high');
  });

  it('flags an off-platform invite (medium severity, no hard contact)', () => {
    const r = scanner.scan('lets move this to whatsapp');
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain('offplatform_invite');
    expect(r.severity).toBe('medium');
  });

  it('leaves a clean message untouched', () => {
    const r = scanner.scan('Can you deliver two reels by Friday?');
    expect(r.flagged).toBe(false);
    expect(r.redacted).toBe('Can you deliver two reels by Friday?');
    expect(r.severity).toBe('low');
  });
});

describe('AntiCircumventionService', () => {
  let service: AntiCircumventionService;
  const mockPrisma = {
    brand: { findUnique: jest.fn() },
    contract: { findFirst: jest.fn() },
    nilDeal: { findFirst: jest.fn() },
    circumventionFlag: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntiCircumventionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(AntiCircumventionService);
    jest.clearAllMocks();
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand_1' });
  });

  describe('canRevealContact', () => {
    it('allows reveal when an active contract exists with the creator', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue({ id: 'c_1' });
      await expect(service.canRevealContact('brand_user', 'creator', 'cr_1')).resolves.toBe(true);
      expect(mockPrisma.contract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { in: [ContractStatus.ACTIVE, ContractStatus.COMPLETED] } }),
        }),
      );
    });

    it('denies reveal when there is no contract/deal', async () => {
      mockPrisma.contract.findFirst.mockResolvedValue(null);
      await expect(service.canRevealContact('brand_user', 'creator', 'cr_1')).resolves.toBe(false);
    });

    it('allows reveal for an athlete with an active NIL deal', async () => {
      mockPrisma.nilDeal.findFirst.mockResolvedValue({ id: 'd_1' });
      await expect(service.canRevealContact('brand_user', 'athlete', 'ath_1')).resolves.toBe(true);
    });
  });

  describe('recordMessageFlag', () => {
    it('persists a flag and writes an audit event', async () => {
      mockPrisma.circumventionFlag.create.mockResolvedValue({ id: 'f_1' });
      await service.recordMessageFlag({
        dealRoomId: 'room_1', actorUserId: 'u_1', categories: ['email'], severity: 'high', detail: 'x',
      });
      expect(mockPrisma.circumventionFlag.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ kind: 'message_contact', severity: 'high' }) }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CIRCUMVENTION_ATTEMPT' }),
      );
    });
  });

  describe('getReport', () => {
    it('scopes to the brand for a non-admin caller', async () => {
      mockPrisma.circumventionFlag.findMany.mockResolvedValue([]);
      mockPrisma.circumventionFlag.count.mockResolvedValue(0);
      mockPrisma.circumventionFlag.groupBy.mockResolvedValue([]);
      await service.getReport('brand_user', UserRole.BRAND);
      expect(mockPrisma.circumventionFlag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { brandId: 'brand_1' } }),
      );
    });

    it('returns all flags for an admin', async () => {
      mockPrisma.circumventionFlag.findMany.mockResolvedValue([]);
      mockPrisma.circumventionFlag.count.mockResolvedValue(0);
      mockPrisma.circumventionFlag.groupBy.mockResolvedValue([{ severity: 'high', _count: 3 }]);
      const r = await service.getReport('admin', UserRole.ADMIN);
      expect(mockPrisma.circumventionFlag.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(r.bySeverity).toEqual({ high: 3 });
    });
  });
});
