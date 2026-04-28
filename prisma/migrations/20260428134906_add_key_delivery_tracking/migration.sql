-- CreateEnum
CREATE TYPE "KeyDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'ACKNOWLEDGED', 'DECRYPTED');

-- AlterTable
ALTER TABLE "room_key_shards" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "decryptedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryStatus" "KeyDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "lastRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "room_key_shards_roomId_deliveryStatus_idx" ON "room_key_shards"("roomId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "room_key_shards_deliveryStatus_createdAt_idx" ON "room_key_shards"("deliveryStatus", "createdAt");
