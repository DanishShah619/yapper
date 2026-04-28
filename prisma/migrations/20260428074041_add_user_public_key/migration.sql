-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "fallbackAdminId" TEXT;

-- CreateTable
CREATE TABLE "room_key_shards" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedShard" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_key_shards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_key_shards_roomId_userId_key" ON "room_key_shards"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "room_key_shards" ADD CONSTRAINT "room_key_shards_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_key_shards" ADD CONSTRAINT "room_key_shards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
