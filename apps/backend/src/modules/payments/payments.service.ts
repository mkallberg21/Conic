import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PaymentStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Client } from 'dwolla-v2';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService, EVENTS } from '../../events/event-bus.service';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly dwolla: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.dwolla = new Client({
      key: this.configService.get<string>('dwolla.key') ?? '',
      secret: this.configService.get<string>('dwolla.secret') ?? '',
      environment: (this.configService.get<string>('dwolla.environment') ?? 'sandbox') as
        | 'sandbox'
        | 'production',
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Returns a machine-to-machine app token valid for 1 hour. */
  private async appToken() {
    return this.dwolla.auth.client();
  }

  /** Resolve the platform's master funding source URL from config. */
  private get platformFundingSourceUrl(): string {
    return this.configService.get<string>('dwolla.masterFundingSourceUrl') ?? '';
  }

  async findAll(userId: string, role: UserRole) {
    if (role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({ where: { userId } });
      return this.prisma.payment.findMany({
        where: { contract: { creatorId: creator?.id } },
        include: {
          contract: { select: { id: true, title: true } },
          deliverable: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { userId } });
      return this.prisma.payment.findMany({
        where: { contract: { brandId: brand?.id } },
        include: {
          contract: { select: { id: true, title: true } },
          deliverable: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.payment.findMany({
      include: {
        contract: { select: { id: true, title: true } },
        deliverable: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async release(paymentId: string, brandUserId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { userId: brandUserId } });
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { contract: { include: { creator: true } } },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.contract.brandId !== brand?.id) throw new ForbiddenException();
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ForbiddenException('Payment is not in pending status');
    }

    try {
      const creatorDwollaId = payment.contract.creator.dwollaCustomerId;
      const dollarAmount = (payment.netAmount / 100).toFixed(2);

      if (creatorDwollaId && this.platformFundingSourceUrl) {
        const token = await this.appToken();

        // Retrieve the creator's default funding source
        const fsRes = await token.get(`${creatorDwollaId}/funding-sources`);
        const fundingSources: Array<{ _links: { self: { href: string } }; removed: boolean; type: string }> =
          fsRes.body._embedded['funding-sources'];
        const destination = fundingSources.find((fs) => !fs.removed && fs.type === 'bank')
          ?? fundingSources.find((fs) => !fs.removed);

        if (!destination) {
          throw new Error('Creator has no active Dwolla funding source');
        }

        const transferRes = await token.post('transfers', {
          _links: {
            source: { href: this.platformFundingSourceUrl },
            destination: { href: destination._links.self.href },
          },
          amount: { currency: payment.currency, value: dollarAmount },
          metadata: { paymentId: payment.id, contractId: payment.contractId },
        });

        const transferUrl: string = transferRes.headers.get('location') ?? '';
        const dwollaTransferId = transferUrl.split('/').pop() ?? transferUrl;

        await this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.COMPLETED,
            dwollaTransferId,
            paidAt: new Date(),
          },
        });
      } else {
        // No Dwolla account yet — mark completed for manual / test flow
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
        });
      }

      this.eventBus.emit(EVENTS.PAYMENT_RELEASED, {
        paymentId,
        contractId: payment.contractId,
        amount: payment.amount,
        creatorId: payment.contract.creatorId,
      });

      void this.auditService.log({
        userId: brandUserId,
        action: 'PAYMENT_RELEASED',
        resource: 'Payment',
        resourceId: paymentId,
        newValue: { amount: payment.amount, contractId: payment.contractId },
      });

      return { message: 'Payment released successfully', paymentId };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.FAILED },
      });
      this.eventBus.emit(EVENTS.PAYMENT_FAILED, { paymentId, error: String(error) });
      void this.auditService.log({
        userId: brandUserId,
        action: 'PAYMENT_FAILED',
        resource: 'Payment',
        resourceId: paymentId,
        newValue: { error: String(error), contractId: payment.contractId },
      });
      throw error;
    }
  }

  @OnEvent(EVENTS.DELIVERABLE_APPROVED)
  async handleDeliverableApproved(payload: {
    deliverableId: string;
    contractId: string;
    paymentAmount: number;
  }) {
    // Idempotency: skip if a payment already exists for this deliverable
    const existing = await this.prisma.payment.findFirst({
      where: { deliverableId: payload.deliverableId },
      select: { id: true },
    });
    if (existing) {
      this.logger.debug(`Payment already exists for deliverable ${payload.deliverableId}, skipping`);
      return;
    }

    this.logger.log(`Auto-creating payment for approved deliverable ${payload.deliverableId}`);
    const feeRate = this.configService.get<number>('dwolla.platformFeeRate', 0.05);
    const platformFee = Math.round(payload.paymentAmount * feeRate);
    const netAmount = payload.paymentAmount - platformFee;

    await this.prisma.payment.create({
      data: {
        contractId: payload.contractId,
        deliverableId: payload.deliverableId,
        amount: payload.paymentAmount,
        platformFee,
        netAmount,
        status: PaymentStatus.PENDING,
        description: 'Auto-released on deliverable approval',
      },
    });
  }

  /**
   * Creates (or retrieves) a Dwolla customer for the creator and returns a
   * short-lived client token so the frontend can render the Dwolla Drop-in
   * UI for the creator to add their bank account (funding source).
   */
  async getDwollaOnboardingToken(userId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!creator) throw new NotFoundException('Creator not found');

    const token = await this.appToken();

    let customerUrl = creator.dwollaCustomerId;

    if (!customerUrl) {
      const firstName = creator.user.firstName ?? 'Creator';
      const lastName = creator.user.lastName ?? 'User';

      const res = await token.post('customers', {
        firstName,
        lastName,
        email: creator.user.email,
        type: 'receive-only',
        businessName: creator.handle,
      });

      customerUrl = res.headers.get('location') as string;

      await this.prisma.creator.update({
        where: { id: creator.id },
        data: { dwollaCustomerId: customerUrl, dwollaVerified: false },
      });
    }

    // Generate a short-lived (~1 hour) client token for Dwolla Drop-ins
    const clientTokenRes = await token.post('client-tokens', {
      action: 'customer.fundingsources.create',
      _links: { customer: { href: customerUrl } },
    });

    return {
      clientToken: clientTokenRes.body.token as string,
      customerUrl,
      environment: this.configService.get<string>('dwolla.environment') ?? 'sandbox',
    };
  }
}
