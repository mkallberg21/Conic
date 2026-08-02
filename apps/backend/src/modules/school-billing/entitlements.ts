import { InstitutionPlan } from '@prisma/client';

export interface InstitutionEntitlements {
  label: string;
  priceCents: number; // monthly
  athletes: number; // roster cap
  sports: number; // department count
  prioritySupport: boolean;
}

// Institution tiers for the NIL-compliance product. Monthly prices reflect the
// annual enterprise contracts common in this category.
export const INSTITUTION_ENTITLEMENTS: Record<InstitutionPlan, InstitutionEntitlements> = {
  [InstitutionPlan.NONE]: { label: 'Not subscribed', priceCents: 0, athletes: 25, sports: 1, prioritySupport: false },
  [InstitutionPlan.CAMPUS]: { label: 'Campus', priceCents: 50000, athletes: 150, sports: 3, prioritySupport: false },
  [InstitutionPlan.DEPARTMENT]: { label: 'Department', priceCents: 200000, athletes: 750, sports: 20, prioritySupport: true },
  [InstitutionPlan.ENTERPRISE]: { label: 'Enterprise', priceCents: 600000, athletes: 9999, sports: 999, prioritySupport: true },
};
