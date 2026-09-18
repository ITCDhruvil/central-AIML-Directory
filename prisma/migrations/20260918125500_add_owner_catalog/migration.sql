-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Owner_name_key" ON "Owner"("name");

-- Seed the catalog from names already stored on projects and ideas.
INSERT INTO "Owner" ("id", "name", "createdAt")
SELECT 'own_' || md5(names.name), names.name, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT TRIM("owner") AS name FROM "Project" WHERE "owner" IS NOT NULL AND TRIM("owner") <> ''
    UNION
    SELECT DISTINCT TRIM("owner") AS name FROM "Idea" WHERE "owner" IS NOT NULL AND TRIM("owner") <> ''
) AS names
ON CONFLICT ("name") DO NOTHING;
