import { apiClient } from './client';

export const deliverablesApi = {
  async list() {
    const { data } = await apiClient.get('/deliverables');
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/deliverables/${id}`);
    return data;
  },

  async submit(id: string, proofUrl: string) {
    const { data } = await apiClient.patch(`/deliverables/${id}/submit`, { proofUrl });
    return data;
  },
};
