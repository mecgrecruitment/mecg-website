/*
  Warnings:

  - Existing applications receive a unique random portal token during the table copy.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portalToken" TEXT NOT NULL,
    "pnmId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_pnmId_fkey" FOREIGN KEY ("pnmId") REFERENCES "Pnm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RushCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("createdAt", "cycleId", "id", "pnmId", "portalToken", "status", "updatedAt") SELECT "createdAt", "cycleId", "id", "pnmId", lower(hex(randomblob(24))), "status", "updatedAt" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE UNIQUE INDEX "Application_portalToken_key" ON "Application"("portalToken");
CREATE INDEX "Application_cycleId_status_idx" ON "Application"("cycleId", "status");
CREATE UNIQUE INDEX "Application_pnmId_cycleId_key" ON "Application"("pnmId", "cycleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
