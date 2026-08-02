import {
  Injectable, Logger, ForbiddenException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { Prisma, SocialPlatform, SocialVerificationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { GuardianService } from '../guardian/guardian.service';
import { GeoService } from '../engagement/geo.service';
import { OwnershipCodeVerifier } from './social-verifier';
import { AddSocialAccountDto, ResendGuardianInviteDto, UpdateProfileDto } from './dto/profile.dto';

type Owner =
  | { ownerType: 'creator'; creatorId: string; athleteId: null }
  | { ownerType: 'athlete'; creatorId: null; athleteId: string };

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly verifier: OwnershipCodeVerifier,
    private readonly guardian: GuardianService,
    private readonly geo: GeoService,
  ) {}

  // ── Owner resolution ────────────────────────────────────────────────────────

  private async resolveOwner(userId: string, role: UserRole): Promise<Owner> {
    if (role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({ where: { userId }, select: { id: true } });
      if (!creator) throw new NotFoundException('Creator profile not found');
      return { ownerType: 'creator', creatorId: creator.id, athleteId: null };
    }
    if (role === UserRole.ATHLETE) {
      const athlete = await this.prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
      if (!athlete) throw new NotFoundException('Athlete profile not found');
      return { ownerType: 'athlete', creatorId: null, athleteId: athlete.id };
    }
    throw new ForbiddenException('Only creators and athletes have a linkable profile');
  }

  private ownerWhere(owner: Owner): Prisma.SocialAccountWhereInput {
    return owner.ownerType === 'creator'
      ? { creatorId: owner.creatorId }
      : { athleteId: owner.athleteId };
  }

  private reEmbed(owner: Owner): void {
    const p = owner.ownerType === 'creator'
      ? this.embeddings.embedCreatorProfile(owner.creatorId)
      : this.embeddings.embedAthleteProfile(owner.athleteId);
    void p.catch((err) =>
      this.logger.warn(`Profile re-embed failed for ${owner.ownerType}: ${(err as Error).message}`),
    );
  }

  // ── Profile attributes ──────────────────────────────────────────────────────

  async getMyProfile(userId: string, role: UserRole) {
    const owner = await this.resolveOwner(userId, role);
    const [entity, socialAccounts] = await Promise.all([
      owner.ownerType === 'creator'
        ? this.prisma.creator.findUnique({ where: { id: owner.creatorId } })
        : this.prisma.athlete.findUnique({ where: { id: owner.athleteId } }),
      this.prisma.socialAccount.findMany({
        where: this.ownerWhere(owner),
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
    ]);
    return { profile: entity, socialAccounts };
  }

  async updateProfile(userId: string, role: UserRole, dto: UpdateProfileDto) {
    const owner = await this.resolveOwner(userId, role);
    const data: Record<string, unknown> = {
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.niche !== undefined ? { niche: dto.niche } : {}),
      ...(dto.contentStyle !== undefined ? { contentStyle: dto.contentStyle } : {}),
      ...(dto.aestheticTags !== undefined ? { aestheticTags: dto.aestheticTags } : {}),
      ...(dto.languages !== undefined ? { languages: dto.languages } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
    };

    // When the self-provided location changes, refresh the privacy-blurred
    // coordinates used for the general-area map (never exact).
    if (dto.city !== undefined || dto.region !== undefined) {
      const approx = this.geo.resolveApprox(dto.city, dto.region);
      data.approxLat = approx?.lat ?? null;
      data.approxLng = approx?.lng ?? null;
    }

    const updated = owner.ownerType === 'creator'
      ? await this.prisma.creator.update({ where: { id: owner.creatorId }, data })
      : await this.prisma.athlete.update({ where: { id: owner.athleteId }, data });

    this.reEmbed(owner);
    return updated;
  }

  // ── Social accounts ─────────────────────────────────────────────────────────

  async listSocialAccounts(userId: string, role: UserRole) {
    const owner = await this.resolveOwner(userId, role);
    return this.prisma.socialAccount.findMany({
      where: this.ownerWhere(owner),
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addSocialAccount(userId: string, role: UserRole, dto: AddSocialAccountDto) {
    const owner = await this.resolveOwner(userId, role);

    const existing = await this.prisma.socialAccount.findFirst({
      where: { ...this.ownerWhere(owner), platform: dto.platform, handle: dto.handle },
    });
    if (existing) throw new ConflictException('That account is already linked');

    // First account for the owner is primary by default.
    const count = await this.prisma.socialAccount.count({ where: this.ownerWhere(owner) });
    const makePrimary = dto.isPrimary ?? count === 0;

    if (makePrimary) {
      await this.prisma.socialAccount.updateMany({
        where: this.ownerWhere(owner),
        data: { isPrimary: false },
      });
    }

    const account = await this.prisma.socialAccount.create({
      data: {
        ownerType: owner.ownerType,
        creatorId: owner.creatorId,
        athleteId: owner.athleteId,
        platform: dto.platform,
        handle: dto.handle,
        url: dto.url,
        followerCount: dto.followerCount,
        isPrimary: makePrimary,
        verificationStatus: SocialVerificationStatus.UNVERIFIED,
      },
    });

    this.reEmbed(owner);
    return account;
  }

  async removeSocialAccount(userId: string, role: UserRole, accountId: string) {
    const owner = await this.resolveOwner(userId, role);
    const account = await this.getOwnedAccount(owner, accountId);

    await this.prisma.socialAccount.delete({ where: { id: account.id } });

    // Promote another account to primary if we removed the primary one.
    if (account.isPrimary) {
      const next = await this.prisma.socialAccount.findFirst({
        where: this.ownerWhere(owner),
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.socialAccount.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    this.reEmbed(owner);
    return { deleted: true };
  }

  async setPrimary(userId: string, role: UserRole, accountId: string) {
    const owner = await this.resolveOwner(userId, role);
    const account = await this.getOwnedAccount(owner, accountId);

    await this.prisma.$transaction([
      this.prisma.socialAccount.updateMany({ where: this.ownerWhere(owner), data: { isPrimary: false } }),
      this.prisma.socialAccount.update({ where: { id: account.id }, data: { isPrimary: true } }),
    ]);
    return this.prisma.socialAccount.findUnique({ where: { id: account.id } });
  }

  // ── Verification ────────────────────────────────────────────────────────────

  async requestVerification(userId: string, role: UserRole, accountId: string) {
    const owner = await this.resolveOwner(userId, role);
    const account = await this.getOwnedAccount(owner, accountId);
    if (account.verificationStatus === SocialVerificationStatus.VERIFIED) {
      return { alreadyVerified: true, instructions: null };
    }

    const challenge = this.verifier.begin(account.platform, account.handle);
    await this.prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        verificationStatus: SocialVerificationStatus.PENDING,
        verificationMethod: challenge.method,
        verificationCode: challenge.verificationCode,
      },
    });
    return { instructions: challenge.instructions, verificationCode: challenge.verificationCode };
  }

  async confirmVerification(userId: string, role: UserRole, accountId: string) {
    const owner = await this.resolveOwner(userId, role);
    const account = await this.getOwnedAccount(owner, accountId);
    if (account.verificationStatus !== SocialVerificationStatus.PENDING || !account.verificationCode) {
      return { verified: false, reason: 'No pending verification for this account' };
    }

    const ok = await this.verifier.check(account.platform, account.handle, account.verificationCode);
    await this.prisma.socialAccount.update({
      where: { id: account.id },
      data: ok
        ? { verificationStatus: SocialVerificationStatus.VERIFIED, verifiedAt: new Date() }
        : {},
    });
    return {
      verified: ok,
      reason: ok ? undefined : 'Ownership could not be confirmed automatically (live platform verification is not yet enabled)',
    };
  }

  // ── Guardian linking (minors) ────────────────────────────────────────────────

  async getGuardianStatus(userId: string, role: UserRole) {
    const owner = await this.resolveOwner(userId, role);
    const isMinor = await this.isMinorOwner(owner);
    const subjectWhere = owner.ownerType === 'creator'
      ? { creatorId: owner.creatorId }
      : { athleteId: owner.athleteId };

    const [guardians, pendingInvite] = await Promise.all([
      this.prisma.guardianRelationship.findMany({
        where: subjectWhere,
        select: {
          id: true,
          relationship: true,
          guardian: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
      }),
      this.prisma.guardianInvite.findFirst({
        where: { ...subjectWhere, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, guardianEmail: true, createdAt: true, expiresAt: true },
      }),
    ]);

    return { isMinor, guardians, pendingInvite };
  }

  async resendGuardianInvite(userId: string, role: UserRole, dto: ResendGuardianInviteDto) {
    const owner = await this.resolveOwner(userId, role);
    if (!(await this.isMinorOwner(owner))) {
      throw new ForbiddenException('Guardian approval is only required for accounts under 18.');
    }
    const entity = owner.ownerType === 'creator'
      ? await this.prisma.creator.findUnique({ where: { id: owner.creatorId }, select: { user: { select: { firstName: true, lastName: true } } } })
      : await this.prisma.athlete.findUnique({ where: { id: owner.athleteId }, select: { user: { select: { firstName: true, lastName: true } } } });

    const subject = owner.ownerType === 'creator'
      ? { creatorId: owner.creatorId }
      : { athleteId: owner.athleteId };

    return this.guardian.createInvite({
      invitedByUserId: userId,
      subject,
      guardianEmail: dto.guardianEmail,
      relationship: dto.relationship,
      minorName: entity ? `${entity.user.firstName} ${entity.user.lastName}` : undefined,
    });
  }

  private async isMinorOwner(owner: Owner): Promise<boolean> {
    const entity = owner.ownerType === 'creator'
      ? await this.prisma.creator.findUnique({ where: { id: owner.creatorId }, select: { isMinor: true } })
      : await this.prisma.athlete.findUnique({ where: { id: owner.athleteId }, select: { isMinor: true } });
    return entity?.isMinor ?? false;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async getOwnedAccount(owner: Owner, accountId: string) {
    const account = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    const ownedId = owner.ownerType === 'creator' ? account?.creatorId : account?.athleteId;
    const expectedId = owner.ownerType === 'creator' ? owner.creatorId : owner.athleteId;
    if (!account || ownedId !== expectedId) throw new NotFoundException('Social account not found');
    return account;
  }
}

export { SocialPlatform };
