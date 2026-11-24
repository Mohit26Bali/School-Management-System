-- AlterTable
ALTER TABLE "Transport" ADD COLUMN "seats" INTEGER;

-- CreateTable
CREATE TABLE "HostelAllocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "startedOn" DATETIME NOT NULL,
    "endedOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostelAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HostelRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HostelAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportRider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transportId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "startedOn" DATETIME NOT NULL,
    "endedOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportRider_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportRider_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HostelAllocation_roomId_idx" ON "HostelAllocation"("roomId");

-- CreateIndex
CREATE INDEX "HostelAllocation_studentId_idx" ON "HostelAllocation"("studentId");

-- CreateIndex
CREATE INDEX "TransportRider_transportId_idx" ON "TransportRider"("transportId");

-- CreateIndex
CREATE INDEX "TransportRider_studentId_idx" ON "TransportRider"("studentId");
