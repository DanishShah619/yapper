-- AlterTable
ALTER TABLE "messages" ADD COLUMN "fileId" TEXT;

-- CreateIndex
CREATE INDEX "messages_fileId_idx" ON "messages"("fileId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
