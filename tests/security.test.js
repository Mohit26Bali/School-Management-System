// Run with: node --test tests/security.test.js
// Starts the real app on a throwaway SQLite database and drives it over HTTP.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { startApp, seedBasics, recentWeekday, root } = require("./helpers");

let ctx, prisma, base, ids, browser;
const uploadsDir = path.join(root, "public", "uploads");
const uploadsBefore = () => (fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []);

before(async () => {
  ctx = await startApp();
  ({ prisma, base, browser } = ctx);
  const s = await seedBasics(prisma, ctx.hash);
  ids = { admin: s.admin.id, teacher: s.teacher.id, inClass: s.inClass.id, otherClass: s.otherClass.id };
});

after(() => ctx.stop());

test("login: right password signs in, wrong password and unknown email are refused the same way", async () => {
  const ok = await browser().login("admin@test.local", "password123");
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get("location"), "/");

  const wrong = await browser().login("admin@test.local", "nope");
  const unknown = await browser().login("nobody@test.local", "nope");
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.match(wrong.text, /Invalid email or password/);
  assert.match(unknown.text, /Invalid email or password/);
});

test("login: email typed in capitals still works, and an array or object in the email field does not crash the server", async () => {
  assert.equal((await browser().login("  ADMIN@Test.Local ", "password123")).status, 302);

  const b = browser();
  const token = await b.csrf();
  const res = await b.postRaw("/login", `_csrf=${token}&email[a]=1&email[b]=2&password=x&role=admin`, {
    "content-type": "application/x-www-form-urlencoded",
  });
  assert.equal(res.status, 401);
});

test("login: a new session id is issued at login, and the cookie is HttpOnly and SameSite=Lax", async () => {
  const b = browser();
  await b.csrf();
  const before = b.sessionId();
  const res = await b.login("admin@test.local", "password123");
  assert.notEqual(b.sessionId(), before, "session id must change on login");
  const cookie = res.setCookies.find((c) => c.startsWith("sms.sid="));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test("CSRF: a POST without the token is refused", async () => {
  const b = browser();
  await b.login("admin@test.local", "password123");
  const res = await b.post("/students/999/delete", {});
  assert.equal(res.status, 403);
});

test("access: signed-out visitors go to /login; each role only reaches its own pages", async () => {
  assert.equal((await browser().get("/students")).headers.get("location"), "/login");

  const student = browser();
  await student.login("student@test.local", "password123", "student");
  assert.equal((await student.get("/students")).status, 403);
  assert.equal((await student.get("/teachers")).status, 403);
  assert.equal((await student.get("/teacher/dashboard")).status, 403);
  assert.equal((await student.get("/student/dashboard")).status, 200);

  const teacher = browser();
  await teacher.login("teacher@test.local", "password123", "teacher");
  assert.equal((await teacher.get("/students")).status, 403);
  assert.equal((await teacher.get("/fees")).status, 403);
  assert.equal((await teacher.get("/student/dashboard")).status, 403);
  assert.equal((await teacher.get("/teacher/dashboard")).status, 200);

  const admin = browser();
  await admin.login("admin@test.local", "password123");
  assert.equal((await admin.get("/students")).status, 200);
  assert.equal((await admin.get("/teacher/dashboard")).status, 403);
});

test("password reset: the link is shown outside production, never in production, and works once", async () => {
  const b = browser();
  let token = await b.csrf();
  const res = await b.post("/forgot-password", { _csrf: token, email: "student@test.local" });
  const link = /\/reset-password\/([a-f0-9]{64})/.exec(res.text);
  assert.ok(link, "development mode shows the link");

  process.env.NODE_ENV = "production";
  try {
    const prod = browser();
    token = await prod.csrf();
    const hidden = await prod.post("/forgot-password", { _csrf: token, email: "student@test.local" });
    assert.doesNotMatch(hidden.text, /reset-password\/[a-f0-9]{64}/);
  } finally {
    process.env.NODE_ENV = "test";
  }

  // The first link was replaced by the production request above, so ask again and use it.
  const b2 = browser();
  token = await b2.csrf();
  const again = await b2.post("/forgot-password", { _csrf: token, email: "student@test.local" });
  const good = /\/reset-password\/([a-f0-9]{64})/.exec(again.text)[1];

  token = await b2.csrf();
  const short = await b2.post(`/reset-password/${good}`, { _csrf: token, password: "short", confirmPassword: "short" });
  assert.equal(short.status, 400);

  const done = await b2.post(`/reset-password/${good}`, { _csrf: token, password: "brand-new-pass", confirmPassword: "brand-new-pass" });
  assert.equal(done.status, 200);
  const reuse = await b2.post(`/reset-password/${good}`, { _csrf: token, password: "another-pass-1", confirmPassword: "another-pass-1" });
  assert.equal(reuse.status, 400, "a reset link works only once");

  assert.equal((await browser().login("student@test.local", "brand-new-pass", "student")).status, 302);
  assert.equal((await browser().login("student@test.local", "password123", "student")).status, 401);
});

test("password reset: an unknown email gets the same neutral answer as a known one", async () => {
  const b = browser();
  const token = await b.csrf();
  const res = await b.post("/forgot-password", { _csrf: token, email: "ghost@test.local" });
  assert.equal(res.status, 200);
  assert.doesNotMatch(res.text, /reset-password\/[a-f0-9]{64}/);
});

test("attendance: a teacher can mark their own class, not another class, and a bad date does not crash", async () => {
  const markDay = recentWeekday(2);
  const t = browser();
  await t.login("teacher@test.local", "password123", "teacher");
  const token = await t.csrf();

  const res = await t.post("/teacher/attendance", {
    _csrf: token,
    date: markDay,
    [`status[student-${ids.inClass}]`]: "Present",
    [`status[student-${ids.otherClass}]`]: "Absent",
  });
  assert.equal(res.status, 302);
  const saved = await prisma.attendance.findMany({ where: { studentId: ids.inClass } });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].date.toISOString().slice(0, 10), markDay, "the chosen day is the one saved");
  assert.equal(await prisma.attendance.count({ where: { studentId: ids.otherClass } }), 0, "other class must not be markable");

  const badDate = await t.post("/teacher/attendance", { _csrf: token, date: "not-a-date", [`status[student-${ids.inClass}]`]: "Late" });
  assert.equal(badDate.status, 302);
  assert.equal((await t.get("/teacher/attendance?date=9999-99-99")).status, 200);
});

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function uploadAvatar(b, bytes, filename, type) {
  const token = await b.csrf();
  const form = new FormData();
  form.append("_csrf", token);
  form.append("name", "Updated Name");
  form.append("avatar", new Blob([bytes], { type }), filename);
  const res = await fetch(base + "/profile", {
    method: "POST",
    headers: { cookie: `sms.sid=${b.sessionId()}` },
    body: form,
    redirect: "manual",
  });
  return { status: res.status, text: await res.text() };
}

test("uploads: a script disguised as an image is refused and nothing is saved", async () => {
  const b = browser();
  await b.login("admin@test.local", "password123");
  const before = uploadsBefore();
  const res = await uploadAvatar(b, Buffer.from("<script>alert(1)</script>"), "photo.png", "image/png");
  assert.equal(res.status, 400);
  assert.deepEqual(uploadsBefore(), before);
});

test("uploads: a real image is saved under a random name with a safe extension, whatever the client called it", async () => {
  const b = browser();
  await b.login("admin@test.local", "password123");
  const before = new Set(uploadsBefore());
  const res = await uploadAvatar(b, PNG, "evil.html", "image/png");
  assert.equal(res.status, 200);
  const added = uploadsBefore().filter((f) => !before.has(f));
  assert.equal(added.length, 1);
  assert.match(added[0], /^[a-f0-9]{32}\.png$/);
  for (const f of added) fs.unlinkSync(path.join(uploadsDir, f));
});

test("uploads: a file over 2 MB is refused", async () => {
  const b = browser();
  await b.login("admin@test.local", "password123");
  const before = uploadsBefore();
  const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 10)]);
  const res = await uploadAvatar(b, big, "big.png", "image/png");
  assert.equal(res.status, 400);
  assert.deepEqual(uploadsBefore(), before);
});

test("image sniffing recognises JPEG, PNG and WebP and nothing else", () => {
  const { sniffImageType } = require("../src/utils/upload");
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "image/jpeg");
  assert.equal(sniffImageType(PNG), "image/png");
  assert.equal(sniffImageType(Buffer.from("RIFF\0\0\0\0WEBP", "latin1")), "image/webp");
  assert.equal(sniffImageType(Buffer.from("GIF89a")), null);
  assert.equal(sniffImageType(Buffer.from("<html>")), null);
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
});
