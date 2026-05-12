import { apiClient } from './client';

export const dashboardApi = {
  async getSummary() {
    const { data } = await apiClient.get('/analytics/dashboard');
    return data;
  },
};
