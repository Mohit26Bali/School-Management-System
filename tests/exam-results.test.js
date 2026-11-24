// Run with: node --test tests/exam-results.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");
const { parseMarks, isPass, passMark } = require("../src/utils/grading");

let ctx, prisma, s, subject, exam, extraStudent, inactiveStudent, teacherBrowser;

before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  subject = await prisma.subject.create({ data: { subjectId: "SUB1", name: "Mathematics" } });
  exam = await prisma.exam.create({ data: { examName: "Unit Test", classId: s.classA.id, subjectId: subject.id, maxMarks: 50, passPercent: 40 } });
  extraStudent = await prisma.student.create({ data: { firstName: "Sec", lastName: "B", studentId: "S3", classId: s.classB.id } });
  inactiveStudent = await prisma.student.create({ data: { firstName: "Gone", lastName: "Away", studentId: "S4", classId: s.classA.id, active: false } });
  await prisma.teacherSubject.create({ data: { teacherId: s.teacher.id, classId: s.classA.id, subjectId: subject.id } });
  teacherBrowser = ctx.browser();
  await teacherBrowser.login("teacher@test.local", "password123", "teacher");
});
after(() => ctx.stop());

const key = (student) => `marks[student-${student.id}]`;

test("marks rules: blanks, decimals, limits and pass mark", () => {
  assert.deepEqual(parseMarks("", 100), { blank: true });
  assert.deepEqual(parseMarks("  ", 100), { blank: true });
  assert.deepEqual(parseMarks(undefined, 100), { blank: true });
  assert.deepEqual(parseMarks("72.5", 100), { value: 72.5 });
  assert.deepEqual(parseMarks("100", 100), { value: 100 });
  assert.ok(parseMarks("101", 100).error);
  assert.ok(parseMarks("-1", 100).error);
  assert.ok(parseMarks("abc", 100).error);
  assert.ok(parseMarks("1e3", 1000).error);
  assert.ok(parseMarks(["1", "2"], 100).error);
  assert.equal(isPass(20, 50, 40), true, "exactly 40% passes");
  assert.equal(isPass(19.9, 50, 40), false);
  assert.equal(isPass(1, 0, 40), false);
  assert.equal(passMark(50, 40), 20);
});

test("admin saves marks: pass or fail follows the exam's pass mark, and blank means no result", async () => {
  const admin = await ctx.adminBrowser();
  const res = await admin.send(`/exam-results/${exam.id}`, { [key(s.inClass)]: "30", [key(s.otherClass)]: "" });
  // otherClass is in section B, same class level "10": it is on the sheet too
  assert.equal(res.status, 302);

  const passing = await prisma.examResult.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: s.inClass.id } } });
  assert.equal(passing.marksObtained, 30);
  assert.equal(passing.maxMarks, 50);
  assert.equal(passing.passed, true);
  assert.equal(await prisma.examResult.count({ where: { studentId: s.otherClass.id } }), 0, "blank = no result");

  await admin.send(`/exam-results/${exam.id}`, { [key(s.inClass)]: "19", [key(extraStudent)]: "20" });
  assert.equal((await prisma.examResult.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: s.inClass.id } } })).passed, false, "19/50 fails");
  assert.equal((await prisma.examResult.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: extraStudent.id } } })).passed, true, "20/50 passes");
  assert.equal(await prisma.examResult.count({ where: { examId: exam.id, studentId: s.inClass.id } }), 1, "saving again updates, never duplicates");
});

test("the sheet lists every active student of that class level, and no inactive ones", async () => {
  const admin = await ctx.adminBrowser();
  const page = (await admin.get(`/exam-results/${exam.id}`)).text;
  assert.match(page, /S1/);
  assert.match(page, /S3/, "section B is the same class level");
  assert.doesNotMatch(page, /S4/, "inactive students are not graded");
});

test("invalid marks save nothing, and say which student", async () => {
  const admin = await ctx.adminBrowser();
  const before = await prisma.examResult.findMany({ where: { examId: exam.id }, orderBy: { id: "asc" } });
  const res = await admin.send(`/exam-results/${exam.id}`, { [key(s.inClass)]: "10", [key(extraStudent)]: "51" });
  assert.equal(res.status, 400);
  assert.match(res.text, /Sec B: Cannot be more than 50/);
  assert.match(res.text, /value="51"/, "what was typed is kept in the form");
  assert.deepEqual(await prisma.examResult.findMany({ where: { examId: exam.id }, orderBy: { id: "asc" } }), before, "the valid row was not saved either");

  const odd = await admin.send(`/exam-results/${exam.id}`, { [key(s.inClass)]: "abc" });
  assert.equal(odd.status, 400);
});

test("a teacher can grade only exams for a subject and class they teach", async () => {
  const list = await teacherBrowser.get("/exam-results");
  assert.equal(list.status, 200);
  assert.match(list.text, /Unit Test/);
  assert.equal((await teacherBrowser.send(`/exam-results/${exam.id}`, { [key(s.inClass)]: "44" })).status, 302);
  assert.equal((await prisma.examResult.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: s.inClass.id } } })).marksObtained, 44);

  const other = await prisma.subject.create({ data: { subjectId: "SUB2", name: "History" } });
  const foreign = await prisma.exam.create({ data: { examName: "History Quiz", classId: s.classA.id, subjectId: other.id } });
  assert.equal((await teacherBrowser.get(`/exam-results/${foreign.id}`)).status, 403);
  assert.equal((await teacherBrowser.send(`/exam-results/${foreign.id}`, { [key(s.inClass)]: "9" })).status, 403);
  assert.doesNotMatch((await teacherBrowser.get("/exam-results")).text, /History Quiz/);
  assert.equal(await prisma.examResult.count({ where: { examId: foreign.id } }), 0);
});

test("students and signed-out visitors cannot reach results entry; unknown exams are 404", async () => {
  assert.equal((await ctx.browser().get("/exam-results")).headers.get("location"), "/login");
  const student = ctx.browser();
  await student.login("student@test.local", "password123", "student");
  assert.equal((await student.get("/exam-results")).status, 403);
  assert.equal((await student.get(`/exam-results/${exam.id}`)).status, 403);
  const admin = await ctx.adminBrowser();
  assert.equal((await admin.get("/exam-results/99999")).status, 404);
  assert.equal((await admin.get("/exam-results/abc")).status, 404);
});

test("changing the pass mark re-grades entered results; maximum marks are locked once results exist; such an exam cannot be deleted", async () => {
  const admin = await ctx.adminBrowser();
  const form = (over) => ({ examName: "Unit Test", classId: String(s.classA.id), subjectId: String(subject.id), maxMarks: "50", passPercent: "40", ...over });

  // inClass 44/50 = 88%, extraStudent 20/50 = 40% (the teacher's earlier save left Sec B blank, which clears it)
  await admin.send(`/exam-results/${exam.id}`, { [key(s.inClass)]: "44", [key(extraStudent)]: "20" });
  await admin.send(`/exam/${exam.id}`, form({ passPercent: "50" }));
  assert.equal((await prisma.examResult.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: extraStudent.id } } })).passed, false);
  assert.equal((await prisma.examResult.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: s.inClass.id } } })).passed, true);

  const bad = await admin.send(`/exam/${exam.id}`, form({ maxMarks: "100" }));
  assert.equal(bad.status, 400);
  assert.match(bad.text, /cannot change/);

  const del = await admin.send(`/exam/${exam.id}/delete`);
  assert.equal(del.headers.get("location"), "/exam?notice=has-results");
  assert.equal(await prisma.exam.count({ where: { id: exam.id } }), 1);

  assert.equal((await admin.send(`/exam/${exam.id}`, form({ passPercent: "150" }))).status, 400);
});

test("the student sees their own results on their dashboard", async () => {
  const student = ctx.browser();
  await student.login("student@test.local", "password123", "student");
  const page = await student.get("/student/dashboard");
  assert.equal(page.status, 200);
  assert.match(page.text, /Unit Test/);
});
