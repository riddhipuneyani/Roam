-- Trip.shareToken: set when sharing is enabled, cleared to revoke the link
ALTER TABLE "Trip" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Trip_shareToken_key" ON "Trip"("shareToken");

-- TripExpense.addedByName: required attribution for every ledger entry.
-- Existing rows were all created by trip owners through the authenticated
-- dashboard, so backfill each with the owning user's name.
ALTER TABLE "TripExpense" ADD COLUMN "addedByName" TEXT NOT NULL DEFAULT 'Trip owner';

UPDATE "TripExpense" AS e
SET "addedByName" = u."name"
FROM "Trip" AS t
JOIN "User" AS u ON u."id" = t."userId"
WHERE e."tripId" = t."id";

ALTER TABLE "TripExpense" ALTER COLUMN "addedByName" DROP DEFAULT;
