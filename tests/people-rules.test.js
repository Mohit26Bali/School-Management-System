// Run with: node --test tests/people-rules.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { startApp, seedBasics, root } = require("./helpers");
const { studentProblems, teacherProblems, ageOn } = require("../src/utils/people");

let ctx, prisma, s, admin;
const NOW = new Date("2026-06-15T00:00:00Z");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

const goodStudent = (over = {}) => ({
  firstName: "Anna",
  lastName: "O'Neil-Smith",
  studentId: "N-100",
  classId: "1",
  gender: "Female",
  dob: "2012-05-01",
  joiningDate: "2026-01-10",
  mobile: "+91 98765 43210",
  fatherEmail: "dad@example.com",
  ...over,
});

test("student rules: good data passes, each bad field is named", () => {
  assert.deepEqual(studentProblems(goodStudent(), NOW), []);
  const has = (over, re) => assert.ok(studentProblems(goodStudent(over), NOW).some((p) => re.test(p)), JSON.stringify(over));
  has({ firstName: "" }, /First name is required/);
  has({ firstName: "R2D2" }, /First name can only contain letters/);
  has({ lastName: "x".repeat(61) }, /Last name is too long/);
  has({ studentId: "bad id!" }, /Student ID can only contain/);
  has({ classId: "" }, /Choose a class/);
  has({ gender: "Robot" }, /gender/);
  has({ dob: "2999-01-01" }, /Date of birth cannot be in the future/);
  has({ dob: "2026-06-01" }, /below the minimum of 2/);
  has({ dob: "1900-01-01" }, /above the maximum/);
  has({ dob: "2012-02-30" }, /not a valid date/);
  has({ joiningDate: "2999-01-01" }, /Joining date cannot be in the future/);
  has({ mobile: "abc" }, /Mobile number must be a phone number/);
  has({ mobile: "123" }, /Mobile number must be a phone number/);
  has({ fatherMobile: "1".repeat(16) }, /Father's mobile/);
  has({ fatherEmail: "not-an-email" }, /Father's email is not a valid email address/);
  has({ firstName: ["a", "b"] }, /First name is required/);
  has({ presentAddress: "x".repeat(301) }, /Present address is too long/);
});

test("teacher rules: adults only, valid codes and contact details", () => {
  const good = { name: "Dana Reyes", teacherId: "T-77", gender: "Female", dob: "1985-03-04", mobile: "98765 43210", email: "dana@school.test" };
  assert.deepEqual(teacherProblems(good, NOW), []);
  const has = (over, re) => assert.ok(teacherProblems({ ...good, ...over }, NOW).some((p) => re.test(p)), JSON.stringify(over));
  has({ name: "D" }, /Name is required/);
  has({ teacherId: "" }, /Teacher ID is required/);
  has({ dob: "2015-01-01" }, /below the minimum of 18/);
  has({ email: "nope" }, /Login email is not a valid email address/);
  has({ mobile: "12" }, /Mobile number/);
  assert.equal(ageOn(new Date("2000-06-16"), NOW), 25, "birthday tomorrow: still 25");
  assert.equal(ageOn(new Date("2000-06-15"), NOW), 26);
});

test("the server refuses bad students and teachers and saves nothing", async () => {
  const before = [await prisma.student.count(), await prisma.teacher.count()];
  const bad = await admin.send("/students", goodStudent({ classId: String(s.classA.id), firstName: "R2D2", dob: "2999-01-01" }));
  assert.equal(bad.status, 400);
  assert.match(bad.text, /First name can only contain letters/);
  assert.match(bad.text, /Date of birth cannot be in the future/);
  assert.equal((await admin.send("/teachers", { teacherId: "TX", name: "Kid", dob: "2020-01-01" })).status, 400);
  assert.equal((await admin.send("/teachers", { teacherId: "TX", name: "Real Name", email: "a@b.test", password: "short" })).status, 400);
  assert.deepEqual([await prisma.student.count(), await prisma.teacher.count()], before);

  const ok = await admin.send("/students", goodStudent({ classId: String(s.classA.id) }));
  assert.equal(ok.status, 302);
  assert.equal((await prisma.student.findUnique({ where: { studentId: "N-100" } })).lastName, "O'Neil-Smith");
});

test("editing is checked the same way and does not wipe the record", async () => {
  const st = await prisma.student.findUnique({ where: { studentId: "N-100" } });
  const res = await admin.send(`/students/${st.id}`, goodStudent({ classId: String(s.classA.id), mobile: "xx" }));
  assert.equal(res.status, 400);
  assert.equal((await prisma.student.findUnique({ where: { id: st.id } })).mobile, "+91 98765 43210");
});

test("a class cannot take more students than its capacity", async () => {
  const small = await prisma.class.create({ data: { name: "1", section: "Z", capacity: 2 } });
  const mk = (code, extra = {}) => admin.send("/students", goodStudent({ studentId: code, classId: String(small.id), ...extra }));
  assert.equal((await mk("CAP-1")).status, 302);
  assert.equal((await mk("CAP-2")).status, 302);
  const full = await mk("CAP-3");
  assert.equal(full.status, 400);
  assert.match(full.text, /is full \(2 of 2 places\)/);
  assert.equal(await prisma.student.count({ where: { classId: small.id } }), 2);

  // moving an existing student into the full class is refused too; staying put while editing is fine
  const other = await prisma.student.findUnique({ where: { studentId: "N-100" } });
  const move = await admin.send(`/students/${other.id}`, goodStudent({ classId: String(small.id) }));
  assert.equal(move.status, 400);
  const stay = await prisma.student.findUnique({ where: { studentId: "CAP-1" } });
  assert.equal((await admin.send(`/students/${stay.id}`, goodStudent({ studentId: "CAP-1", classId: String(small.id), lastName: "Changed" }))).status, 302);

  // making room: an inactive student does not use a place
  await prisma.student.update({ where: { id: stay.id }, data: { active: false } });
  assert.equal((await mk("CAP-3")).status, 302);
});

test("the Classes page changes capacity, within limits", async () => {
  const small = await prisma.class.findFirst({ where: { section: "Z" } });
  const page = await admin.get("/classes");
  assert.equal(page.status, 200);
  assert.match(page.text, /Capacity/);

  assert.equal((await admin.send(`/classes/${small.id}/capacity`, { capacity: "30" })).headers.get("location"), `/classes?saved=${small.id}`);
  assert.equal((await prisma.class.findUnique({ where: { id: small.id } })).capacity, 30);
  for (const bad of ["0", "201", "-1", "abc", "", "1.5"]) {
    const res = await admin.send(`/classes/${small.id}/capacity`, { capacity: bad });
    assert.match(res.headers.get("location"), /error=/, bad);
  }
  const tooLow = await admin.send(`/classes/${small.id}/capacity`, { capacity: "1" });
  assert.match(decodeURIComponent(tooLow.headers.get("location")), /cannot be below 2/);
  assert.equal((await prisma.class.findUnique({ where: { id: small.id } })).capacity, 30);
  assert.equal((await admin.send("/classes/99999/capacity", { capacity: "10" })).status, 404);

  const teacher = ctx.browser();
  await teacher.login("teacher@test.local", "password123", "teacher");
  assert.equal((await teacher.get("/classes")).status, 403);
});

test("a photo uploaded with a refused form is not left on disk", async () => {
  const dir = path.join(root, "public", "uploads");
  const before = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  const token = await admin.csrf();
  const form = new FormData();
  form.append("_csrf", token);
  for (const [k, v] of Object.entries(goodStudent({ classId: String(s.classA.id), firstName: "R2D2", studentId: "PHOTO-1" }))) form.append(k, v);
  form.append("image", new Blob([PNG], { type: "image/png" }), "me.png");
  const res = await fetch(ctx.base + "/students", { method: "POST", headers: { cookie: `sms.sid=${admin.sessionId()}` }, body: form, redirect: "manual" });
  assert.equal(res.status, 400);
  await new Promise((r) => setTimeout(r, 200));
  const added = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => !before.has(f));
  assert.deepEqual(added, [], "no orphan upload");
});
