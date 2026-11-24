// Run with: node --test tests/timetable.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");
const { parseTime, parseDay, overlaps, findClash } = require("../src/utils/schedule");

let ctx, prisma, s, admin, maths, science, teacher2;

before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  maths = await prisma.subject.create({ data: { subjectId: "M", name: "Mathematics" } });
  science = await prisma.subject.create({ data: { subjectId: "S", name: "Science" } });
  teacher2 = await prisma.teacher.create({ data: { teacherId: "T2", name: "Second Teacher" } });
  // T1 teaches Maths to class 10 (A); T2 teaches Science to class 10
  await prisma.teacherSubject.create({ data: { teacherId: s.teacher.id, classId: s.classA.id, subjectId: maths.id } });
  await prisma.teacherSubject.create({ data: { teacherId: teacher2.id, classId: s.classA.id, subjectId: science.id } });
  await prisma.holiday.create({ data: { holidayId: "H1", name: "Founders Day", startDate: new Date("2026-09-05"), endDate: new Date("2026-09-06") } });
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

const lesson = (over = {}) => ({
  teacherId: "T1",
  classId: String(s.classA.id),
  subjectId: String(maths.id),
  date: "2026-03-02",
  startTime: "09:00",
  endTime: "10:00",
  ...over,
});
const add = (over) => admin.send("/time-table", lesson(over));
const count = () => prisma.timeTableEntry.count();

test("time rules: parsing and overlap", () => {
  assert.equal(parseTime("09:30"), 570);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("9:30"), null);
  assert.equal(parseTime("12:60"), null);
  assert.equal(parseTime(undefined), null);
  assert.ok(parseDay("2026-03-02"));
  assert.equal(parseDay("2026-02-30"), null);
  assert.equal(parseDay("02/03/2026"), null);
  assert.equal(overlaps(540, 600, 570, 630), true);
  assert.equal(overlaps(540, 600, 600, 660), false, "back to back is fine");
  assert.equal(overlaps(540, 600, 480, 540), false);
  assert.equal(overlaps(540, 720, 600, 660), true, "one inside the other");
  assert.equal(findClash([{ startTime: "10:00", endTime: "11:00" }], 540, 600), null);
  assert.ok(findClash([{ startTime: "09:30", endTime: "10:30" }], 540, 600));
});

test("a valid lesson is saved", async () => {
  assert.equal((await add()).status, 302);
  assert.equal(await count(), 1);
});

test("the same teacher cannot be in two lessons at once, even in different classes", async () => {
  const res = await add({ classId: String(s.classB.id), startTime: "09:30", endTime: "10:30" });
  assert.equal(res.status, 400);
  assert.match(res.text, /Teach already has/);
  assert.equal(await count(), 1);
});

test("the same class cannot have two lessons at once, even with different teachers", async () => {
  await prisma.teacherSubject.create({ data: { teacherId: teacher2.id, classId: s.classA.id, subjectId: science.id } }).catch(() => {});
  const res = await add({ teacherId: "T2", subjectId: String(science.id), startTime: "09:30", endTime: "10:30" });
  assert.equal(res.status, 400);
  assert.match(res.text, /Class 10 A already has/);
  assert.equal(await count(), 1);
});

test("lessons that touch but do not overlap, or are on another day, are fine", async () => {
  assert.equal((await add({ startTime: "10:00", endTime: "11:00" })).status, 302, "starts when the last one ends");
  assert.equal((await add({ date: "2026-03-03" })).status, 302, "same slot, next day");
  assert.equal((await add({ teacherId: "T2", subjectId: String(science.id), startTime: "11:00", endTime: "12:00" })).status, 302);
  assert.equal(await count(), 4);
});

test("bad times and dates are refused", async () => {
  const before = await count();
  assert.match((await add({ startTime: "11:00", endTime: "10:00", date: "2026-03-09" })).text, /end time must be after/);
  assert.match((await add({ startTime: "10:00", endTime: "10:00", date: "2026-03-09" })).text, /end time must be after/);
  assert.equal((await add({ startTime: "", date: "2026-03-09" })).status, 400);
  assert.equal((await add({ startTime: "25:00", date: "2026-03-09" })).status, 400);
  assert.equal((await add({ date: "" })).status, 400);
  assert.equal((await add({ date: "2026-02-30" })).status, 400);
  assert.equal((await add({ classId: "", date: "2026-03-09" })).status, 400);
  assert.equal(await count(), before);
});

test("no lessons on a holiday", async () => {
  const res = await add({ date: "2026-09-06" });
  assert.equal(res.status, 400);
  assert.match(res.text, /holiday \(Founders Day\)/);
  assert.equal((await add({ date: "2026-09-07" })).status, 302, "the day after is fine");
});

test("a teacher must be assigned to teach that subject to that class level", async () => {
  const res = await add({ subjectId: String(science.id), startTime: "14:00", endTime: "15:00" });
  assert.equal(res.status, 400);
  assert.match(res.text, /not assigned to teach this subject/);
});

test("unknown or inactive teachers are refused", async () => {
  assert.match((await add({ teacherId: "NOPE" })).text, /No active teacher/);
  await prisma.teacher.update({ where: { id: teacher2.id }, data: { active: false } });
  assert.match((await add({ teacherId: "T2", subjectId: String(science.id), startTime: "15:00", endTime: "16:00" })).text, /No active teacher/);
  await prisma.teacher.update({ where: { id: teacher2.id }, data: { active: true } });
});

test("editing a lesson ignores itself when checking for clashes, but not other lessons", async () => {
  const entry = await prisma.timeTableEntry.findFirst({ where: { teacherId: s.teacher.id, date: new Date("2026-03-02"), startTime: "09:00" } });
  const same = { ...lesson(), endTime: "09:45" };
  assert.equal((await admin.send(`/time-table/${entry.id}`, same)).status, 302, "shortening its own slot is fine");
  assert.equal((await prisma.timeTableEntry.findUnique({ where: { id: entry.id } })).endTime, "09:45");

  const clash = await admin.send(`/time-table/${entry.id}`, { ...lesson(), endTime: "10:30" });
  assert.equal(clash.status, 400, "stretching into the 10:00 lesson clashes");
  assert.equal((await prisma.timeTableEntry.findUnique({ where: { id: entry.id } })).endTime, "09:45");

  assert.equal((await admin.send("/time-table/99999", lesson())).status, 404);
  assert.equal((await admin.send("/time-table/99999/delete")).status, 404);
});
