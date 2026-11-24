-- CreateTable
CREATE TABLE "ExamResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "marksObtained" REAL NOT NULL,
    "maxMarks" REAL NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "examId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gender" TEXT,
    "dob" DATETIME,
    "class" TEXT,
    "section" TEXT,
    "religion" TEXT,
    "joiningDate" DATETIME,
    "mobile" TEXT,
    "admissionNumber" TEXT,
    "imageUrl" TEXT,
    "fatherName" TEXT,
    "fatherOccupation" TEXT,
    "fatherMobile" TEXT,
    "fatherEmail" TEXT,
    "motherName" TEXT,
    "motherOccupation" TEXT,
    "motherMobile" TEXT,
    "motherEmail" TEXT,
    "presentAddress" TEXT,
    "permanentAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("admissionNumber", "class", "createdAt", "dob", "fatherEmail", "fatherMobile", "fatherName", "fatherOccupation", "firstName", "gender", "id", "imageUrl", "joiningDate", "lastName", "mobile", "motherEmail", "motherMobile", "motherName", "motherOccupation", "permanentAddress", "presentAddress", "religion", "section", "studentId") SELECT "admissionNumber", "class", "createdAt", "dob", "fatherEmail", "fatherMobile", "fatherName", "fatherOccupation", "firstName", "gender", "id", "imageUrl", "joiningDate", "lastName", "mobile", "motherEmail", "motherMobile", "motherName", "motherOccupation", "permanentAddress", "presentAddress", "religion", "section", "studentId" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
