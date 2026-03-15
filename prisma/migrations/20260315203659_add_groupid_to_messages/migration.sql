-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "roomId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "messages_groupId_createdAt_idx" ON "messages"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
