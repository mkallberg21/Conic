-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('OPEN', 'CLOSED', 'FILLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING_FUNDING', 'FUNDED', 'RELEASED', 'REFUNDED');

-- CreateTable
CREATE TABLE "MarketplaceBrief" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgetCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deliverableType" TEXT,
    "platforms" TEXT[],
    "niche" TEXT[],
    "sport" TEXT,
    "targetType" TEXT NOT NULL DEFAULT 'both',
    "minFollowers" INTEGER,
    "status" "BriefStatus" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefApplication" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "creatorId" TEXT,
    "athleteId" TEXT,
    "pitch" TEXT NOT NULL,
    "proposedRateCents" INTEGER,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escrow" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING_FUNDING',
    "provider" TEXT,
    "providerRef" TEXT,
    "fundedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceBrief_status_createdAt_idx" ON "MarketplaceBrief"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceBrief_brandId_idx" ON "MarketplaceBrief"("brandId");

-- CreateIndex
CREATE INDEX "BriefApplication_briefId_status_idx" ON "BriefApplication"("briefId", "status");

-- CreateIndex
CREATE INDEX "BriefApplication_creatorId_idx" ON "BriefApplication"("creatorId");

-- CreateIndex
CREATE INDEX "BriefApplication_athleteId_idx" ON "BriefApplication"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "BriefApplication_briefId_creatorId_key" ON "BriefApplication"("briefId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "BriefApplication_briefId_athleteId_key" ON "BriefApplication"("briefId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "Escrow_contractId_key" ON "Escrow"("contractId");

-- CreateIndex
CREATE INDEX "Escrow_brandId_idx" ON "Escrow"("brandId");

-- CreateIndex
CREATE INDEX "Escrow_status_idx" ON "Escrow"("status");

-- AddForeignKey
ALTER TABLE "MarketplaceBrief" ADD CONSTRAINT "MarketplaceBrief_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefApplication" ADD CONSTRAINT "BriefApplication_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "MarketplaceBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefApplication" ADD CONSTRAINT "BriefApplication_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefApplication" ADD CONSTRAINT "BriefApplication_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

