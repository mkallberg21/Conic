import { apiClient } from './client';

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export type IdentityStatus = 'NOT_STARTED' | 'PENDING' | 'NEEDS_INPUT' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'REVIEW';

export interface AgeStatus {
  ageVerified: boolean;
  method: 'ESTIMATION' | 'DOCUMENT' | null;
  verifiedAt: string | null;
  current: { id: string; status: IdentityStatus; method: string; isAdult: boolean | null } | null;
}

export interface AgeStartResult {
  sessionId: string;
  clientToken?: string;
  redirectUrl?: string;
  status: IdentityStatus;
}

export const verificationApi = {
  async ageStatus(): Promise<AgeStatus> {
    return unwrap(await apiClient.get('/verification/age/status'));
  },
  async ageStart(method: 'ESTIMATION' | 'DOCUMENT'): Promise<AgeStartResult> {
    return unwrap(await apiClient.post('/verification/age/start', { method }));
  },
};
