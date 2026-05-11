export enum UserRole {
  BRAND = 'BRAND',
  CREATOR = 'CREATOR',
  AGENCY = 'AGENCY',
  ADMIN = 'ADMIN',
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  PENDING_SIGNATURES = 'PENDING_SIGNATURES',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
  DISPUTED = 'DISPUTED',
}

export enum DeliverableStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  IN_ESCROW = 'IN_ESCROW',
  RELEASED = 'RELEASED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum CampaignStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Brand {
  id: string;
  userId: string;
  companyName: string;
  industry?: string;
  website?: string;
  user: User;
  createdAt: string;
}

export interface Creator {
  id: string;
  userId: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  youtubeHandle?: string;
  niche?: string;
  totalFollowers: number;
  avgEngagementRate?: number;
  audienceScore?: number;
  fraudScore?: number;
  performanceScore?: number;
  tier?: string;
  user: User;
  createdAt: string;
}

export interface Contract {
  id: string;
  title: string;
  status: ContractStatus;
  totalValue: number;
  riskScore?: number;
  riskFlags?: string[];
  brandSignedAt?: string;
  creatorSignedAt?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Deliverable {
  id: string;
  title: string;
  platform: string;
  status: DeliverableStatus;
  verificationStatus?: string;
  verificationScore?: number;
  dueDate?: string;
  contentUrl?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  netAmount: number;
  platformFeeRate: number;
  status: PaymentStatus;
  fraudScore?: number;
  releasedAt?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  budget?: number;
  startDate?: string;
  endDate?: string;
  objectives?: string[];
  targetNiches?: string[];
  aiInsights?: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}
