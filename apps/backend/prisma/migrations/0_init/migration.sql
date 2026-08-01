-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BRAND', 'CREATOR', 'AGENCY', 'ADMIN', 'ATHLETE', 'GUARDIAN', 'AGENT', 'COMPLIANCE_OFFICER', 'COLLECTIVE_ADMIN', 'UNIVERSITY_ADMIN', 'ATHLETIC_DIRECTOR');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "AthleteStatus" AS ENUM ('ENROLLED', 'PROFESSIONAL', 'TRANSFERRED', 'GRADUATED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'UNDER_REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "NilDisclosureStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AppearanceType" AS ENUM ('SPEAKING', 'AUTOGRAPH_SIGNING', 'PROMOTIONAL_EVENT', 'ENDORSEMENT_APPEARANCE', 'CAMP_OR_CLINIC', 'VIRTUAL', 'MEDIA_INTERVIEW');

-- CreateEnum
CREATE TYPE "TaxDocumentType" AS ENUM ('W9', 'W8BEN', 'F1099NEC', 'F1042S');

-- CreateEnum
CREATE TYPE "TaxDocumentStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'VERIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'REQUIRES_CORRECTION');

-- CreateEnum
CREATE TYPE "DivisionLevel" AS ENUM ('NCAA_D1', 'NCAA_D2', 'NCAA_D3', 'NAIA', 'NJCAA', 'HIGH_SCHOOL', 'PROFESSIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('CREATOR_CSV', 'ATHLETE_CSV', 'CONTRACT_CSV', 'NIL_DEAL_CSV', 'OPENDORSE_EXPORT', 'TEAMWORKS_EXPORT', 'GENERIC_CSV');

-- CreateEnum
CREATE TYPE "DealRoomStatus" AS ENUM ('OPEN', 'AGREED', 'CLOSED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "DealRoomMessageType" AS ENUM ('COMMENT', 'COUNTEROFFER', 'ACCEPTANCE', 'REJECTION', 'AI_SUGGESTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CollectiveMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'REMOVED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "dwollaCustomerId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "dwollaCustomerId" TEXT,
    "dwollaVerified" BOOLEAN NOT NULL DEFAULT false,
    "totalSpend" INTEGER NOT NULL DEFAULT 0,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "bio" TEXT,
    "platforms" JSONB NOT NULL,
    "primaryPlatform" TEXT,
    "niche" TEXT[],
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgReach" INTEGER NOT NULL DEFAULT 0,
    "audienceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fraudScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricingTier" TEXT,
    "rateCardJson" JSONB,
    "dwollaCustomerId" TEXT,
    "dwollaVerified" BOOLEAN NOT NULL DEFAULT false,
    "totalEarnings" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "templateId" TEXT,
    "usageRights" TEXT,
    "exclusivity" BOOLEAN NOT NULL DEFAULT false,
    "exclusivityDays" INTEGER,
    "platforms" TEXT[],
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "totalValue" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFlags" JSONB,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "brandSignedAt" TIMESTAMP(3),
    "brandSignerIp" TEXT,
    "creatorSignedAt" TIMESTAMP(3),
    "creatorSignerIp" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isNilTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "platforms" TEXT[],
    "tags" TEXT[],
    "riskScore" INTEGER,
    "clauseCount" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changesSummary" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractClause" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isStandard" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" TEXT,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
    "proofUrl" TEXT,
    "proofType" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "postUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationScore" DOUBLE PRECISION,
    "verificationFlags" JSONB,
    "verificationReport" JSONB,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "revisionHistory" JSONB,
    "paymentAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "deliverableId" TEXT,
    "milestoneId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "dwollaTransferId" TEXT,
    "platformFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "fraudScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fraudFlags" JSONB,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMilestone" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "objective" TEXT,
    "targetAudience" JSONB,
    "budget" INTEGER,
    "spentBudget" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "platforms" TEXT[],
    "niche" TEXT[],
    "creatorCount" INTEGER NOT NULL DEFAULT 0,
    "deliverableCount" INTEGER NOT NULL DEFAULT 0,
    "contractIds" TEXT[],
    "aiTimeline" JSONB,
    "aiInsights" JSONB,
    "aiDebrief" JSONB,
    "performanceData" JSONB,
    "roi" DOUBLE PRECISION,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagements" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTask" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT DEFAULT 'MEDIUM',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSummary" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorGraphNode" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "clusterId" TEXT,
    "clusterLabel" TEXT,
    "centrality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "influenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "botNetworkScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "audienceOverlap" JSONB,
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "embeddingVector" DOUBLE PRECISION[],
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorGraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorGraphEdge" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "edgeType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPrediction" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "predictedReach" INTEGER NOT NULL,
    "predictedEngagement" DOUBLE PRECISION NOT NULL,
    "predictedROI" DOUBLE PRECISION NOT NULL,
    "audienceAuthenticity" DOUBLE PRECISION NOT NULL,
    "fraudLikelihood" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputFeatures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequest" (
    "id" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "outputPayload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationMs" INTEGER,
    "tokensUsed" INTEGER DEFAULT 0,
    "costUsd" DOUBLE PRECISION DEFAULT 0,
    "errorMessage" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureVector" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "featureSet" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "features" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "FeatureVector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddingRecord" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "embeddingType" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "vector" DOUBLE PRECISION[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelRegistry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpoint" TEXT,
    "artifactPath" TEXT,
    "metrics" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isChampion" BOOLEAN NOT NULL DEFAULT false,
    "trainedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelDriftAlert" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "baseline" DOUBLE PRECISION NOT NULL,
    "observed" DOUBLE PRECISION NOT NULL,
    "driftScore" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelDriftAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataFlywheelEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceEntity" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingMs" INTEGER,
    "featuresFed" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataFlywheelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "senderId" TEXT,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "channelType" TEXT NOT NULL DEFAULT 'in_app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "succeededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "role" TEXT,
    "message" TEXT,
    "source" TEXT,
    "utmParams" JSONB,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "ncaaSchoolId" TEXT,
    "division" "DivisionLevel" NOT NULL DEFAULT 'NCAA_D1',
    "conference" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "website" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "nilProgramActive" BOOLEAN NOT NULL DEFAULT true,
    "nilPolicy" JSONB,
    "reportingEmail" TEXT,
    "reportingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "disclosureRequired" BOOLEAN NOT NULL DEFAULT true,
    "disclosureThreshold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleticDepartment" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "headCoach" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleticDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceOfficer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceOfficer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT,
    "athleticDepartmentId" TEXT,
    "sport" TEXT NOT NULL,
    "position" TEXT,
    "jerseyNumber" TEXT,
    "classYear" TEXT,
    "graduationYear" INTEGER,
    "status" "AthleteStatus" NOT NULL DEFAULT 'ENROLLED',
    "eligibilityStatus" "EligibilityStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "eligibilityYearsLeft" INTEGER,
    "ncaaId" TEXT,
    "nilActive" BOOLEAN NOT NULL DEFAULT false,
    "nilCapCents" INTEGER,
    "nilEarnedYtdCents" INTEGER NOT NULL DEFAULT 0,
    "nilDisclosureRequired" BOOLEAN NOT NULL DEFAULT true,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "primaryPlatform" TEXT,
    "platforms" JSONB,
    "audienceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fraudScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fmvMinCents" INTEGER,
    "fmvMaxCents" INTEGER,
    "fmvLastAssessedAt" TIMESTAMP(3),
    "dwollaCustomerId" TEXT,
    "dwollaVerified" BOOLEAN NOT NULL DEFAULT false,
    "totalEarningsNilCents" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "relationship" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianRelationship" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianApproval" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyName" TEXT,
    "licenseNumber" TEXT,
    "licenseState" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRepresentation" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "scope" TEXT[],
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "contractUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRepresentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NilCollective" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "universityId" TEXT,
    "sport" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "contactEmail" TEXT,
    "ein" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "totalFundsRaisedCents" INTEGER NOT NULL DEFAULT 0,
    "totalPaidOutCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NilCollective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NilDeal" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "collectiveId" TEXT,
    "brandId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dealType" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fmvAssessmentId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "disclosureId" TEXT,
    "contractId" TEXT,
    "guardianApproved" BOOLEAN NOT NULL DEFAULT false,
    "agentApproved" BOOLEAN NOT NULL DEFAULT false,
    "complianceApproved" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "aiRiskScore" INTEGER NOT NULL DEFAULT 0,
    "aiRiskFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NilDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NilDisclosure" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "universityId" TEXT,
    "dealType" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "dealValueCents" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "platforms" TEXT[],
    "status" "NilDisclosureStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "aiGeneratedSummary" TEXT,
    "aiComplianceFlags" JSONB,
    "aiStateRules" JSONB,
    "aiNcaaRules" JSONB,
    "contractUrl" TEXT,
    "supportingDocUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NilDisclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appearance" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "brandId" TEXT,
    "nilDealId" TEXT,
    "type" "AppearanceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "city" TEXT,
    "state" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "compensationCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "confirmationCode" TEXT,
    "guardinApprovalId" TEXT,
    "travelIncluded" BOOLEAN NOT NULL DEFAULT false,
    "travelDetails" JSONB,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "proofUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxDocument" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT,
    "creatorId" TEXT,
    "type" "TaxDocumentType" NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" "TaxDocumentStatus" NOT NULL DEFAULT 'REQUESTED',
    "documentUrl" TEXT,
    "ssn_last4" TEXT,
    "businessName" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "totalAmountCents" INTEGER,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FmvAssessment" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT,
    "creatorId" TEXT,
    "dealType" TEXT NOT NULL,
    "sport" TEXT,
    "platform" TEXT,
    "followersCount" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "marketTier" TEXT,
    "fmvMinCents" INTEGER NOT NULL,
    "fmvMaxCents" INTEGER NOT NULL,
    "fmvMedianCents" INTEGER NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "comparableDeals" JSONB,
    "eligibilityRisk" TEXT,
    "aiModel" TEXT NOT NULL,
    "riskFlags" JSONB,
    "rawFactors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FmvAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReport" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "athleteCount" INTEGER NOT NULL DEFAULT 0,
    "dealCount" INTEGER NOT NULL DEFAULT 0,
    "totalValueCents" INTEGER NOT NULL DEFAULT 0,
    "disclosureCount" INTEGER NOT NULL DEFAULT 0,
    "pendingDisclosures" INTEGER NOT NULL DEFAULT 0,
    "flaggedDeals" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "aiRiskNarrative" TEXT,
    "aiRecommendations" JSONB,
    "dealsByType" JSONB,
    "dealsBySport" JSONB,
    "dealsTimeline" JSONB,
    "topEarners" JSONB,
    "pdfUrl" TEXT,
    "csvUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteGraphNode" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "clusterId" TEXT,
    "clusterLabel" TEXT,
    "centralityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "influenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "botNetworkScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "audienceOverlap" JSONB,
    "crossSportReach" JSONB,
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brandFitScores" JSONB,
    "embeddingVector" DOUBLE PRECISION[],
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteGraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractNilExtension" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "athleteId" TEXT,
    "nilDealId" TEXT,
    "isNilContract" BOOLEAN NOT NULL DEFAULT true,
    "ncaaCompliant" BOOLEAN,
    "stateCompliant" BOOLEAN,
    "universityApproved" BOOLEAN NOT NULL DEFAULT false,
    "universityApprovedAt" TIMESTAMP(3),
    "guardianSignatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "guardianSignedAt" TIMESTAMP(3),
    "guardianSignerIp" TEXT,
    "agentSignatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "agentSignedAt" TIMESTAMP(3),
    "disclosureId" TEXT,
    "applicableStateLaws" TEXT[],
    "ncaaRules" JSONB,
    "exclusivitySports" TEXT[],
    "fmvVerified" BOOLEAN NOT NULL DEFAULT false,
    "fmvAssessmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractNilExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requestCount" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NilMarketplaceListing" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT,
    "sport" TEXT NOT NULL,
    "preferredDealTypes" TEXT[],
    "minDealValueCents" INTEGER NOT NULL DEFAULT 0,
    "socialFollowersTotal" INTEGER NOT NULL DEFAULT 0,
    "engagementRatePct" DOUBLE PRECISION,
    "audienceAgeRange" TEXT,
    "audienceGenderSplit" JSONB,
    "topAudienceLocations" TEXT[],
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "featuredImageUrl" TEXT,
    "verifiedByPlatform" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NilMarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScimToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantType" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "description" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScimToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "mappingConfig" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoom" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" "DealRoomStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomMessage" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "clauseRef" TEXT,
    "type" "DealRoomMessageType" NOT NULL DEFAULT 'COMMENT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealRoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomProposal" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "aiRiskDelta" INTEGER,
    "aiSummary" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRoomProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectiveMember" (
    "id" TEXT NOT NULL,
    "collectiveId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "status" "CollectiveMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectiveMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectiveDonor" (
    "id" TEXT NOT NULL,
    "collectiveId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "totalDonatedCents" INTEGER NOT NULL DEFAULT 0,
    "donationCount" INTEGER NOT NULL DEFAULT 0,
    "lastDonatedAt" TIMESTAMP(3),
    "dwollaCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectiveDonor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectiveDonation" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "collectiveId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dwollaTransferId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "note" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "donatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectiveDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectiveDistribution" (
    "id" TEXT NOT NULL,
    "collectiveId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dwollaTransferId" TEXT,
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "taxYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectiveDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRequest" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "campaignId" TEXT,
    "brief" TEXT NOT NULL,
    "budgetCents" INTEGER,
    "targetNiche" TEXT[],
    "targetPlatforms" TEXT[],
    "targetMinFollowers" INTEGER,
    "targetMaxFollowers" INTEGER,
    "targetMinEngagement" DOUBLE PRECISION,
    "targetEntityType" TEXT NOT NULL DEFAULT 'creator',
    "targetSport" TEXT,
    "maxResults" INTEGER NOT NULL DEFAULT 10,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "creatorId" TEXT,
    "athleteId" TEXT,
    "rank" INTEGER NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "audienceAlignScore" DOUBLE PRECISION NOT NULL,
    "performanceScore" DOUBLE PRECISION NOT NULL,
    "fraudScore" DOUBLE PRECISION NOT NULL,
    "suggestedRateCents" INTEGER,
    "estimatedReach" INTEGER,
    "estimatedRoi" DOUBLE PRECISION,
    "reasoning" TEXT NOT NULL,
    "aiFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_userId_key" ON "Brand"("userId");

-- CreateIndex
CREATE INDEX "Brand_userId_idx" ON "Brand"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_userId_key" ON "Creator"("userId");

-- CreateIndex
CREATE INDEX "Creator_userId_idx" ON "Creator"("userId");

-- CreateIndex
CREATE INDEX "Creator_handle_idx" ON "Creator"("handle");

-- CreateIndex
CREATE INDEX "Creator_performanceScore_idx" ON "Creator"("performanceScore");

-- CreateIndex
CREATE INDEX "Creator_followersCount_idx" ON "Creator"("followersCount");

-- CreateIndex
CREATE INDEX "Creator_engagementRate_idx" ON "Creator"("engagementRate");

-- CreateIndex
CREATE INDEX "Creator_fraudScore_idx" ON "Creator"("fraudScore");

-- CreateIndex
CREATE INDEX "Creator_audienceScore_idx" ON "Creator"("audienceScore");

-- CreateIndex
CREATE INDEX "Creator_pricingTier_idx" ON "Creator"("pricingTier");

-- CreateIndex
CREATE INDEX "Creator_isVerified_idx" ON "Creator"("isVerified");

-- CreateIndex
CREATE INDEX "Creator_primaryPlatform_idx" ON "Creator"("primaryPlatform");

-- CreateIndex
CREATE INDEX "Creator_createdAt_idx" ON "Creator"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_userId_key" ON "Agency"("userId");

-- CreateIndex
CREATE INDEX "Agency_userId_idx" ON "Agency"("userId");

-- CreateIndex
CREATE INDEX "Contract_brandId_idx" ON "Contract"("brandId");

-- CreateIndex
CREATE INDEX "Contract_creatorId_idx" ON "Contract"("creatorId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "ContractTemplate_isPublic_idx" ON "ContractTemplate"("isPublic");

-- CreateIndex
CREATE INDEX "ContractTemplate_isNilTemplate_idx" ON "ContractTemplate"("isNilTemplate");

-- CreateIndex
CREATE INDEX "ContractVersion_contractId_idx" ON "ContractVersion"("contractId");

-- CreateIndex
CREATE INDEX "ContractClause_contractId_idx" ON "ContractClause"("contractId");

-- CreateIndex
CREATE INDEX "Deliverable_contractId_idx" ON "Deliverable"("contractId");

-- CreateIndex
CREATE INDEX "Deliverable_creatorId_idx" ON "Deliverable"("creatorId");

-- CreateIndex
CREATE INDEX "Deliverable_status_idx" ON "Deliverable"("status");

-- CreateIndex
CREATE INDEX "Deliverable_creatorId_status_idx" ON "Deliverable"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Deliverable_dueDate_idx" ON "Deliverable"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_deliverableId_key" ON "Payment"("deliverableId");

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_contractId_status_idx" ON "Payment"("contractId", "status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentMilestone_contractId_idx" ON "PaymentMilestone"("contractId");

-- CreateIndex
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_brandId_status_idx" ON "Campaign"("brandId", "status");

-- CreateIndex
CREATE INDEX "Campaign_deletedAt_idx" ON "Campaign"("deletedAt");

-- CreateIndex
CREATE INDEX "CampaignTask_campaignId_idx" ON "CampaignTask"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignTask_campaignId_completed_idx" ON "CampaignTask"("campaignId", "completed");

-- CreateIndex
CREATE INDEX "CampaignSummary_campaignId_idx" ON "CampaignSummary"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorGraphNode_creatorId_key" ON "CreatorGraphNode"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorGraphEdge_sourceId_idx" ON "CreatorGraphEdge"("sourceId");

-- CreateIndex
CREATE INDEX "CreatorGraphEdge_targetId_idx" ON "CreatorGraphEdge"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorGraphEdge_sourceId_targetId_key" ON "CreatorGraphEdge"("sourceId", "targetId");

-- CreateIndex
CREATE INDEX "CreatorPrediction_creatorId_idx" ON "CreatorPrediction"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "AIModel_name_version_key" ON "AIModel"("name", "version");

-- CreateIndex
CREATE INDEX "AIRequest_modelType_idx" ON "AIRequest"("modelType");

-- CreateIndex
CREATE INDEX "AIRequest_resourceType_resourceId_idx" ON "AIRequest"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AIRequest_status_idx" ON "AIRequest"("status");

-- CreateIndex
CREATE INDEX "AIRequest_createdAt_idx" ON "AIRequest"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureVector_entityType_entityId_idx" ON "FeatureVector"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FeatureVector_creatorId_idx" ON "FeatureVector"("creatorId");

-- CreateIndex
CREATE INDEX "FeatureVector_featureSet_idx" ON "FeatureVector"("featureSet");

-- CreateIndex
CREATE INDEX "FeatureVector_computedAt_idx" ON "FeatureVector"("computedAt");

-- CreateIndex
CREATE INDEX "EmbeddingRecord_entityType_entityId_idx" ON "EmbeddingRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EmbeddingRecord_creatorId_idx" ON "EmbeddingRecord"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingRecord_entityType_entityId_embeddingType_model_key" ON "EmbeddingRecord"("entityType", "entityId", "embeddingType", "model");

-- CreateIndex
CREATE INDEX "ModelRegistry_type_isActive_idx" ON "ModelRegistry"("type", "isActive");

-- CreateIndex
CREATE INDEX "ModelRegistry_isChampion_idx" ON "ModelRegistry"("isChampion");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRegistry_name_version_key" ON "ModelRegistry"("name", "version");

-- CreateIndex
CREATE INDEX "ModelDriftAlert_modelId_idx" ON "ModelDriftAlert"("modelId");

-- CreateIndex
CREATE INDEX "ModelDriftAlert_severity_resolved_idx" ON "ModelDriftAlert"("severity", "resolved");

-- CreateIndex
CREATE INDEX "ModelDriftAlert_createdAt_idx" ON "ModelDriftAlert"("createdAt");

-- CreateIndex
CREATE INDEX "DataFlywheelEvent_eventType_idx" ON "DataFlywheelEvent"("eventType");

-- CreateIndex
CREATE INDEX "DataFlywheelEvent_sourceEntity_sourceId_idx" ON "DataFlywheelEvent"("sourceEntity", "sourceId");

-- CreateIndex
CREATE INDEX "DataFlywheelEvent_processed_createdAt_idx" ON "DataFlywheelEvent"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_idx" ON "Notification"("recipientId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "University_ncaaSchoolId_key" ON "University"("ncaaSchoolId");

-- CreateIndex
CREATE INDEX "University_state_idx" ON "University"("state");

-- CreateIndex
CREATE INDEX "University_division_idx" ON "University"("division");

-- CreateIndex
CREATE INDEX "University_ncaaSchoolId_idx" ON "University"("ncaaSchoolId");

-- CreateIndex
CREATE INDEX "AthleticDepartment_universityId_idx" ON "AthleticDepartment"("universityId");

-- CreateIndex
CREATE INDEX "AthleticDepartment_sport_idx" ON "AthleticDepartment"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "AthleticDepartment_universityId_sport_gender_key" ON "AthleticDepartment"("universityId", "sport", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceOfficer_userId_key" ON "ComplianceOfficer"("userId");

-- CreateIndex
CREATE INDEX "ComplianceOfficer_universityId_idx" ON "ComplianceOfficer"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_userId_key" ON "Athlete"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_ncaaId_key" ON "Athlete"("ncaaId");

-- CreateIndex
CREATE INDEX "Athlete_userId_idx" ON "Athlete"("userId");

-- CreateIndex
CREATE INDEX "Athlete_universityId_idx" ON "Athlete"("universityId");

-- CreateIndex
CREATE INDEX "Athlete_sport_idx" ON "Athlete"("sport");

-- CreateIndex
CREATE INDEX "Athlete_status_idx" ON "Athlete"("status");

-- CreateIndex
CREATE INDEX "Athlete_eligibilityStatus_idx" ON "Athlete"("eligibilityStatus");

-- CreateIndex
CREATE INDEX "Athlete_nilActive_idx" ON "Athlete"("nilActive");

-- CreateIndex
CREATE INDEX "Athlete_performanceScore_idx" ON "Athlete"("performanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_userId_key" ON "Guardian"("userId");

-- CreateIndex
CREATE INDEX "Guardian_userId_idx" ON "Guardian"("userId");

-- CreateIndex
CREATE INDEX "GuardianRelationship_guardianId_idx" ON "GuardianRelationship"("guardianId");

-- CreateIndex
CREATE INDEX "GuardianRelationship_athleteId_idx" ON "GuardianRelationship"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelationship_guardianId_athleteId_key" ON "GuardianRelationship"("guardianId", "athleteId");

-- CreateIndex
CREATE INDEX "GuardianApproval_guardianId_idx" ON "GuardianApproval"("guardianId");

-- CreateIndex
CREATE INDEX "GuardianApproval_resourceType_resourceId_idx" ON "GuardianApproval"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "GuardianApproval_status_idx" ON "GuardianApproval"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE INDEX "AgentProfile_userId_idx" ON "AgentProfile"("userId");

-- CreateIndex
CREATE INDEX "AgentRepresentation_agentId_idx" ON "AgentRepresentation"("agentId");

-- CreateIndex
CREATE INDEX "AgentRepresentation_athleteId_idx" ON "AgentRepresentation"("athleteId");

-- CreateIndex
CREATE INDEX "AgentRepresentation_isActive_idx" ON "AgentRepresentation"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRepresentation_agentId_athleteId_key" ON "AgentRepresentation"("agentId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "NilCollective_slug_key" ON "NilCollective"("slug");

-- CreateIndex
CREATE INDEX "NilCollective_universityId_idx" ON "NilCollective"("universityId");

-- CreateIndex
CREATE INDEX "NilCollective_sport_idx" ON "NilCollective"("sport");

-- CreateIndex
CREATE INDEX "NilDeal_athleteId_idx" ON "NilDeal"("athleteId");

-- CreateIndex
CREATE INDEX "NilDeal_collectiveId_idx" ON "NilDeal"("collectiveId");

-- CreateIndex
CREATE INDEX "NilDeal_brandId_idx" ON "NilDeal"("brandId");

-- CreateIndex
CREATE INDEX "NilDeal_status_idx" ON "NilDeal"("status");

-- CreateIndex
CREATE INDEX "NilDeal_createdAt_idx" ON "NilDeal"("createdAt");

-- CreateIndex
CREATE INDEX "NilDisclosure_athleteId_idx" ON "NilDisclosure"("athleteId");

-- CreateIndex
CREATE INDEX "NilDisclosure_universityId_idx" ON "NilDisclosure"("universityId");

-- CreateIndex
CREATE INDEX "NilDisclosure_status_idx" ON "NilDisclosure"("status");

-- CreateIndex
CREATE INDEX "NilDisclosure_createdAt_idx" ON "NilDisclosure"("createdAt");

-- CreateIndex
CREATE INDEX "Appearance_athleteId_idx" ON "Appearance"("athleteId");

-- CreateIndex
CREATE INDEX "Appearance_brandId_idx" ON "Appearance"("brandId");

-- CreateIndex
CREATE INDEX "Appearance_scheduledAt_idx" ON "Appearance"("scheduledAt");

-- CreateIndex
CREATE INDEX "Appearance_status_idx" ON "Appearance"("status");

-- CreateIndex
CREATE INDEX "TaxDocument_athleteId_idx" ON "TaxDocument"("athleteId");

-- CreateIndex
CREATE INDEX "TaxDocument_creatorId_idx" ON "TaxDocument"("creatorId");

-- CreateIndex
CREATE INDEX "TaxDocument_taxYear_idx" ON "TaxDocument"("taxYear");

-- CreateIndex
CREATE INDEX "TaxDocument_type_status_idx" ON "TaxDocument"("type", "status");

-- CreateIndex
CREATE INDEX "FmvAssessment_athleteId_idx" ON "FmvAssessment"("athleteId");

-- CreateIndex
CREATE INDEX "FmvAssessment_creatorId_idx" ON "FmvAssessment"("creatorId");

-- CreateIndex
CREATE INDEX "FmvAssessment_dealType_idx" ON "FmvAssessment"("dealType");

-- CreateIndex
CREATE INDEX "FmvAssessment_createdAt_idx" ON "FmvAssessment"("createdAt");

-- CreateIndex
CREATE INDEX "ComplianceReport_universityId_idx" ON "ComplianceReport"("universityId");

-- CreateIndex
CREATE INDEX "ComplianceReport_reportType_period_idx" ON "ComplianceReport"("reportType", "period");

-- CreateIndex
CREATE INDEX "ComplianceReport_status_idx" ON "ComplianceReport"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteGraphNode_athleteId_key" ON "AthleteGraphNode"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteGraphNode_clusterId_idx" ON "AthleteGraphNode"("clusterId");

-- CreateIndex
CREATE INDEX "AthleteGraphNode_influenceScore_idx" ON "AthleteGraphNode"("influenceScore");

-- CreateIndex
CREATE UNIQUE INDEX "ContractNilExtension_contractId_key" ON "ContractNilExtension"("contractId");

-- CreateIndex
CREATE INDEX "ContractNilExtension_contractId_idx" ON "ContractNilExtension"("contractId");

-- CreateIndex
CREATE INDEX "ContractNilExtension_athleteId_idx" ON "ContractNilExtension"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "NilMarketplaceListing_athleteId_key" ON "NilMarketplaceListing"("athleteId");

-- CreateIndex
CREATE INDEX "NilMarketplaceListing_sport_idx" ON "NilMarketplaceListing"("sport");

-- CreateIndex
CREATE INDEX "NilMarketplaceListing_isVisible_idx" ON "NilMarketplaceListing"("isVisible");

-- CreateIndex
CREATE INDEX "NilMarketplaceListing_minDealValueCents_idx" ON "NilMarketplaceListing"("minDealValueCents");

-- CreateIndex
CREATE UNIQUE INDEX "ScimToken_tokenHash_key" ON "ScimToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ScimToken_tenantId_idx" ON "ScimToken"("tenantId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoom_contractId_key" ON "DealRoom"("contractId");

-- CreateIndex
CREATE INDEX "DealRoom_contractId_idx" ON "DealRoom"("contractId");

-- CreateIndex
CREATE INDEX "DealRoom_status_idx" ON "DealRoom"("status");

-- CreateIndex
CREATE INDEX "DealRoomMessage_dealRoomId_idx" ON "DealRoomMessage"("dealRoomId");

-- CreateIndex
CREATE INDEX "DealRoomMessage_authorId_idx" ON "DealRoomMessage"("authorId");

-- CreateIndex
CREATE INDEX "DealRoomMessage_dealRoomId_createdAt_idx" ON "DealRoomMessage"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "DealRoomProposal_dealRoomId_idx" ON "DealRoomProposal"("dealRoomId");

-- CreateIndex
CREATE INDEX "DealRoomProposal_proposedById_idx" ON "DealRoomProposal"("proposedById");

-- CreateIndex
CREATE INDEX "DealRoomProposal_status_idx" ON "DealRoomProposal"("status");

-- CreateIndex
CREATE INDEX "CollectiveMember_collectiveId_idx" ON "CollectiveMember"("collectiveId");

-- CreateIndex
CREATE INDEX "CollectiveMember_athleteId_idx" ON "CollectiveMember"("athleteId");

-- CreateIndex
CREATE INDEX "CollectiveMember_status_idx" ON "CollectiveMember"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CollectiveMember_collectiveId_athleteId_key" ON "CollectiveMember"("collectiveId", "athleteId");

-- CreateIndex
CREATE INDEX "CollectiveDonor_collectiveId_idx" ON "CollectiveDonor"("collectiveId");

-- CreateIndex
CREATE INDEX "CollectiveDonor_email_idx" ON "CollectiveDonor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CollectiveDonor_collectiveId_email_key" ON "CollectiveDonor"("collectiveId", "email");

-- CreateIndex
CREATE INDEX "CollectiveDonation_donorId_idx" ON "CollectiveDonation"("donorId");

-- CreateIndex
CREATE INDEX "CollectiveDonation_collectiveId_idx" ON "CollectiveDonation"("collectiveId");

-- CreateIndex
CREATE INDEX "CollectiveDonation_status_idx" ON "CollectiveDonation"("status");

-- CreateIndex
CREATE INDEX "CollectiveDonation_donatedAt_idx" ON "CollectiveDonation"("donatedAt");

-- CreateIndex
CREATE INDEX "CollectiveDistribution_collectiveId_idx" ON "CollectiveDistribution"("collectiveId");

-- CreateIndex
CREATE INDEX "CollectiveDistribution_memberId_idx" ON "CollectiveDistribution"("memberId");

-- CreateIndex
CREATE INDEX "CollectiveDistribution_athleteId_idx" ON "CollectiveDistribution"("athleteId");

-- CreateIndex
CREATE INDEX "CollectiveDistribution_status_idx" ON "CollectiveDistribution"("status");

-- CreateIndex
CREATE INDEX "CollectiveDistribution_taxYear_idx" ON "CollectiveDistribution"("taxYear");

-- CreateIndex
CREATE INDEX "MatchRequest_requestedById_idx" ON "MatchRequest"("requestedById");

-- CreateIndex
CREATE INDEX "MatchRequest_status_idx" ON "MatchRequest"("status");

-- CreateIndex
CREATE INDEX "MatchRequest_createdAt_idx" ON "MatchRequest"("createdAt");

-- CreateIndex
CREATE INDEX "MatchResult_requestId_idx" ON "MatchResult"("requestId");

-- CreateIndex
CREATE INDEX "MatchResult_creatorId_idx" ON "MatchResult"("creatorId");

-- CreateIndex
CREATE INDEX "MatchResult_athleteId_idx" ON "MatchResult"("athleteId");

-- CreateIndex
CREATE INDEX "MatchResult_rank_idx" ON "MatchResult"("rank");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractClause" ADD CONSTRAINT "ContractClause_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "PaymentMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSummary" ADD CONSTRAINT "CampaignSummary_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorGraphNode" ADD CONSTRAINT "CreatorGraphNode_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorGraphEdge" ADD CONSTRAINT "CreatorGraphEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CreatorGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorGraphEdge" ADD CONSTRAINT "CreatorGraphEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CreatorGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPrediction" ADD CONSTRAINT "CreatorPrediction_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureVector" ADD CONSTRAINT "FeatureVector_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddingRecord" ADD CONSTRAINT "EmbeddingRecord_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelDriftAlert" ADD CONSTRAINT "ModelDriftAlert_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleticDepartment" ADD CONSTRAINT "AthleticDepartment_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceOfficer" ADD CONSTRAINT "ComplianceOfficer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceOfficer" ADD CONSTRAINT "ComplianceOfficer_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_athleticDepartmentId_fkey" FOREIGN KEY ("athleticDepartmentId") REFERENCES "AthleticDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianApproval" ADD CONSTRAINT "GuardianApproval_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRepresentation" ADD CONSTRAINT "AgentRepresentation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRepresentation" ADD CONSTRAINT "AgentRepresentation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilCollective" ADD CONSTRAINT "NilCollective_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilDeal" ADD CONSTRAINT "NilDeal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilDeal" ADD CONSTRAINT "NilDeal_collectiveId_fkey" FOREIGN KEY ("collectiveId") REFERENCES "NilCollective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilDeal" ADD CONSTRAINT "NilDeal_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilDeal" ADD CONSTRAINT "NilDeal_fmvAssessmentId_fkey" FOREIGN KEY ("fmvAssessmentId") REFERENCES "FmvAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilDeal" ADD CONSTRAINT "NilDeal_disclosureId_fkey" FOREIGN KEY ("disclosureId") REFERENCES "NilDisclosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilDeal" ADD CONSTRAINT "NilDeal_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilDisclosure" ADD CONSTRAINT "NilDisclosure_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appearance" ADD CONSTRAINT "Appearance_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appearance" ADD CONSTRAINT "Appearance_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FmvAssessment" ADD CONSTRAINT "FmvAssessment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FmvAssessment" ADD CONSTRAINT "FmvAssessment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGraphNode" ADD CONSTRAINT "AthleteGraphNode_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractNilExtension" ADD CONSTRAINT "ContractNilExtension_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractNilExtension" ADD CONSTRAINT "ContractNilExtension_disclosureId_fkey" FOREIGN KEY ("disclosureId") REFERENCES "NilDisclosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilMarketplaceListing" ADD CONSTRAINT "NilMarketplaceListing_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomMessage" ADD CONSTRAINT "DealRoomMessage_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomMessage" ADD CONSTRAINT "DealRoomMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomProposal" ADD CONSTRAINT "DealRoomProposal_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomProposal" ADD CONSTRAINT "DealRoomProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveMember" ADD CONSTRAINT "CollectiveMember_collectiveId_fkey" FOREIGN KEY ("collectiveId") REFERENCES "NilCollective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveMember" ADD CONSTRAINT "CollectiveMember_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveDonor" ADD CONSTRAINT "CollectiveDonor_collectiveId_fkey" FOREIGN KEY ("collectiveId") REFERENCES "NilCollective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveDonation" ADD CONSTRAINT "CollectiveDonation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "CollectiveDonor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveDonation" ADD CONSTRAINT "CollectiveDonation_collectiveId_fkey" FOREIGN KEY ("collectiveId") REFERENCES "NilCollective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveDistribution" ADD CONSTRAINT "CollectiveDistribution_collectiveId_fkey" FOREIGN KEY ("collectiveId") REFERENCES "NilCollective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveDistribution" ADD CONSTRAINT "CollectiveDistribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CollectiveMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MatchRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

