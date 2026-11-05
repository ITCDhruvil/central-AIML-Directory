-- CreateTable
CREATE TABLE "DayNote" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayNote_scopeType_scopeId_day_idx" ON "DayNote"("scopeType", "scopeId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "DayNote_scopeType_scopeId_day_key" ON "DayNote"("scopeType", "scopeId", "day");
