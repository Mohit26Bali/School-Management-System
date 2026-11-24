// Shared setup for the test files: a throwaway database, the real app on a random port, and a tiny cookie-keeping "browser".
// Each test file runs in its own process, so each gets its own database.
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");

async function startApp({ env = {} } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-test-"));
  process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.db").split(path.sep).join("/")}`;
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
  process.env.NODE_ENV = "test";
  process.env.LOGIN_ATTEMPT_LIMIT = "1000"; // the limiter has its own test file
  Object.assign(process.env, env);

  execSync("npx prisma migrate deploy", { cwd: root, env: process.env, stdio: "pipe" });
  const { PrismaClient } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash("password123", 4);

  const app = require("../src/app");
  let server;
  await new Promise((resolve) => (server = app.listen(0, "127.0.0.1", resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  function browser() {
    const jar = new Map();
    async function request(method, url, { form, body, headers = {} } = {}) {
      const h = { ...headers };
      if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      let payload = body;
      if (form) {
        payload = new URLSearchParams(form).toString();
        h["content-type"] = "application/x-www-form-urlencoded";
      }
      const res = await fetch(base + url, { method, headers: h, body: payload, redirect: "manual" });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      res.text = await res.text();
      res.setCookies = res.headers.getSetCookie();
      return res;
    }
    // The CSRF token of the current session, read from any page that has a form
    async function csrf(url = "/login") {
      const page = await request("GET", url);
      const m = /name="_csrf" value="([^"]+)"/.exec(page.text);
      assert.ok(m, `${url} carries a CSRF token`);
      return m[1];
    }
    const self = {
      get: (url) => request("GET", url),
      post: (url, form) => request("POST", url, { form }),
      postRaw: (url, body, headers) => request("POST", url, { body, headers }),
      csrf,
      sessionId: () => jar.get("sms.sid"),
      async login(email, password, role = "admin") {
        const token = await csrf();
        return request("POST", "/login", { form: { _csrf: token, email, password, role } });
      },
      // POST with a fresh CSRF token taken from the login page of this same session
      async send(url, form = {}) {
        return request("POST", url, { form: { _csrf: await csrf(), ...form } });
      },
    };
    return self;
  }

  async function adminBrowser() {
    const b = browser();
    const res = await b.login("admin@test.local", "password123");
    assert.equal(res.status, 302, "admin can sign in");
    return b;
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* Windows may still hold the database file for a moment; the OS temp folder is cleaned up later */
    }
  }

  return { base, prisma, hash, browser, adminBrowser, stop };
}

// One school with an admin, a class, a teacher (homeroom) and a student, all with password "password123".
async function seedBasics(prisma, hash) {
  const classA = await prisma.class.create({ data: { name: "10", section: "A" } });
  const classB = await prisma.class.create({ data: { name: "10", section: "B" } });
  const admin = await prisma.user.create({ data: { name: "Admin", email: "admin@test.local", passwordHash: hash, role: "admin" } });
  const tUser = await prisma.user.create({ data: { name: "Teach", email: "teacher@test.local", passwordHash: hash, role: "teacher" } });
  const sUser = await prisma.user.create({ data: { name: "Stud", email: "student@test.local", passwordHash: hash, role: "student" } });
  const teacher = await prisma.teacher.create({ data: { teacherId: "T1", name: "Teach", classId: classA.id, userId: tUser.id } });
  const inClass = await prisma.student.create({ data: { firstName: "In", lastName: "Class", studentId: "S1", classId: classA.id, userId: sUser.id } });
  const otherClass = await prisma.student.create({ data: { firstName: "Out", lastName: "Class", studentId: "S2", classId: classB.id } });
  return { classA, classB, admin, teacher, inClass, otherClass, tUser, sUser };
}

// A recent Monday-Friday as YYYY-MM-DD (UTC, like the app stores days), at least `daysBack` days ago.
function recentWeekday(daysBack = 1) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysBack);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

module.exports = { startApp, seedBasics, recentWeekday, root };
