-- CreateEnum
CREATE TYPE "AgeCheckMethod" AS ENUM ('ESTIMATION', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "KybTier" AS ENUM ('NONE', 'BASIC', 'ENHANCED');

-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'NEEDS_INPUT', 'APPROVED', 'DECLINED', 'EXPIRED', 'REVIEW');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageAssurance" "AgeCheckMethod",
ADD COLUMN     "ageVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ageVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "kybStatus" "IdentityStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "kybTier" "KybTier" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "AgeVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "AgeCheckMethod" NOT NULL,
    "status" "IdentityStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerSession" TEXT NOT NULL,
    "isAdult" BOOLEAN,
    "estimatedAge" INTEGER,
    "confirmedDob" TIMESTAMP(3),
    "docType" TEXT,
    "docCountry" TEXT,
    "failureReason" TEXT,
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgeVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessVerification" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tier" "KybTier" NOT NULL DEFAULT 'NONE',
    "status" "IdentityStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "provider" TEXT NOT NULL,
    "providerCase" TEXT,
    "legalName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "country" TEXT NOT NULL,
    "domain" TEXT,
    "matchedName" TEXT,
    "riskScore" INTEGER,
    "sanctionsHit" BOOLEAN NOT NULL DEFAULT false,
    "beneficialOwnersOk" BOOLEAN NOT NULL DEFAULT false,
    "youthSafetyAccepted" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "reviewNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgeVerification_providerSession_key" ON "AgeVerification"("providerSession");

-- CreateIndex
CREATE INDEX "AgeVerification_userId_status_idx" ON "AgeVerification"("userId", "status");

-- CreateIndex
CREATE INDEX "AgeVerification_status_idx" ON "AgeVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessVerification_brandId_key" ON "BusinessVerification"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessVerification_providerCase_key" ON "BusinessVerification"("providerCase");

-- CreateIndex
CREATE INDEX "BusinessVerification_status_idx" ON "BusinessVerification"("status");

-- AddForeignKey
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessVerification" ADD CONSTRAINT "BusinessVerification_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

