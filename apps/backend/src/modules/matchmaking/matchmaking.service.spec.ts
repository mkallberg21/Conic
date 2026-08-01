import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { MatchStatus, UserRole } from '@prisma/client';
import { MatchmakingService } from './matchmaking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateMatchRequestDto } from './dto/matchmaking.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  matchRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockHttp = { axiosRef: jest.fn() };
// ConfigService.get(key, default) → return the provided default
const mockConfig = { get: jest.fn((_key: string, def?: unknown) => def) };
const mockAudit = { log: jest.fn() };

const OWNER = 'user_owner';

describe('MatchmakingService', () => {
  let service: MatchmakingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HttpService, useValue: mockHttp },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<MatchmakingService>(MatchmakingService);
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('persists the request as PENDING and returns immediately (matching runs async)', async () => {
      mockPrisma.matchRequest.create.mockResolvedValue({ id: 'req_1', status: MatchStatus.PENDING });
      // The async runMatching() sets PROCESSING then reads the request back — return null so it exits early
      mockPrisma.matchRequest.update.mockResolvedValue({});
      mockPrisma.matchRequest.findUnique.mockResolvedValue(null);

      const dto: CreateMatchRequestDto = { brief: 'Find fitness creators for a protein launch' };
      const result = await service.createRequest(OWNER, dto);

      expect(result).toEqual({ id: 'req_1', status: MatchStatus.PENDING });
      expect(mockPrisma.matchRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: MatchStatus.PENDING }) }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MATCH_REQUEST_CREATED', resourceId: 'req_1' }),
      );
    });
  });

  describe('getRequest (ownership / IDOR)', () => {
    const request = { id: 'req_1', requestedById: OWNER, results: [] };

    it('returns the request to its owner', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(request);
      await expect(service.getRequest('req_1', OWNER, UserRole.BRAND)).resolves.toEqual(request);
    });

    it('hides another user’s request behind NotFoundException (no ownership leak)', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(request);
      await expect(
        service.getRequest('req_1', 'user_other', UserRole.BRAND),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows an ADMIN to read any request', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(request);
      await expect(service.getRequest('req_1', 'user_admin', UserRole.ADMIN)).resolves.toEqual(request);
    });

    it('throws NotFoundException when the request does not exist', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(null);
      await expect(service.getRequest('missing', OWNER, UserRole.BRAND)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listRequests (role scoping)', () => {
    it('scopes a non-admin caller to their own requests', async () => {
      mockPrisma.matchRequest.findMany.mockResolvedValue([]);
      await service.listRequests(OWNER, UserRole.BRAND);
      expect(mockPrisma.matchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { requestedById: OWNER } }),
      );
    });

    it('lets an ADMIN see all requests (empty where clause)', async () => {
      mockPrisma.matchRequest.findMany.mockResolvedValue([]);
      await service.listRequests('user_admin', UserRole.ADMIN);
      expect(mockPrisma.matchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });
});
