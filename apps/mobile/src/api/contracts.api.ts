import { apiClient } from './client';

export const contractsApi = {
  async list() {
    const { data } = await apiClient.get('/contracts');
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/contracts/${id}`);
    return data;
  },

  async sign(id: string) {
    const { data } = await apiClient.post(`/contracts/${id}/sign`);
    return data;
  },
};
