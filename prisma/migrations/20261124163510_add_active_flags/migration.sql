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
    "active" BOOLEAN NOT NULL DEFAULT true,
    "leftOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("admissionNumber", "classId", "createdAt", "dob", "fatherEmail", "fatherMobile", "fatherName", "fatherOccupation", "firstName", "gender", "id", "imageUrl", "joiningDate", "lastName", "mobile", "motherEmail", "motherMobile", "motherName", "motherOccupation", "permanentAddress", "presentAddress", "religion", "studentId", "userId") SELECT "admissionNumber", "classId", "createdAt", "dob", "fatherEmail", "fatherMobile", "fatherName", "fatherOccupation", "firstName", "gender", "id", "imageUrl", "joiningDate", "lastName", "mobile", "motherEmail", "motherMobile", "motherName", "motherOccupation", "permanentAddress", "presentAddress", "religion", "studentId", "userId" FROM "Student";
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
    "classId" INTEGER,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "leftOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    CONSTRAINT "Teacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Teacher" ("address", "city", "classId", "country", "createdAt", "dob", "experience", "gender", "id", "imageUrl", "joiningDate", "mobile", "name", "qualification", "state", "teacherId", "userId", "zipCode") SELECT "address", "city", "classId", "country", "createdAt", "dob", "experience", "gender", "id", "imageUrl", "joiningDate", "mobile", "name", "qualification", "state", "teacherId", "userId", "zipCode" FROM "Teacher";
DROP TABLE "Teacher";
ALTER TABLE "new_Teacher" RENAME TO "Teacher";
CREATE UNIQUE INDEX "Teacher_teacherId_key" ON "Teacher"("teacherId");
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "avatarUrl" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpiry" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "email", "id", "name", "passwordHash", "resetTokenExpiry", "resetTokenHash", "role") SELECT "avatarUrl", "createdAt", "email", "id", "name", "passwordHash", "resetTokenExpiry", "resetTokenHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
