// Run with: node --test tests/audit.test.js
// Money records leave a trace, and amounts must be sensible.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");
const { parseAmount } = require("../src/utils/money");

let ctx, prisma, s, admin;

before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  await prisma.fee.create({ data: { feesId: "F1", feesType: "Exam Fees", classId: s.classA.id, amount: 500 } });
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

const log = (entity, entityId) => prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { id: "asc" } });

test("amount rules: positive, at most two decimals, sensible size", () => {
  assert.deepEqual(parseAmount("12.5"), { value: 12.5 });
  assert.deepEqual(parseAmount(" 100 "), { value: 100 });
  for (const bad of ["", "  ", "0", "0.00", "-5", "1.234", "1e3", "abc", "1,000", "9999999999", undefined, ["5"], { a: 1 }]) {
    assert.ok(parseAmount(bad).error, `${JSON.stringify(bad)} should be refused`);
  }
});

test("a fee payment is logged when created, changed and deleted, with who did it", async () => {
  await admin.send("/fees-collections", { studentId: "S1", feesType: "Exam Fees", amount: "100", paidDate: "2026-03-01" });
  const payment = await prisma.feesCollection.findFirst({ where: { studentId: s.inClass.id } });
  let entries = await log("FeesCollection", payment.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, "create");
  assert.equal(entries[0].userName, "Admin");
  assert.equal(entries[0].userId, s.admin.id);
  assert.equal(JSON.parse(entries[0].changes).amount, 100);

  await admin.send(`/fees-collections/${payment.id}`, { studentId: "S1", feesType: "Exam Fees", amount: "120", paidDate: "2026-03-01" });
  entries = await log("FeesCollection", payment.id);
  assert.equal(entries.length, 2);
  assert.deepEqual(JSON.parse(entries[1].changes), { amount: [100, 120] }, "only what changed is recorded");

  await admin.send(`/fees-collections/${payment.id}`, { studentId: "S1", feesType: "Exam Fees", amount: "120", paidDate: "2026-03-01" });
  assert.equal((await log("FeesCollection", payment.id)).length, 2, "saving without changes adds nothing");

  await admin.send(`/fees-collections/${payment.id}/delete`);
  entries = await log("FeesCollection", payment.id);
  assert.equal(entries[2].action, "delete");
  assert.equal(JSON.parse(entries[2].changes).amount, 120, "the deleted record is kept in the log");
  assert.equal(await prisma.feesCollection.count({ where: { id: payment.id } }), 0);
});

test("expenses and salaries are logged too", async () => {
  await admin.send("/expenses", { expensesId: "EX1", itemName: "Chalk", amount: "12.50", purchaseDate: "2026-03-01" });
  const expense = await prisma.expense.findUnique({ where: { expensesId: "EX1" } });
  assert.equal((await log("Expense", expense.id))[0].action, "create");

  await admin.send(`/expenses/${expense.id}`, { expensesId: "EX1", itemName: "Chalk", amount: "15", purchaseDate: "2026-03-01" });
  assert.deepEqual(JSON.parse((await log("Expense", expense.id))[1].changes), { amount: [12.5, 15] });

  await admin.send("/salary", { teacherId: "T1", amount: "2000", paymentDate: "2026-03-01" });
  const salary = await prisma.salary.findFirst({ where: { teacherId: s.teacher.id } });
  assert.equal((await log("Salary", salary.id))[0].userName, "Admin");
  await admin.send(`/salary/${salary.id}/delete`);
  assert.equal((await log("Salary", salary.id)).pop().action, "delete");
});

test("the audit page shows entries to admins only, and filters by type", async () => {
  const page = await admin.get("/audit");
  assert.equal(page.status, 200);
  assert.match(page.text, /Fee payments/);
  assert.match(page.text, /amount<\/strong>: 100 &rarr; 120/);
  const filtered = await admin.get("/audit?entity=Expense");
  assert.match(filtered.text, /Chalk|Expenses #/);
  assert.doesNotMatch(filtered.text, /Salaries #/);

  const teacher = ctx.browser();
  await teacher.login("teacher@test.local", "password123", "teacher");
  assert.equal((await teacher.get("/audit")).status, 403);
  assert.equal((await ctx.browser().get("/audit")).headers.get("location"), "/login");
});

test("bad amounts are refused for expenses, salaries and the fee schedule, on create and on edit", async () => {
  const counts = async () => [await prisma.expense.count(), await prisma.salary.count(), await prisma.fee.count()];
  const before = await counts();
  for (const amount of ["0", "-3", "1.999", "abc", ""]) {
    assert.equal((await admin.send("/expenses", { expensesId: "BAD" + amount.length, itemName: "x", amount })).status, 400, `expense ${amount}`);
    assert.equal((await admin.send("/salary", { teacherId: "T1", amount })).status, 400, `salary ${amount}`);
    assert.equal((await admin.send("/fees", { feesId: "FB" + amount.length, feesType: "Exam Fees", amount })).status, 400, `fee ${amount}`);
  }
  assert.deepEqual(await counts(), before);

  const exp = await prisma.expense.findUnique({ where: { expensesId: "EX1" } });
  assert.equal((await admin.send(`/expenses/${exp.id}`, { expensesId: "EX1", itemName: "Chalk", amount: "" })).status, 400, "an edit that empties the amount no longer crashes");
  assert.equal((await prisma.expense.findUnique({ where: { id: exp.id } })).amount, 15);
});

test("a salary cannot be paid to an inactive teacher, and deleting a missing record is a 404", async () => {
  await prisma.teacher.create({ data: { teacherId: "T9", name: "Retired", active: false } });
  const res = await admin.send("/salary", { teacherId: "T9", amount: "100" });
  assert.equal(res.status, 400);
  assert.match(res.text, /No staff found/);
  for (const path of ["/expenses", "/salary", "/fees-collections"]) {
    assert.equal((await admin.send(`${path}/99999/delete`)).status, 404, path);
  }
});
