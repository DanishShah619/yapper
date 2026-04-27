-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "encryptedKey" TEXT;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "encryptionKey" TEXT;
