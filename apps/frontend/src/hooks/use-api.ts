'use client';
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AxiosError } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  take: number;
  totalPages: number;
}

export interface Creator {
  id: string;
  handle: string;
  bio: string | null;
  platforms: Record<string, string>;
  primaryPlatform: string | null;
  niche: string[];
  followersCount: number;
  engagementRate: number;
  avgReach: number;
  audienceScore: number;
  fraudScore: number;
  performanceScore: number;
  pricingTier: string | null;
  isVerified: boolean;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  graphNode: { influenceScore: number; trending: boolean; trendingScore: number; clusterId: string | null; clusterLabel: string | null } | null;
  predictions: Array<{ predictedROI: number; predictedReach: number; confidence: number }>;
  _count: { contracts: number; deliverables: number };
}

export interface Contract {
  id: string;
  title: string;
  status: string;
  totalValue: number;
  riskScore: number;
  startDate: string | null;
  endDate: string | null;
  brandSignedAt: string | null;
  creatorSignedAt: string | null;
  creator: { id: string; handle: string; user: { firstName: string; lastName: string; avatarUrl: string | null } };
  brand: { id: string; companyName: string; logoUrl: string | null };
}

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  status: string;
  budget: number | null;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  creatorCount: number;
  deliverableCount: number;
  roi: number | null;
  reach: number;
  impressions: number;
  engagements: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
}

export interface Payment {
  id: string;
  amount: number;
  netAmount: number;
  status: string;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
  contract: { id: string; title: string };
}

export interface AnalyticsOverview {
  totalUsers: number;
  contractsByStatus: Array<{ status: string; _count: number }>;
  paymentsProcessed: { count: number; totalAmount: number };
  deliverablesByStatus: Array<{ status: string; _count: number }>;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  creators: (filters?: Record<string, unknown>) => ['creators', filters],
  creator: (id: string) => ['creator', id],
  contracts: (filters?: Record<string, unknown>) => ['contracts', filters],
  contract: (id: string) => ['contract', id],
  campaigns: () => ['campaigns'],
  campaign: (id: string) => ['campaign', id],
  notifications: () => ['notifications'],
  payments: () => ['payments'],
  analytics: (scope: string) => ['analytics', scope],
  me: () => ['me'],
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ApiResponse<T> = { data: T; success: boolean };

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url, { params });
  return data.data;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<ApiResponse<T>>(url, body);
  return data.data;
}

async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<ApiResponse<T>>(url, body);
  return data.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function useMe(options?: Partial<UseQueryOptions<{ id: string; email: string; role: string; firstName: string; lastName: string }>>) {
  return useQuery({
    queryKey: QUERY_KEYS.me(),
    queryFn: () => get<{ id: string; email: string; role: string; firstName: string; lastName: string }>('/v1/users/me'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// ─── Creators ─────────────────────────────────────────────────────────────────

export interface DiscoveryFilters {
  q?: string;
  niche?: string;
  platform?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  pricingTier?: string;
  isVerified?: boolean;
  trending?: boolean;
  page?: number;
  take?: number;
}

export function useCreators(filters: DiscoveryFilters = {}) {
  return useQuery<PaginatedResponse<Creator>>({
    queryKey: QUERY_KEYS.creators(filters as Record<string, unknown>),
    queryFn: () => get('/v1/creators/discover', filters as Record<string, unknown>),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useCreator(id: string, options?: Partial<UseQueryOptions<Creator>>) {
  return useQuery<Creator>({
    queryKey: QUERY_KEYS.creator(id),
    queryFn: () => get(`/v1/creators/${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useUpdateCreator() {
  const qc = useQueryClient();
  return useMutation<Creator, AxiosError, { data: Partial<Creator> }>({
    mutationFn: ({ data }) => patch('/v1/creators/profile', data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.creator(updated.id) });
      qc.invalidateQueries({ queryKey: ['creators'] });
    },
  });
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export function useContracts() {
  return useQuery<PaginatedResponse<Contract>>({
    queryKey: QUERY_KEYS.contracts(),
    queryFn: () => get('/v1/contracts'),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useContract(id: string) {
  return useQuery<Contract & { content: string; clauses: unknown[]; milestones: unknown[] }>({
    queryKey: QUERY_KEYS.contract(id),
    queryFn: () => get(`/v1/contracts/${id}`),
    enabled: !!id,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation<Contract, AxiosError, Record<string, unknown>>({
    mutationFn: (dto) => post('/v1/contracts', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contracts() }),
  });
}

export function useSignContract() {
  const qc = useQueryClient();
  return useMutation<Contract, AxiosError, { id: string }>({
    mutationFn: ({ id }) => post(`/v1/contracts/${id}/sign`),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.contract(id) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.contracts() });
    },
  });
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export function useCampaigns() {
  return useQuery<PaginatedResponse<Campaign>>({
    queryKey: QUERY_KEYS.campaigns(),
    queryFn: () => get('/v1/campaigns'),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useCampaign(id: string) {
  return useQuery<Campaign & { tasks: unknown[]; summaries: unknown[] }>({
    queryKey: QUERY_KEYS.campaign(id),
    queryFn: () => get(`/v1/campaigns/${id}`),
    enabled: !!id,
    refetchInterval: 30 * 1000, // poll active campaigns
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation<Campaign, AxiosError, Record<string, unknown>>({
    mutationFn: (dto) => post('/v1/campaigns', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.campaigns() }),
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function useNotifications() {
  return useQuery<PaginatedResponse<Notification>>({
    queryKey: QUERY_KEYS.notifications(),
    queryFn: () => get('/v1/notifications'),
    refetchInterval: 15 * 1000, // poll every 15s
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation<void, AxiosError, { id: string }>({
    mutationFn: ({ id }) => patch(`/v1/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications() }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation<void, AxiosError, void>({
    mutationFn: () => post('/v1/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications() }),
  });
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function usePayments() {
  return useQuery<PaginatedResponse<Payment>>({
    queryKey: QUERY_KEYS.payments(),
    queryFn: () => get('/v1/payments'),
    staleTime: 30 * 1000,
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function useAnalyticsOverview() {
  return useQuery<AnalyticsOverview>({
    queryKey: QUERY_KEYS.analytics('overview'),
    queryFn: () => get('/v1/analytics/overview'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCampaignPerformance() {
  return useQuery<{ campaigns: Campaign[]; totalSpend: number; activeCampaigns: number }>({
    queryKey: QUERY_KEYS.analytics('campaign-performance'),
    queryFn: () => get('/v1/analytics/campaigns'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatorStats() {
  return useQuery<{ totalEarnings: number; deliverablesByStatus: unknown[]; latestPrediction: unknown; audienceScore: number; performanceScore: number }>({
    queryKey: QUERY_KEYS.analytics('creator-stats'),
    queryFn: () => get('/v1/analytics/creator-stats'),
    staleTime: 5 * 60 * 1000,
  });
}
