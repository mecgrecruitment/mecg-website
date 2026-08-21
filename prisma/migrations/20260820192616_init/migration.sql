-- CreateTable
CREATE TABLE "Pnm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "checkinToken" TEXT NOT NULL,
    "checkinOpensAt" DATETIME NOT NULL,
    "checkinClosesAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pnmId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Checkin_pnmId_fkey" FOREIGN KEY ("pnmId") REFERENCES "Pnm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Checkin_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Pnm_contact_key" ON "Pnm"("contact");

-- CreateIndex
CREATE UNIQUE INDEX "Event_checkinToken_key" ON "Event"("checkinToken");

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_pnmId_eventId_key" ON "Checkin"("pnmId", "eventId");
