import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { VerificationChannel, UserRole } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { SmsService } from '../../common/sms/sms.service';
import { AuditService } from '../../common/audit/audit.service';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
  ) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, emailVerified: true, phoneVerified: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const influencer = user.role === UserRole.CREATOR || user.role === UserRole.ATHLETE;
    return {
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      // Influencers must complete both to transact; other roles are unconstrained.
      fullyVerified: influencer ? user.emailVerified && user.phoneVerified : true,
      required: influencer,
    };
  }

  // ── Email ────────────────────────────────────────────────────────────────

  async requestEmailCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, emailVerified: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) return { alreadyVerified: true, channel: 'EMAIL' as const };

    const code = await this.issueCode(userId, VerificationChannel.EMAIL, user.email);
    await this.email.sendVerificationCode(user.email, code, user.firstName);
    return { sent: true, channel: 'EMAIL' as const, destination: maskEmail(user.email) };
  }

  async verifyEmailCode(userId: string, code: string) {
    await this.consumeCode(userId, VerificationChannel.EMAIL, code);
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
    void this.audit.log({ userId, action: 'EMAIL_VERIFIED', resource: 'User', resourceId: userId });
    return this.getStatus(userId);
  }

  // ── Phone ──────────────────────────────────────────────────────────────────

  async requestPhoneCode(userId: string, phone: string) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new BadRequestException('Enter a valid phone number in international format, e.g. +14155550123');

    // Persist the (still-unverified) phone so we capture the number they claim.
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone: normalized, phoneVerified: false },
    });

    const code = await this.issueCode(userId, VerificationChannel.PHONE, normalized);
    await this.sms.send(normalized, `Your Conic verification code is ${code}. It expires in 10 minutes.`);
    return {
      sent: true,
      channel: 'PHONE' as const,
      destination: maskPhone(normalized),
      // When no SMS provider is configured the code is logged, not delivered.
      delivered: this.sms.isLive,
    };
  }

  async verifyPhoneCode(userId: string, code: string) {
    await this.consumeCode(userId, VerificationChannel.PHONE, code);
    await this.prisma.user.update({ where: { id: userId }, data: { phoneVerified: true } });
    void this.audit.log({ userId, action: 'PHONE_VERIFIED', resource: 'User', resourceId: userId });
    return this.getStatus(userId);
  }

  // ── Gating helper ──────────────────────────────────────────────────────────

  /**
   * Enforces the influencer 2FA gate: CREATOR/ATHLETE accounts must have both
   * a verified email and a verified phone before they can enter into agreements
   * or list publicly. No-op for other roles.
   */
  async assertInfluencerVerified(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, emailVerified: true, phoneVerified: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const influencer = user.role === UserRole.CREATOR || user.role === UserRole.ATHLETE;
    if (influencer && !(user.emailVerified && user.phoneVerified)) {
      throw new ForbiddenException(
        'Verify your email and phone number before you can enter into agreements or list publicly.',
      );
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async issueCode(
    userId: string,
    channel: VerificationChannel,
    target: string,
  ): Promise<string> {
    const recent = await this.prisma.verificationCode.findFirst({
      where: { userId, channel, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new BadRequestException('A code was just sent — please wait a moment before requesting another.');
    }

    // Invalidate any outstanding codes for this channel so only the newest works.
    await this.prisma.verificationCode.updateMany({
      where: { userId, channel, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.verificationCode.create({
      data: {
        userId,
        channel,
        target,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    return code;
  }

  private async consumeCode(userId: string, channel: VerificationChannel, code: string): Promise<void> {
    const rec = await this.prisma.verificationCode.findFirst({
      where: { userId, channel, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!rec) throw new BadRequestException('No pending code — request a new one.');
    if (rec.expiresAt < new Date()) throw new BadRequestException('That code has expired — request a new one.');
    if (rec.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts — request a new code.');
    }
    if (rec.codeHash !== sha256(code)) {
      await this.prisma.verificationCode.update({
        where: { id: rec.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code.');
    }
    await this.prisma.verificationCode.update({
      where: { id: rec.id },
      data: { consumedAt: new Date() },
    });
  }
}

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

/** Accepts E.164-ish input; strips spacing/punctuation. Returns null if implausible. */
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return (hasPlus ? '+' : '+') + digits;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? '****' : `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}
