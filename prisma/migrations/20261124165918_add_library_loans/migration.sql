-- CreateTable
CREATE TABLE "Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "issuedOn" DATETIME NOT NULL,
    "dueOn" DATETIME NOT NULL,
    "returnedOn" DATETIME,
    "fine" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Loan_bookId_idx" ON "Loan"("bookId");

-- CreateIndex
CREATE INDEX "Loan_studentId_idx" ON "Loan"("studentId");
