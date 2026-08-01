import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SocialPlatform, SocialVerificationStatus, UserRole } from '@prisma/client';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { OwnershipCodeVerifier } from './social-verifier';
import { AddSocialAccountDto } from './dto/profile.dto';

const mockPrisma = {
  creator: { findUnique: jest.fn(), update: jest.fn() },
  athlete: { findUnique: jest.fn(), update: jest.fn() },
  socialAccount: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};
const mockEmbeddings = {
  embedCreatorProfile: jest.fn().mockResolvedValue(undefined),
  embedAthleteProfile: jest.fn().mockResolvedValue(undefined),
};
const mockVerifier = {
  begin: jest.fn().mockReturnValue({ method: 'ownership_code', verificationCode: 'conic-verify-abcd', instructions: 'add it' }),
  check: jest.fn().mockResolvedValue(false),
};

const CREATOR_USER = 'user_creator';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmbeddingsService, useValue: mockEmbeddings },
        { provide: OwnershipCodeVerifier, useValue: mockVerifier },
      ],
    }).compile();
    service = module.get<ProfileService>(ProfileService);
    jest.clearAllMocks();
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'cr_1' });
  });

  describe('owner resolution', () => {
    it('rejects non creator/athlete roles', async () => {
      await expect(service.listSocialAccounts('u', UserRole.BRAND)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the creator profile is missing', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(null);
      await expect(service.listSocialAccounts(CREATOR_USER, UserRole.CREATOR)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addSocialAccount', () => {
    const dto = { platform: SocialPlatform.INSTAGRAM, handle: 'jane' } as AddSocialAccountDto;

    it('makes the first linked account primary', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);
      mockPrisma.socialAccount.count.mockResolvedValue(0);
      mockPrisma.socialAccount.create.mockResolvedValue({ id: 'sa_1', isPrimary: true });

      await service.addSocialAccount(CREATOR_USER, UserRole.CREATOR, dto);

      expect(mockPrisma.socialAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ creatorId: 'cr_1', isPrimary: true, platform: SocialPlatform.INSTAGRAM }) }),
      );
      expect(mockEmbeddings.embedCreatorProfile).toHaveBeenCalledWith('cr_1');
    });

    it('rejects linking a duplicate account', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue({ id: 'sa_existing' });
      await expect(service.addSocialAccount(CREATOR_USER, UserRole.CREATOR, dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.socialAccount.create).not.toHaveBeenCalled();
    });

    it('demotes existing primaries when a new primary is added', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);
      mockPrisma.socialAccount.count.mockResolvedValue(2);
      mockPrisma.socialAccount.create.mockResolvedValue({ id: 'sa_2', isPrimary: true });

      await service.addSocialAccount(CREATOR_USER, UserRole.CREATOR, { ...dto, isPrimary: true });

      expect(mockPrisma.socialAccount.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { creatorId: 'cr_1' }, data: { isPrimary: false } }),
      );
    });
  });

  describe('removeSocialAccount', () => {
    it('forbids removing an account owned by someone else', async () => {
      mockPrisma.socialAccount.findUnique.mockResolvedValue({ id: 'sa_x', creatorId: 'other_creator', isPrimary: false });
      await expect(service.removeSocialAccount(CREATOR_USER, UserRole.CREATOR, 'sa_x')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.socialAccount.delete).not.toHaveBeenCalled();
    });

    it('promotes another account to primary when the primary is removed', async () => {
      mockPrisma.socialAccount.findUnique.mockResolvedValue({ id: 'sa_1', creatorId: 'cr_1', isPrimary: true });
      mockPrisma.socialAccount.delete.mockResolvedValue({});
      mockPrisma.socialAccount.findFirst.mockResolvedValue({ id: 'sa_2' });

      await service.removeSocialAccount(CREATOR_USER, UserRole.CREATOR, 'sa_1');

      expect(mockPrisma.socialAccount.delete).toHaveBeenCalledWith({ where: { id: 'sa_1' } });
      expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith({ where: { id: 'sa_2' }, data: { isPrimary: true } });
    });
  });

  describe('requestVerification', () => {
    it('sets the account PENDING with an ownership code', async () => {
      mockPrisma.socialAccount.findUnique.mockResolvedValue({
        id: 'sa_1', creatorId: 'cr_1', platform: SocialPlatform.INSTAGRAM, handle: 'jane',
        verificationStatus: SocialVerificationStatus.UNVERIFIED,
      });
      mockPrisma.socialAccount.update.mockResolvedValue({});

      const res = await service.requestVerification(CREATOR_USER, UserRole.CREATOR, 'sa_1');

      expect(res.verificationCode).toBe('conic-verify-abcd');
      expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verificationStatus: SocialVerificationStatus.PENDING }) }),
      );
    });
  });

  describe('updateProfile', () => {
    it('updates only provided fields and re-embeds', async () => {
      mockPrisma.creator.update.mockResolvedValue({ id: 'cr_1' });
      await service.updateProfile(CREATOR_USER, UserRole.CREATOR, { bio: 'hi', contentStyle: ['luxury'] });
      expect(mockPrisma.creator.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cr_1' }, data: { bio: 'hi', contentStyle: ['luxury'] } }),
      );
      expect(mockEmbeddings.embedCreatorProfile).toHaveBeenCalledWith('cr_1');
    });
  });
});
