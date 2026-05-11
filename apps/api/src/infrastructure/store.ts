import type { Agreement, ContactLead, Deliverable, Payment } from "@conic/domain";

export class InMemoryStore {
  public agreements: Agreement[] = [];
  public deliverables: Deliverable[] = [];
  public payments: Payment[] = [];
  public contactLeads: ContactLead[] = [];
}
