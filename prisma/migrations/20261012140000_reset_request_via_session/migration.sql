-- AlterTable
ALTER TABLE "PasswordResetRequest" ADD COLUMN     "viaSession" BOOLEAN NOT NULL DEFAULT false;
