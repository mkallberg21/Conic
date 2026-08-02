-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'X', 'FACEBOOK', 'TWITCH', 'LINKEDIN', 'SNAPCHAT', 'PINTEREST', 'THREADS', 'OTHER');

-- CreateEnum
CREATE TYPE "SocialVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "aestheticTags" TEXT[],
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contentStyle" TEXT[],
ADD COLUMN     "country" TEXT,
ADD COLUMN     "languages" TEXT[],
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "aestheticTags" TEXT[],
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contentStyle" TEXT[],
ADD COLUMN     "country" TEXT,
ADD COLUMN     "languages" TEXT[],
ADD COLUMN     "region" TEXT;

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "creatorId" TEXT,
    "athleteId" TEXT,
    "platform" "SocialPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "url" TEXT,
    "followerCount" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "SocialVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationMethod" TEXT,
    "verificationCode" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialAccount_creatorId_idx" ON "SocialAccount"("creatorId");

-- CreateIndex
CREATE INDEX "SocialAccount_athleteId_idx" ON "SocialAccount"("athleteId");

-- CreateIndex
CREATE INDEX "SocialAccount_platform_handle_idx" ON "SocialAccount"("platform", "handle");

-- CreateIndex
CREATE INDEX "SocialAccount_ownerType_idx" ON "SocialAccount"("ownerType");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_creatorId_platform_handle_key" ON "SocialAccount"("creatorId", "platform", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_athleteId_platform_handle_key" ON "SocialAccount"("athleteId", "platform", "handle");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

