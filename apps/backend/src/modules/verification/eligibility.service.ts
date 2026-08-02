import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgeCheckMethod, KybTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The single place that turns verification state into capabilities. Each gate is
 * governed by an enforcement flag: when the flag is OFF the gate is "log-only"
 * (it records the miss and lets the action through) so the plumbing can ship
 * before enforcement is switched on per capability.
 */
@Injectable()
export class EligibilityService {
  private readonly logger = new Logger(EligibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Individual capability gates ──────────────────────────────────────────────

  async assertCanListPublicly(userId: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (!user.ageVerified) {
      this.gate('verification.enforceAgeToList', userId, 'Verify your age before appearing in discovery.');
    }
  }

  async assertCanSignAgreement(userId: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (!user.ageVerified) {
      this.gate('verification.enforceAgeToSign', userId, 'Verify your age before signing an agreement.');
    }
  }

  async assertCanReceivePayout(userId: string): Promise<void> {
    const user = await this.requireUser(userId);
    // Payout requires document-grade age/identity verification, not just estimation.
    if (!(user.ageVerified && user.ageAssurance === AgeCheckMethod.DOCUMENT)) {
      this.gate('verification.enforceAgeToPayout', userId, 'Complete document identity verification before receiving a payout.');
    }
  }

  // ── Brand capability gates ────────────────────────────────────────────────────

  async assertBrandCanTransact(brandUserId: string): Promise<void> {
    const brand = await this.requireBrand(brandUserId);
    if (brand.kybTier === KybTier.NONE) {
      this.gate('verification.enforceKybToTransact', brandUserId, 'Verify your business before funding or signing deals.');
    }
  }

  async assertBrandCanContactMinor(brandUserId: string): Promise<void> {
    const brand = await this.requireBrand(brandUserId);
    if (brand.kybTier !== KybTier.ENHANCED) {
      // Defaults ON — the highest-stakes gate.
      this.gate('verification.enforceKybToContactMinors', brandUserId, 'Enhanced business verification is required to contact a minor.');
    }
  }

  /** Non-throwing read for UI / branching (e.g. whether to show a minor to a brand). */
  async canBrandContactMinor(brandUserId: string): Promise<boolean> {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId }, select: { kybTier: true } });
    return brand?.kybTier === KybTier.ENHANCED;
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private gate(flagKey: string, subjectId: string, message: string): void {
    if (this.config.get<boolean>(flagKey)) {
      throw new ForbiddenException(message);
    }
    this.logger.warn(`[eligibility log-only] ${flagKey} would block ${subjectId}: ${message}`);
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ageVerified: true, ageAssurance: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async requireBrand(brandUserId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { userId: brandUserId },
      select: { kybTier: true, kybStatus: true },
    });
    if (!brand) throw new NotFoundException('Brand profile not found');
    return brand;
  }
}
