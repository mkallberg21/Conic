import { apiClient } from './client';

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export interface Insights {
  profileViews: number;
  viewsThisWeek: number;
  uniqueBrands: number;
  savedByBrands: number;
}

export interface Viewer {
  brandId: string;
  companyName: string;
  logoUrl: string | null;
  industry: string | null;
  views: number;
  lastViewedAt: string | null;
  saved: boolean;
}

export const engagementApi = {
  async insights(): Promise<Insights> {
    return unwrap(await apiClient.get('/engagement/insights'));
  },
  async viewers(): Promise<{ viewers: Viewer[] }> {
    return unwrap(await apiClient.get('/engagement/viewers'));
  },
};
