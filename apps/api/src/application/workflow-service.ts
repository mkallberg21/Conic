import type {
  Agreement,
  ContactLead,
  Deliverable,
  Payment,
  Party
} from "@conic/domain";
import type {
  CreateAgreementInput,
  CreateContactLeadInput,
  SubmitDeliverableInput
} from "@conic/contracts";
import { InMemoryStore } from "../infrastructure/store.js";

const createId = (prefix: string): string => {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

const isoInDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export class WorkflowService {
  public constructor(
    private readonly store: InMemoryStore,
    private readonly paymentProvider: string,
    private readonly paymentSettlementDays: number
  ) {}

  public createAgreement(input: CreateAgreementInput): Agreement {
    const brand: Party = {
      id: createId("brand"),
      type: "brand",
      name: input.brandName,
      email: input.brandEmail
    };

    const creator: Party = {
      id: createId("creator"),
      type: "creator",
      name: input.creatorName,
      email: input.creatorEmail
    };

    const agreement: Agreement = {
      id: createId("agr"),
      title: input.title,
      scope: input.scope,
      amountCents: input.amountCents,
      status: "active",
      createdAt: new Date().toISOString(),
      brand,
      creator
    };

    this.store.agreements.unshift(agreement);
    return agreement;
  }

  public listAgreements(): Agreement[] {
    return this.store.agreements;
  }

  public submitDeliverable(agreementId: string, input: SubmitDeliverableInput): Deliverable {
    const agreement = this.store.agreements.find((item) => item.id === agreementId);
    if (!agreement) {
      throw new Error("Agreement not found");
    }

    const deliverable: Deliverable = {
      id: createId("dlv"),
      agreementId,
      description: input.description,
      proofUrl: input.proofUrl,
      submittedAt: new Date().toISOString(),
      status: "submitted"
    };

    this.store.deliverables.unshift(deliverable);
    return deliverable;
  }

  public listDeliverables(agreementId?: string): Deliverable[] {
    if (!agreementId) {
      return this.store.deliverables;
    }

    return this.store.deliverables.filter((item) => item.agreementId === agreementId);
  }

  public approveDeliverable(deliverableId: string): Payment {
    const deliverable = this.store.deliverables.find((item) => item.id === deliverableId);
    if (!deliverable) {
      throw new Error("Deliverable not found");
    }

    deliverable.status = "approved";

    const agreement = this.store.agreements.find((item) => item.id === deliverable.agreementId);
    if (!agreement) {
      throw new Error("Agreement not found for deliverable");
    }

    const payment: Payment = {
      id: createId("pmt"),
      agreementId: agreement.id,
      deliverableId: deliverable.id,
      amountCents: agreement.amountCents,
      status: "scheduled",
      provider: this.paymentProvider,
      scheduledFor: isoInDays(this.paymentSettlementDays)
    };

    this.store.payments.unshift(payment);
    return payment;
  }

  public listPayments(): Payment[] {
    return this.store.payments;
  }

  public createContactLead(input: CreateContactLeadInput): ContactLead {
    const lead: ContactLead = {
      id: createId("lead"),
      interestedAs: input.interestedAs,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      message: input.message,
      submittedAt: new Date().toISOString()
    };

    this.store.contactLeads.unshift(lead);
    return lead;
  }
}
