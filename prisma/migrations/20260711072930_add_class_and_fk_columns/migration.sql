-- CreateTable
CREATE TABLE "Class" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TeacherSubject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teacherId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    CONSTRAINT "TeacherSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "section" TEXT,
    "classId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("class", "createdAt", "date", "id", "section", "status", "studentId", "teacherId") SELECT "class", "createdAt", "date", "id", "section", "status", "studentId", "teacherId" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE UNIQUE INDEX "Attendance_studentId_date_key" ON "Attendance"("studentId", "date");
CREATE TABLE "new_Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT,
    "department" TEXT,
    "class" TEXT,
    "classId" INTEGER,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In Stock',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Book_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Book" ("bookId", "class", "createdAt", "department", "id", "language", "name", "status", "type") SELECT "bookId", "class", "createdAt", "department", "id", "language", "name", "status", "type" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_bookId_key" ON "Book"("bookId");
CREATE TABLE "new_Exam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "examName" TEXT NOT NULL,
    "class" TEXT,
    "subject" TEXT,
    "classId" INTEGER,
    "subjectId" INTEGER,
    "fees" REAL,
    "startTime" TEXT,
    "endTime" TEXT,
    "examDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Exam" ("class", "createdAt", "endTime", "examDate", "examName", "fees", "id", "startTime", "subject") SELECT "class", "createdAt", "endTime", "examDate", "examName", "fees", "id", "startTime", "subject" FROM "Exam";
DROP TABLE "Exam";
ALTER TABLE "new_Exam" RENAME TO "Exam";
CREATE TABLE "new_Fee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feesId" TEXT NOT NULL,
    "feesType" TEXT NOT NULL,
    "class" TEXT,
    "classId" INTEGER,
    "amount" REAL NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fee_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Fee" ("amount", "class", "createdAt", "endDate", "feesId", "feesType", "id", "startDate") SELECT "amount", "class", "createdAt", "endDate", "feesId", "feesType", "id", "startDate" FROM "Fee";
DROP TABLE "Fee";
ALTER TABLE "new_Fee" RENAME TO "Fee";
CREATE UNIQUE INDEX "Fee_feesId_key" ON "Fee"("feesId");
CREATE TABLE "new_Student" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gender" TEXT,
    "dob" DATETIME,
    "class" TEXT,
    "section" TEXT,
    "classId" INTEGER,
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
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("admissionNumber", "class", "createdAt", "dob", "fatherEmail", "fatherMobile", "fatherName", "fatherOccupation", "firstName", "gender", "id", "imageUrl", "joiningDate", "lastName", "mobile", "motherEmail", "motherMobile", "motherName", "motherOccupation", "permanentAddress", "presentAddress", "religion", "section", "studentId", "userId") SELECT "admissionNumber", "class", "createdAt", "dob", "fatherEmail", "fatherMobile", "fatherName", "fatherOccupation", "firstName", "gender", "id", "imageUrl", "joiningDate", "lastName", "mobile", "motherEmail", "motherMobile", "motherName", "motherOccupation", "permanentAddress", "presentAddress", "religion", "section", "studentId", "userId" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE TABLE "new_Teacher" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "dob" DATETIME,
    "mobile" TEXT,
    "joiningDate" DATETIME,
    "qualification" TEXT,
    "experience" TEXT,
    "class" TEXT,
    "subject" TEXT,
    "section" TEXT,
    "classId" INTEGER,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    CONSTRAINT "Teacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Teacher" ("address", "city", "class", "country", "createdAt", "dob", "experience", "gender", "id", "imageUrl", "joiningDate", "mobile", "name", "qualification", "section", "state", "subject", "teacherId", "userId", "zipCode") SELECT "address", "city", "class", "country", "createdAt", "dob", "experience", "gender", "id", "imageUrl", "joiningDate", "mobile", "name", "qualification", "section", "state", "subject", "teacherId", "userId", "zipCode" FROM "Teacher";
DROP TABLE "Teacher";
ALTER TABLE "new_Teacher" RENAME TO "Teacher";
CREATE UNIQUE INDEX "Teacher_teacherId_key" ON "Teacher"("teacherId");
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");
CREATE TABLE "new_TimeTableEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "class" TEXT,
    "section" TEXT,
    "subject" TEXT,
    "classId" INTEGER,
    "subjectId" INTEGER,
    "date" DATETIME,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teacherId" INTEGER NOT NULL,
    CONSTRAINT "TimeTableEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeTableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeTableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimeTableEntry" ("class", "createdAt", "date", "endTime", "id", "section", "startTime", "subject", "teacherId") SELECT "class", "createdAt", "date", "endTime", "id", "section", "startTime", "subject", "teacherId" FROM "TimeTableEntry";
DROP TABLE "TimeTableEntry";
ALTER TABLE "new_TimeTableEntry" RENAME TO "TimeTableEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Class_name_section_key" ON "Class"("name", "section");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubject_teacherId_classId_subjectId_key" ON "TeacherSubject"("teacherId", "classId", "subjectId");
