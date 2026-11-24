// Run with: node --test tests/rate-limit.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-rl-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "rl.db").split(path.sep).join("/")}`;
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
process.env.NODE_ENV = "test";
process.env.LOGIN_ATTEMPT_LIMIT = "3";

let server, base;
before(async () => {
  execSync("npx prisma migrate deploy", { cwd: root, env: process.env, stdio: "pipe" });
  const app = require("../src/app");
  await new Promise((resolve) => (server = app.listen(0, "127.0.0.1", resolve)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* still locked on Windows */ }
});

test("login: after the allowed number of attempts further tries are blocked with 429", async () => {
  const page = await fetch(base + "/login");
  const cookie = page.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const token = /name="_csrf" value="([^"]+)"/.exec(await page.text())[1];
  const statuses = [];
  for (let i = 0; i < 5; i++) {
    const res = await fetch(base + "/login", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, email: "x@y.z", password: "bad", role: "admin" }),
      redirect: "manual",
    });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 429, 429]);
});
