-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketingEmailsOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ScheduledEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledEmail_sentAt_sendAt_idx" ON "ScheduledEmail"("sentAt", "sendAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledEmail_userId_kind_key" ON "ScheduledEmail"("userId", "kind");

-- AddForeignKey
ALTER TABLE "ScheduledEmail" ADD CONSTRAINT "ScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
