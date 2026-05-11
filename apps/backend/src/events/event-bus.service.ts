import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ─── Event Definitions ────────────────────────────────────────────────────────

export interface ContractCreatedEvent {
  contractId: string;
  brandId: string;
  creatorId: string;
  totalValue: number;
}

export interface ContractSignedEvent {
  contractId: string;
  signedBy: 'brand' | 'creator';
  fullyExecuted: boolean;
}

export interface DeliverableSubmittedEvent {
  deliverableId: string;
  contractId: string;
  creatorId: string;
  proofUrl: string;
}

export interface DeliverableVerifiedEvent {
  deliverableId: string;
  verificationStatus: string;
  verificationScore: number;
  flags: string[];
}

export interface DeliverableApprovedEvent {
  deliverableId: string;
  contractId: string;
  paymentAmount: number;
}

export interface PaymentReleasedEvent {
  paymentId: string;
  contractId: string;
  amount: number;
  creatorId: string;
}

export interface FraudDetectedEvent {
  resourceType: 'payment' | 'creator' | 'deliverable';
  resourceId: string;
  fraudScore: number;
  flags: string[];
}

export interface CampaignSummaryGeneratedEvent {
  campaignId: string;
  summaryId: string;
  period: string;
}

export const EVENTS = {
  CONTRACT_CREATED: 'contract.created',
  CONTRACT_SIGNED: 'contract.signed',
  CONTRACT_ACTIVATED: 'contract.activated',
  DELIVERABLE_SUBMITTED: 'deliverable.submitted',
  DELIVERABLE_VERIFIED: 'deliverable.verified',
  DELIVERABLE_APPROVED: 'deliverable.approved',
  DELIVERABLE_REJECTED: 'deliverable.rejected',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_RELEASED: 'payment.released',
  PAYMENT_FAILED: 'payment.failed',
  FRAUD_DETECTED: 'fraud.detected',
  CAMPAIGN_SUMMARY_GENERATED: 'campaign.summary.generated',
  CREATOR_SCORE_UPDATED: 'creator.score.updated',
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit<T>(event: string, payload: T): void {
    this.logger.debug(`Emitting event: ${event}`);
    this.eventEmitter.emit(event, payload);
  }

  on<T>(event: string, listener: (payload: T) => void): void {
    this.eventEmitter.on(event, listener);
  }

  onModuleDestroy() {
    this.eventEmitter.removeAllListeners();
  }
}
