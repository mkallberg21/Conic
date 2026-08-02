import { BrandPlan } from '@prisma/client';

export interface Entitlements {
  label: string;
  priceCents: number;
  seats: number;
  activeCampaigns: number;
}

// Brand SaaS tiers — priced on seats + active-campaign volume.
export const BRAND_ENTITLEMENTS: Record<BrandPlan, Entitlements> = {
  [BrandPlan.FREE]: { label: 'Free', priceCents: 0, seats: 1, activeCampaigns: 1 },
  [BrandPlan.STARTER]: { label: 'Starter', priceCents: 19900, seats: 3, activeCampaigns: 5 },
  [BrandPlan.GROWTH]: { label: 'Growth', priceCents: 49900, seats: 10, activeCampaigns: 20 },
  [BrandPlan.SCALE]: { label: 'Scale', priceCents: 99900, seats: 999, activeCampaigns: 999 },
};
