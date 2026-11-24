-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT,
    "department" TEXT,
    "class" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In Stock',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_bookId_key" ON "Book"("bookId");
