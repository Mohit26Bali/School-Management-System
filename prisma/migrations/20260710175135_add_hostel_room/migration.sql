-- CreateTable
CREATE TABLE "HostelRoom" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "block" TEXT NOT NULL,
    "roomNo" TEXT NOT NULL,
    "roomType" TEXT,
    "noOfBeds" INTEGER,
    "costPerBed" REAL,
    "availability" TEXT NOT NULL DEFAULT 'Available',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "HostelRoom_block_roomNo_key" ON "HostelRoom"("block", "roomNo");
