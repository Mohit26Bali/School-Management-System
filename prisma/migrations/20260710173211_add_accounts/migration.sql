-- CreateTable
CREATE TABLE "Fee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feesId" TEXT NOT NULL,
    "feesType" TEXT NOT NULL,
    "class" TEXT,
    "amount" REAL NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FeesCollection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feesType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paidDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" INTEGER NOT NULL,
    CONSTRAINT "FeesCollection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "expensesId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemQuality" TEXT,
    "amount" REAL NOT NULL,
    "sourceOfPurchase" TEXT,
    "purchaseDate" DATETIME,
    "purchaseBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Salary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" REAL NOT NULL,
    "paymentDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teacherId" INTEGER NOT NULL,
    CONSTRAINT "Salary_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Fee_feesId_key" ON "Fee"("feesId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expensesId_key" ON "Expense"("expensesId");
