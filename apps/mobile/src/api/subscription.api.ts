import { apiClient } from './client';

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export interface PlanState {
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  status: string;
  isPro: boolean;
  currentPeriodEnd: string | null;
  dmCredits: number;
}

export interface CheckoutResult {
  activated: boolean;
  plan?: string;
  checkoutUrl?: string;
}

export const subscriptionApi = {
  async me(): Promise<PlanState> {
    return unwrap(await apiClient.get('/subscription/me'));
  },
  async checkout(plan: 'PRO'): Promise<CheckoutResult> {
    return unwrap(await apiClient.post('/subscription/checkout', { plan }));
  },
  async cancel(): Promise<PlanState> {
    return unwrap(await apiClient.post('/subscription/cancel'));
  },
};
