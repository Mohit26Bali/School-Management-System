-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "examName" TEXT NOT NULL,
    "classId" INTEGER,
    "subjectId" INTEGER,
    "fees" REAL,
    "startTime" TEXT,
    "endTime" TEXT,
    "examDate" DATETIME,
    "maxMarks" REAL NOT NULL DEFAULT 100,
    "passPercent" REAL NOT NULL DEFAULT 40,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Exam" ("classId", "createdAt", "endTime", "examDate", "examName", "fees", "id", "startTime", "subjectId") SELECT "classId", "createdAt", "endTime", "examDate", "examName", "fees", "id", "startTime", "subjectId" FROM "Exam";
DROP TABLE "Exam";
ALTER TABLE "new_Exam" RENAME TO "Exam";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_examId_studentId_key" ON "ExamResult"("examId", "studentId");

