// Run with: node --test tests/attendance.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics, recentWeekday } = require("./helpers");
const { dateProblem, weekendDays, editWindowDays } = require("../src/utils/attendanceRules");

let ctx, prisma, s, teacher;
before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  teacher = ctx.browser();
  await teacher.login("teacher@test.local", "password123", "teacher");
});
after(() => ctx.stop());

const day = (str) => new Date(str);
const TODAY = day("2026-06-17"); // a Wednesday
const mark = (date, status = "Present", who = s.inClass) => teacher.send("/teacher/attendance", { date, [`status[student-${who.id}]`]: status });
const rows = (date) => prisma.attendance.count({ where: { studentId: s.inClass.id, date: day(date) } });

test("date rules: future, weekends, the edit window and the settings", () => {
  const ok = (d) => dateProblem(day(d), TODAY, { weekend: new Set([0, 6]), windowDays: 14 });
  assert.equal(ok("2026-06-17"), null, "today is fine");
  assert.equal(ok("2026-06-16"), null);
  assert.equal(ok("2026-06-03"), null, "14 days back is the last open day");
  assert.match(ok("2026-06-02"), /more than 14 days ago/);
  assert.match(ok("2026-06-18"), /not happened yet/);
  assert.match(ok("2026-06-14"), /Sunday is a weekend/);
  assert.match(ok("2026-06-13"), /Saturday is a weekend/);
  assert.deepEqual([...weekendDays("5,6")], [5, 6]);
  assert.deepEqual([...weekendDays("")], []);
  assert.deepEqual([...weekendDays("x,9,3")], [3]);
  assert.equal(editWindowDays("30"), 30);
  assert.equal(editWindowDays("abc"), 14);
  assert.equal(editWindowDays(undefined), 14);
});

test("attendance is saved on the chosen day, not just today", async () => {
  const d = recentWeekday(5);
  assert.equal((await mark(d)).status, 302);
  assert.equal(await rows(d), 1);
  const other = recentWeekday(2); // one or more weekdays after d, so a different day
  assert.notEqual(other, d);
  await mark(other, "Late");
  assert.equal((await prisma.attendance.findFirst({ where: { studentId: s.inClass.id, date: day(other) } })).status, "Late");
  assert.equal(await rows(d), 1, "the other day did not overwrite this one");
});

test("tomorrow, weekends and locked old days are refused and nothing is saved", async () => {
  const total = () => prisma.attendance.count();
  const before = await total();
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  await mark(tomorrow.toISOString().slice(0, 10));
  await mark("2026-01-05"); // far past
  let sat = new Date();
  while (sat.getUTCDay() !== 6) sat.setUTCDate(sat.getUTCDate() - 1);
  await mark(sat.toISOString().slice(0, 10));
  assert.equal(await total(), before);

  const page = await teacher.get(`/teacher/attendance?date=${sat.toISOString().slice(0, 10)}`);
  assert.equal(page.status, 200);
  assert.match(page.text, /Saturday is a weekend/);
  assert.doesNotMatch(page.text, /Save Attendance/, "the form is not offered on a closed day");
  assert.match((await teacher.get("/teacher/attendance?date=2026-01-05")).text, /locked/);
});

test("a holiday closes attendance", async () => {
  const d = recentWeekday(5);
  await prisma.holiday.create({ data: { holidayId: "H-TEST", name: "Founders Day", startDate: day(d), endDate: day(d) } });
  const before = await prisma.attendance.count();
  await mark(d);
  assert.equal(await prisma.attendance.count(), before);
  assert.match((await teacher.get(`/teacher/attendance?date=${d}`)).text, /holiday \(Founders Day\)/);
});

test("a garbage date falls back to today and never crashes", async () => {
  for (const bad of ["not-a-date", "9999-99-99", "2026-02-30", "", "2026/03/02"]) {
    assert.equal((await teacher.get(`/teacher/attendance?date=${encodeURIComponent(bad)}`)).status, 200, bad);
  }
});
