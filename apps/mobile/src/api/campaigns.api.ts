import { apiClient } from './client';

export const campaignsApi = {
  async list() {
    const { data } = await apiClient.get('/campaigns');
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/campaigns/${id}`);
    return data;
  },
};
