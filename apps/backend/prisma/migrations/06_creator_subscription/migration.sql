-- CreateEnum
CREATE TYPE "CreatorPlan" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "isPro" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "isPro" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "CreatorPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "dmCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_plan_status_idx" ON "Subscription"("plan", "status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

