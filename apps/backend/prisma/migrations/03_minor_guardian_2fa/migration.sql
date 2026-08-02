-- CreateEnum
CREATE TYPE "GuardianInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'PHONE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "isMinor" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "isMinor" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GuardianRelationship" ADD COLUMN     "creatorId" TEXT,
ALTER COLUMN "athleteId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GuardianInvite" (
    "id" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "athleteId" TEXT,
    "creatorId" TEXT,
    "guardianEmail" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'parent',
    "tokenHash" TEXT NOT NULL,
    "status" "GuardianInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedGuardianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'onboarding',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianInvite_tokenHash_key" ON "GuardianInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "GuardianInvite_guardianEmail_idx" ON "GuardianInvite"("guardianEmail");

-- CreateIndex
CREATE INDEX "GuardianInvite_athleteId_idx" ON "GuardianInvite"("athleteId");

-- CreateIndex
CREATE INDEX "GuardianInvite_creatorId_idx" ON "GuardianInvite"("creatorId");

-- CreateIndex
CREATE INDEX "GuardianInvite_status_idx" ON "GuardianInvite"("status");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_channel_idx" ON "VerificationCode"("userId", "channel");

-- CreateIndex
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");

-- CreateIndex
CREATE INDEX "Creator_isMinor_idx" ON "Creator"("isMinor");

-- CreateIndex
CREATE INDEX "Athlete_isMinor_idx" ON "Athlete"("isMinor");

-- CreateIndex
CREATE INDEX "GuardianRelationship_creatorId_idx" ON "GuardianRelationship"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelationship_guardianId_creatorId_key" ON "GuardianRelationship"("guardianId", "creatorId");

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInvite" ADD CONSTRAINT "GuardianInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInvite" ADD CONSTRAINT "GuardianInvite_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianInvite" ADD CONSTRAINT "GuardianInvite_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

