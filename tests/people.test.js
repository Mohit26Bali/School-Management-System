// Run with: node --test tests/people.test.js
// Students and teachers with records are made inactive, not erased.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");

let ctx, prisma, s;
before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
});
after(() => ctx.stop());

async function newStudent(code, withLogin) {
  const data = { firstName: "Temp", lastName: code, studentId: code, classId: s.classA.id };
  if (withLogin) {
    const user = await prisma.user.create({ data: { name: code, email: `${code.toLowerCase()}@test.local`, passwordHash: ctx.hash, role: "student" } });
    data.userId = user.id;
  }
  return prisma.student.create({ data });
}

test("a student with no records is deleted completely, login included", async () => {
  const st = await newStudent("NOREC1", true);
  const admin = await ctx.adminBrowser();
  const res = await admin.send(`/students/${st.id}/delete`);
  assert.equal(res.headers.get("location"), "/students?notice=deleted");
  assert.equal(await prisma.student.count({ where: { id: st.id } }), 0);
  assert.equal(await prisma.user.count({ where: { id: st.userId } }), 0);
});

test("a student with attendance is made inactive: records stay, login stops, lists hide them, reactivation restores", async () => {
  const st = await newStudent("HIST1", true);
  await prisma.attendance.create({ data: { studentId: st.id, teacherId: s.teacher.id, classId: s.classA.id, date: new Date("2026-03-02"), status: "Present" } });

  const admin = await ctx.adminBrowser();
  const res = await admin.send(`/students/${st.id}/delete`);
  assert.equal(res.headers.get("location"), "/students?notice=deactivated");

  const after = await prisma.student.findUnique({ where: { id: st.id } });
  assert.equal(after.active, false);
  assert.ok(after.leftOn, "the leaving date is recorded");
  assert.equal(await prisma.attendance.count({ where: { studentId: st.id } }), 1, "attendance is kept");

  const attempt = await ctx.browser().login("hist1@test.local", "password123", "student");
  assert.equal(attempt.status, 401);
  assert.match(attempt.text, /deactivated/);

  assert.doesNotMatch((await admin.get("/students")).text, /HIST1/);
  assert.match((await admin.get("/students?show=inactive")).text, /HIST1/);
  assert.match((await admin.get("/students?show=all")).text, /HIST1/);

  await admin.send(`/students/${st.id}/reactivate`);
  assert.equal((await prisma.student.findUnique({ where: { id: st.id } })).active, true);
  assert.equal((await ctx.browser().login("hist1@test.local", "password123", "student")).status, 302);
});

test("an inactive student is left out of the teacher's attendance sheet, the headcount and fee payments", async () => {
  const st = await newStudent("GONE1", false);
  await prisma.attendance.create({ data: { studentId: st.id, teacherId: s.teacher.id, classId: s.classA.id, date: new Date("2026-03-03"), status: "Present" } });
  const admin = await ctx.adminBrowser();
  await admin.send(`/students/${st.id}/delete`);

  const teacher = ctx.browser();
  await teacher.login("teacher@test.local", "password123", "teacher");
  assert.doesNotMatch((await teacher.get("/teacher/attendance")).text, /GONE1/);

  const pay = await admin.send("/fees-collections", { studentId: "GONE1", feesType: "Tuition Fees", amount: "100", paidDate: "2026-03-03" });
  assert.equal(pay.status, 400);
  assert.match(pay.text, /No student found/);
});

test("a teacher with records is made inactive and cannot sign in; one with none is deleted", async () => {
  const tUser = await prisma.user.create({ data: { name: "Old", email: "old@test.local", passwordHash: ctx.hash, role: "teacher" } });
  const old = await prisma.teacher.create({ data: { teacherId: "T-OLD", name: "Old Teacher", userId: tUser.id } });
  await prisma.salary.create({ data: { teacherId: old.id, amount: 1000, paymentDate: new Date("2026-02-01") } });

  const fresh = await prisma.teacher.create({ data: { teacherId: "T-NEW", name: "Fresh Teacher" } });

  const admin = await ctx.adminBrowser();
  assert.equal((await admin.send(`/teachers/${old.id}/delete`)).headers.get("location"), "/teachers?notice=deactivated");
  assert.equal((await admin.send(`/teachers/${fresh.id}/delete`)).headers.get("location"), "/teachers?notice=deleted");

  assert.equal((await prisma.teacher.findUnique({ where: { id: old.id } })).active, false);
  assert.equal(await prisma.salary.count({ where: { teacherId: old.id } }), 1, "salary history is kept");
  assert.equal(await prisma.teacher.count({ where: { id: fresh.id } }), 0);
  assert.equal((await ctx.browser().login("old@test.local", "password123", "teacher")).status, 401);

  assert.doesNotMatch((await admin.get("/teachers")).text, /T-OLD/);
  assert.match((await admin.get("/teachers?show=inactive")).text, /T-OLD/);
  await admin.send(`/teachers/${old.id}/reactivate`);
  assert.equal((await ctx.browser().login("old@test.local", "password123", "teacher")).status, 302);
});

test("deleting something that does not exist is a 404, not a crash", async () => {
  const admin = await ctx.adminBrowser();
  assert.equal((await admin.send("/students/99999/delete")).status, 404);
  assert.equal((await admin.send("/teachers/99999/delete")).status, 404);
});
