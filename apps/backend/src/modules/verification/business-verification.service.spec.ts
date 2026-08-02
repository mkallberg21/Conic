import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { IdentityStatus, KybTier } from '@prisma/client';
import { BusinessVerificationService } from './business-verification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { BusinessVerifier } from './providers/business-verifier';
import { StartKybDto } from './dto/verification.dto';

describe('BusinessVerificationService', () => {
  let service: BusinessVerificationService;

  const mockPrisma = {
    brand: { findUnique: jest.fn(), update: jest.fn() },
    businessVerification: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  };
  const mockVerifier = { name: 'stub', isLive: false, submit: jest.fn(), parseWebhook: jest.fn() };
  const mockAudit = { log: jest.fn() };
  const mockEventBus = { emit: jest.fn() };

  const basicDto: StartKybDto = { legalName: 'Acme Inc', country: 'US', tier: KybTier.BASIC };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessVerificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BusinessVerifier, useValue: mockVerifier },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();
    service = module.get(BusinessVerificationService);
    jest.clearAllMocks();
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'b1', kybTier: KybTier.NONE, kybStatus: 'NOT_STARTED' });
    mockPrisma.businessVerification.upsert.mockResolvedValue({});
    mockPrisma.businessVerification.findUnique.mockResolvedValue(null);
  });

  it('approves a BASIC tier and grants it', async () => {
    mockVerifier.submit.mockResolvedValue({ caseId: 'kyb_1', result: { status: IdentityStatus.APPROVED, matchedName: 'Acme Inc' } });

    await service.start('brand_user', basicDto);

    expect(mockPrisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kybTier: KybTier.BASIC }) }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith('kyb.approved', expect.objectContaining({ brandId: 'b1', tier: KybTier.BASIC }));
  });

  it('refuses ENHANCED tier without youth-safety acceptance', async () => {
    await expect(
      service.start('brand_user', { ...basicDto, tier: KybTier.ENHANCED }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockVerifier.submit).not.toHaveBeenCalled();
  });

  it('never grants a tier on a sanctions hit — forces review', async () => {
    mockVerifier.submit.mockResolvedValue({
      caseId: 'kyb_2',
      result: { status: IdentityStatus.APPROVED, matchedName: 'Acme Inc', sanctionsHit: true },
    });

    await service.start('brand_user', basicDto);

    expect(mockPrisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kybTier: KybTier.NONE, kybStatus: IdentityStatus.REVIEW }) }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith('kyb.flagged', expect.objectContaining({ brandId: 'b1' }));
  });

  it('stays PENDING for a live vendor (async webhook)', async () => {
    mockVerifier.submit.mockResolvedValue({ caseId: 'kyb_3', result: { status: IdentityStatus.PENDING } });

    await service.start('brand_user', basicDto);

    // finalize not reached — no tier grant, no decision event
    expect(mockEventBus.emit).not.toHaveBeenCalledWith('kyb.approved', expect.anything());
  });
});
