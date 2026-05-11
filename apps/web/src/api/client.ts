import type { Agreement, Deliverable, Payment } from "@conic/domain";

const API_BASE_URL = "http://localhost:4000/api/v1";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ? JSON.stringify(payload.error) : "Request failed");
  }

  return payload.data as T;
};

export const apiClient = {
  listAgreements: () => request<Agreement[]>("/agreements"),
  createAgreement: (body: {
    title: string;
    scope: string;
    amountCents: number;
    brandName: string;
    brandEmail: string;
    creatorName: string;
    creatorEmail: string;
  }) => request<Agreement>("/agreements", { method: "POST", body: JSON.stringify(body) }),
  listDeliverables: () => request<Deliverable[]>("/deliverables"),
  submitDeliverable: (
    agreementId: string,
    body: { description: string; proofUrl: string }
  ) =>
    request<Deliverable>(`/agreements/${agreementId}/deliverables`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  approveDeliverable: (deliverableId: string) =>
    request<Payment>(`/deliverables/${deliverableId}/approve`, { method: "POST" }),
  listPayments: () => request<Payment[]>("/payments"),
  createLead: (body: {
    interestedAs: "brand" | "creator";
    firstName: string;
    lastName: string;
    email: string;
    message: string;
  }) => request("/contact-leads", { method: "POST", body: JSON.stringify(body) })
};
