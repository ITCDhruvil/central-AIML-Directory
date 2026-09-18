-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "suggestedTool" TEXT,
    "relatedProjectName" TEXT,
    "sourceUrls" TEXT NOT NULL DEFAULT '[]',
    "savedAsIdea" BOOLEAN NOT NULL DEFAULT false,
    "lastChange" TEXT,
    "firstGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Insight_scope_fingerprint_key" ON "Insight"("scope", "fingerprint");
CREATE INDEX "Insight_scope_lastGeneratedAt_idx" ON "Insight"("scope", "lastGeneratedAt");

-- CreateTable
CREATE TABLE "InsightGeneration" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "unchangedCount" INTEGER NOT NULL,
    "addedTitles" TEXT NOT NULL DEFAULT '[]',
    "updatedTitles" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "InsightGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InsightGeneration_scope_generatedAt_idx" ON "InsightGeneration"("scope", "generatedAt");
