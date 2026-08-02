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
  CONTRACT_DISPUTED: 'contract.disputed',
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
  CREATOR_REGISTERED: 'creator.registered',
  // NIL / Athlete events
  NIL_DISCLOSURE_SUBMITTED: 'nil.disclosure.submitted',
  NIL_DISCLOSURE_APPROVED: 'nil.disclosure.approved',
  NIL_DISCLOSURE_REJECTED: 'nil.disclosure.rejected',
  NIL_DEAL_CREATED: 'nil.deal.created',
  NIL_DEAL_ACTIVATED: 'nil.deal.activated',
  APPEARANCE_SCHEDULED: 'appearance.scheduled',
  APPEARANCE_COMPLETED: 'appearance.completed',
  GUARDIAN_APPROVED: 'guardian.approved',
  GUARDIAN_REJECTED: 'guardian.rejected',
  // Identity / business verification
  AGE_VERIFIED: 'age.verified',
  AGE_DECLINED: 'age.declined',
  MINOR_DOWNGRADED: 'age.minor_downgraded',
  KYB_APPROVED: 'kyb.approved',
  KYB_FLAGGED: 'kyb.flagged',
  COMPLIANCE_REPORT_GENERATED: 'compliance.report.generated',
  FMV_ASSESSED: 'fmv.assessed',
  ELIGIBILITY_FLAGGED: 'eligibility.flagged',
  TAX_DOCUMENT_REQUESTED: 'tax.document.requested',
  TAX_DOCUMENT_SUBMITTED: 'tax.document.submitted',
} as const;

// Events that should feed into the data flywheel
const FLYWHEEL_EVENTS: ReadonlySet<string> = new Set<string>([
  EVENTS.CONTRACT_SIGNED,
  EVENTS.CONTRACT_ACTIVATED,
  EVENTS.DELIVERABLE_APPROVED,
  EVENTS.DELIVERABLE_REJECTED,
  EVENTS.PAYMENT_RELEASED,
  EVENTS.CREATOR_SCORE_UPDATED,
  EVENTS.CREATOR_REGISTERED,
]);

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private flywheelQueue?: import('bullmq').Queue;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /** Called by QueueModule after init to inject the flywheel queue reference */
  setFlywheelQueue(queue: import('bullmq').Queue): void {
    this.flywheelQueue = queue;
  }

  emit<T extends Record<string, unknown>>(event: string, payload: T): void {
    this.logger.debug(`Emitting event: ${event}`);
    this.eventEmitter.emit(event, payload);

    // Fan into data flywheel queue
    if (FLYWHEEL_EVENTS.has(event) && this.flywheelQueue) {
      const sourceEntity = event.split('.')[0];
      const sourceId =
        (payload['creatorId'] as string) ??
        (payload['contractId'] as string) ??
        (payload['paymentId'] as string) ??
        'unknown';
      this.flywheelQueue
        .add(
          event,
          { eventType: event, sourceEntity, sourceId, payload },
          { delay: 2000, jobId: `${event}:${sourceId}:${Date.now()}` },
        )
        .catch((err) => this.logger.error(`Flywheel queue error: ${(err as Error).message}`));
    }
  }

  on<T>(event: string, listener: (payload: T) => void): void {
    this.eventEmitter.on(event, listener);
  }

  onModuleDestroy() {
    this.eventEmitter.removeAllListeners();
  }
}
