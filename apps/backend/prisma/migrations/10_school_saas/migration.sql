-- CreateEnum
CREATE TYPE "InstitutionPlan" AS ENUM ('NONE', 'CAMPUS', 'DEPARTMENT', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "SchoolSubscription" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "plan" "InstitutionPlan" NOT NULL DEFAULT 'NONE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubscription_universityId_key" ON "SchoolSubscription"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubscription_providerSubscriptionId_key" ON "SchoolSubscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "SchoolSubscription_plan_status_idx" ON "SchoolSubscription"("plan", "status");

-- AddForeignKey
ALTER TABLE "SchoolSubscription" ADD CONSTRAINT "SchoolSubscription_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

