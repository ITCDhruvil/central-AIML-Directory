-- CreateTable
CREATE TABLE "ProjectEnvironment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isProduction" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "appUrl" TEXT,
    "apiUrl" TEXT,
    "healthUrl" TEXT,
    "hosting" TEXT,
    "databaseSet" TEXT,
    "version" TEXT,
    "lastDeployedAt" TIMESTAMP(3),
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentLink" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "group" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentCredential" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT,
    "notes" TEXT,
    "passwordUpdatedByName" TEXT,
    "passwordUpdatedAt" TIMESTAMP(3),
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectEnvironment_projectId_position_idx" ON "ProjectEnvironment"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEnvironment_projectId_name_key" ON "ProjectEnvironment"("projectId", "name");

-- CreateIndex
CREATE INDEX "EnvironmentLink_environmentId_position_idx" ON "EnvironmentLink"("environmentId", "position");

-- CreateIndex
CREATE INDEX "EnvironmentCredential_environmentId_idx" ON "EnvironmentCredential"("environmentId");

-- AddForeignKey
ALTER TABLE "ProjectEnvironment" ADD CONSTRAINT "ProjectEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentLink" ADD CONSTRAINT "EnvironmentLink_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "ProjectEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentCredential" ADD CONSTRAINT "EnvironmentCredential_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "ProjectEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
