-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "approxLat" DOUBLE PRECISION,
ADD COLUMN     "approxLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "approxLat" DOUBLE PRECISION,
ADD COLUMN     "approxLng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ProfileView" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT,
    "athleteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProfile" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT,
    "athleteId" TEXT,
    "campaignId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileView_creatorId_createdAt_idx" ON "ProfileView"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileView_athleteId_createdAt_idx" ON "ProfileView"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileView_brandId_createdAt_idx" ON "ProfileView"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedProfile_brandId_createdAt_idx" ON "SavedProfile"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedProfile_campaignId_idx" ON "SavedProfile"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProfile_brandId_creatorId_key" ON "SavedProfile"("brandId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProfile_brandId_athleteId_key" ON "SavedProfile"("brandId", "athleteId");

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProfile" ADD CONSTRAINT "SavedProfile_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProfile" ADD CONSTRAINT "SavedProfile_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProfile" ADD CONSTRAINT "SavedProfile_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

