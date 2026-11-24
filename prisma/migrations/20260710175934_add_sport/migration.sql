-- CreateTable
CREATE TABLE "Sport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sportsId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coachName" TEXT,
    "startedYear" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Sport_sportsId_key" ON "Sport"("sportsId");
