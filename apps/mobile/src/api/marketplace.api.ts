import { apiClient } from './client';

export interface Brief {
  id: string;
  title: string;
  description: string;
  budgetCents: number;
  currency: string;
  deliverableType?: string | null;
  platforms: string[];
  sport?: string | null;
  deadline?: string | null;
  myApplicationStatus: string | null;
  brand: { companyName: string; logoUrl: string | null; industry: string | null };
}

export interface MyApplication {
  id: string;
  pitch: string;
  status: string;
  createdAt: string;
  brief: { title: string; budgetCents: number; brand: { companyName: string } };
}

// The API wraps payloads in a { data } envelope (TransformInterceptor).
const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const marketplaceApi = {
  async browse(): Promise<Brief[]> {
    return unwrap(await apiClient.get('/marketplace/briefs'));
  },
  async apply(briefId: string, body: { pitch: string; proposedRateCents?: number }): Promise<unknown> {
    return unwrap(await apiClient.post(`/marketplace/briefs/${briefId}/apply`, body));
  },
  async myApplications(): Promise<MyApplication[]> {
    return unwrap(await apiClient.get('/marketplace/applications/mine'));
  },
};
