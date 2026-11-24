// Run with: node --test tests/accounts.test.js
// Admins create and reset logins; password rules apply everywhere.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");
const { passwordProblem } = require("../src/utils/passwords");

let ctx, prisma, s, admin;
before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

test("password rules", () => {
  assert.equal(passwordProblem("a-good-one-1", "x@y.zz"), null);
  assert.match(passwordProblem("short", ""), /at least 8/);
  assert.match(passwordProblem("x".repeat(73), ""), /at most 72/);
  assert.match(passwordProblem(" leading-space", ""), /start or end with a space/);
  assert.match(passwordProblem("trailing-space ", ""), /start or end with a space/);
  assert.match(passwordProblem("aaaaaaaa", ""), /one character repeated/);
  assert.match(passwordProblem("Me@School.Test", "me@school.test"), /same as the email/);
  assert.match(passwordProblem(undefined, ""), /at least 8/);
  assert.match(passwordProblem(["12345678"], ""), /at least 8/);
});

test("an admin can give a student a login, and the student can then sign in", async () => {
  const st = await prisma.student.create({ data: { firstName: "No", lastName: "Login", studentId: "NL1", classId: s.classA.id } });
  const page = await admin.get(`/students/${st.id}`);
  assert.match(page.text, /No login yet/);

  const res = await admin.send(`/students/${st.id}/login`, { email: "  New.Student@School.test ", password: "first-password-1" });
  assert.equal(res.headers.get("location"), `/students/${st.id}`);
  const user = await prisma.user.findUnique({ where: { email: "new.student@school.test" } });
  assert.equal(user.role, "student");
  assert.equal(user.name, "No Login");
  assert.equal((await prisma.student.findUnique({ where: { id: st.id } })).userId, user.id);
  assert.match((await admin.get(`/students/${st.id}`)).text, /Login created/);

  assert.equal((await ctx.browser().login("new.student@school.test", "first-password-1", "student")).status, 302);
});

test("resetting a password signs the person out everywhere and the old password stops working", async () => {
  const user = await ctx.browser();
  await user.login("student@test.local", "password123", "student");
  assert.equal((await user.get("/student/dashboard")).status, 200);

  const res = await admin.send(`/students/${s.inClass.id}/login`, { email: "student@test.local", password: "reset-by-admin-1" });
  assert.equal(res.headers.get("location"), `/students/${s.inClass.id}`);

  assert.equal((await user.get("/student/dashboard")).headers.get("location"), "/login", "the open session is gone");
  assert.equal((await ctx.browser().login("student@test.local", "password123", "student")).status, 401);
  assert.equal((await ctx.browser().login("student@test.local", "reset-by-admin-1", "student")).status, 302);
});

test("an admin can create and reset a teacher login too", async () => {
  const t = await prisma.teacher.create({ data: { teacherId: "T-LOGIN", name: "Login Teacher" } });
  assert.equal((await admin.send(`/teachers/${t.id}/login`, { email: "lt@school.test", password: "teacher-pass-1" })).headers.get("location"), `/teachers/${t.id}`);
  assert.equal((await ctx.browser().login("lt@school.test", "teacher-pass-1", "teacher")).status, 302);
  assert.equal((await admin.send(`/teachers/${t.id}/login`, { email: "lt@school.test", password: "teacher-pass-2" })).headers.get("location"), `/teachers/${t.id}`);
  assert.equal((await ctx.browser().login("lt@school.test", "teacher-pass-1", "teacher")).status, 401);
});

test("bad logins are refused with a reason: weak password, bad email, email already used", async () => {
  const t = await prisma.teacher.create({ data: { teacherId: "T-BAD", name: "Bad Cases" } });
  // the reason is shown once on the page the admin lands on
  const reasonAfter = async () => (/alert-danger">([^<]+)/.exec((await admin.get(`/teachers/${t.id}`)).text) || [])[1] || "";
  const attempt = async (body) => {
    await admin.send(`/teachers/${t.id}/login`, body);
    return reasonAfter();
  };
  assert.match(await attempt({ email: "ok@school.test", password: "short" }), /at least 8/);
  assert.match(await attempt({ email: "not-an-email", password: "long-enough-1" }), /valid email/);
  assert.match(await attempt({ email: "", password: "long-enough-1" }), /valid email/);
  assert.match(await attempt({ email: "admin@test.local", password: "long-enough-1" }), /already used by another account/);
  const odd = await admin.postRaw(`/teachers/${t.id}/login`, `_csrf=${await admin.csrf()}&email[]=a@b.test&password=long-enough-1`, { "content-type": "application/x-www-form-urlencoded" });
  assert.equal(odd.headers.get("location"), `/teachers/${t.id}`);
  assert.match(await reasonAfter(), /valid email/, "an array for the email is refused");
  assert.equal((await prisma.teacher.findUnique({ where: { id: t.id } })).userId, null, "nothing was created");
});

test("an inactive person's login stays blocked after a reset", async () => {
  const st = await prisma.student.create({ data: { firstName: "Left", lastName: "School", studentId: "LEFT1", classId: s.classA.id, active: false } });
  await admin.send(`/students/${st.id}/login`, { email: "left@school.test", password: "long-enough-1" });
  const res = await ctx.browser().login("left@school.test", "long-enough-1", "student");
  assert.equal(res.status, 401);
  assert.match(res.text, /deactivated/);
});

test("only admins can set logins; unknown people are 404", async () => {
  const teacher = ctx.browser();
  await teacher.login("teacher@test.local", "password123", "teacher");
  assert.equal((await teacher.send(`/students/${s.inClass.id}/login`, { email: "x@y.test", password: "long-enough-1" })).status, 403);
  assert.equal((await admin.send("/students/99999/login", { email: "x@y.test", password: "long-enough-1" })).status, 404);
  assert.equal((await admin.send("/teachers/99999/login", { email: "x@y.test", password: "long-enough-1" })).status, 404);
});

test("changing your own password signs your other browsers out but not this one; weak and odd input is refused", async () => {
  const a = ctx.browser();
  const b = ctx.browser();
  await a.login("teacher@test.local", "password123", "teacher");
  await b.login("teacher@test.local", "password123", "teacher");

  const weak = await a.send("/profile/password", { currentPassword: "password123", newPassword: "short", confirmPassword: "short" });
  assert.match(weak.text, /at least 8/);
  const array = await a.postRaw("/profile/password", `_csrf=${await a.csrf("/profile")}&currentPassword[]=x&newPassword=long-enough-1&confirmPassword=long-enough-1`, { "content-type": "application/x-www-form-urlencoded" });
  assert.equal(array.status, 200, "an array for the current password is a validation error, not a crash");
  assert.match(array.text, /Current password is incorrect/);

  const ok = await a.send("/profile/password", { currentPassword: "password123", newPassword: "my-new-password-1", confirmPassword: "my-new-password-1" });
  assert.match(ok.text, /Password changed/);
  assert.equal((await a.get("/teacher/dashboard")).status, 200, "this browser stays signed in");
  assert.equal((await b.get("/teacher/dashboard")).headers.get("location"), "/login", "the other browser is signed out");
});
