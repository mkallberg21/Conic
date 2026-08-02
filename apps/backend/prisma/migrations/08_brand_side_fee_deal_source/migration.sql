-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('MATCHMAKING', 'SELF_SERVE', 'DIRECT');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "dealSource" "DealSource" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "brandChargeCents" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "platformFeeRate" SET DEFAULT 0.12;

