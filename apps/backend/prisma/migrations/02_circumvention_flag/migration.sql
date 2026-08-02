-- CreateTable
CREATE TABLE "CircumventionFlag" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "contractId" TEXT,
    "dealRoomId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "brandId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "categories" TEXT[],
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircumventionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircumventionFlag_brandId_idx" ON "CircumventionFlag"("brandId");

-- CreateIndex
CREATE INDEX "CircumventionFlag_dealRoomId_idx" ON "CircumventionFlag"("dealRoomId");

-- CreateIndex
CREATE INDEX "CircumventionFlag_createdAt_idx" ON "CircumventionFlag"("createdAt");

