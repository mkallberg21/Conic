export type PartyType = "brand" | "creator";

export interface Party {
  id: string;
  type: PartyType;
  name: string;
  email: string;
}

export type AgreementStatus = "draft" | "active" | "completed";
export type DeliverableStatus = "submitted" | "approved" | "rejected";
export type PaymentStatus = "pending" | "scheduled" | "paid";

export interface Agreement {
  id: string;
  title: string;
  scope: string;
  amountCents: number;
  status: AgreementStatus;
  createdAt: string;
  brand: Party;
  creator: Party;
}

export interface Deliverable {
  id: string;
  agreementId: string;
  description: string;
  proofUrl: string;
  submittedAt: string;
  status: DeliverableStatus;
}

export interface Payment {
  id: string;
  agreementId: string;
  deliverableId: string;
  amountCents: number;
  status: PaymentStatus;
  provider: string;
  scheduledFor: string;
}

export interface ContactLead {
  id: string;
  interestedAs: PartyType;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  submittedAt: string;
}

export const centsToUsd = (amountCents: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
};
