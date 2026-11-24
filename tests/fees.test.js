// Run with: node --test tests/fees.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");
const { computeStatement, remainingFor } = require("../src/utils/feeBalance");

let ctx, prisma, s, admin;

before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  // Class 10 pays 150.00 exam fees and 80.50 transport; hostel is for class 9 only
  await prisma.fee.create({ data: { feesId: "F1", feesType: "Exam Fees", classId: s.classA.id, amount: 150 } });
  await prisma.fee.create({ data: { feesId: "F2", feesType: "Transport Fees", classId: s.classA.id, amount: 80.5 } });
  const nine = await prisma.class.create({ data: { name: "9", section: "A" } });
  await prisma.fee.create({ data: { feesId: "F3", feesType: "Hostel Fees", classId: nine.id, amount: 999 } });
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

const pay = (studentId, feesType, amount, paidDate = "2026-03-01") => admin.send("/fees-collections", { studentId, feesType, amount, paidDate });

test("statement maths: fees by class level, part payments, credit, and no float drift", () => {
  const fees = [
    { feesType: "Exam Fees", amount: 0.1, classRef: { name: "10" } },
    { feesType: "Exam Fees", amount: 0.2, classRef: { name: "10" } },
    { feesType: "Hostel Fees", amount: 500, classRef: { name: "9" } },
    { feesType: "Class Test", amount: 25, classRef: null },
  ];
  const st = computeStatement(fees, [{ feesType: "Exam Fees", amount: 0.3 }, { feesType: "Class Test", amount: 30 }], "10");
  const exam = st.lines.find((l) => l.feesType === "Exam Fees");
  assert.equal(exam.due, 0.3);
  assert.equal(exam.outstanding, 0, "0.1 + 0.2 owed, 0.3 paid: nothing left");
  assert.equal(st.lines.find((l) => l.feesType === "Class Test").overpaid, 5);
  assert.equal(st.lines.some((l) => l.feesType === "Hostel Fees"), false, "class 9's fee is not owed by class 10");
  assert.equal(remainingFor(computeStatement(fees, [], "10"), "Hostel Fees"), null);
  assert.equal(remainingFor(computeStatement(fees, [{ feesType: "Class Test", amount: 10 }], "10"), "Class Test"), 15);
  assert.equal(remainingFor(computeStatement(fees, [{ feesType: "Class Test", amount: 10 }], "10"), "Class Test", { amount: 10 }), 25, "editing a payment frees its own amount");
});

test("a payment within what is owed is accepted, and part-payments add up", async () => {
  assert.equal((await pay("S1", "Exam Fees", "100")).status, 302);
  assert.equal((await pay("S1", "Exam Fees", "50")).status, 302);
  const st = computeStatement(await prisma.fee.findMany({ include: { classRef: true } }), await prisma.feesCollection.findMany({ where: { studentId: s.inClass.id } }), "10");
  assert.equal(st.lines.find((l) => l.feesType === "Exam Fees").outstanding, 0);
});

test("paying more than is owed is refused and nothing is recorded", async () => {
  const count = await prisma.feesCollection.count();
  const res = await pay("S1", "Exam Fees", "0.01");
  assert.equal(res.status, 400);
  assert.match(res.text, /more than is owed/);
  assert.match(res.text, /Outstanding for Exam Fees: 0\.00/);
  assert.equal(await prisma.feesCollection.count(), count);

  const big = await pay("S1", "Transport Fees", "80.51");
  assert.equal(big.status, 400);
  assert.match(big.text, /80\.50/);
  assert.equal((await pay("S1", "Transport Fees", "80.50")).status, 302, "exactly the balance is fine");
});

test("a fee not on the schedule for the student's class, zero, negative and junk amounts are refused", async () => {
  const noFee = await pay("S1", "Hostel Fees", "10");
  assert.equal(noFee.status, 400);
  assert.match(noFee.text, /is on the Fees schedule for class 10/);
  assert.equal((await pay("S1", "Mess Fees", "10")).status, 400);
  assert.equal((await pay("S2", "Exam Fees", "0")).status, 400);
  assert.equal((await pay("S2", "Exam Fees", "-5")).status, 400);
  assert.equal((await pay("S2", "Exam Fees", "abc")).status, 400);
  assert.equal((await pay("S2", "Exam Fees", "10.123")).status, 400);
  assert.equal((await pay("S2", "Exam Fees", "10", "2999-01-01")).status, 400, "no payments dated in the future");
  assert.equal((await pay("S2", "Made Up Fees", "10")).status, 400);
  assert.equal(await prisma.feesCollection.count({ where: { studentId: s.otherClass.id } }), 0);
});

test("editing a payment is checked too, and may use its own amount", async () => {
  const first = await prisma.feesCollection.findFirst({ where: { studentId: s.inClass.id, feesType: "Exam Fees" }, orderBy: { id: "asc" } });
  // 100 + 50 = 150 owed in full; raising the first one to 101 would make 151
  const tooMuch = await admin.send(`/fees-collections/${first.id}`, { studentId: "S1", feesType: "Exam Fees", amount: "101", paidDate: "2026-03-01" });
  assert.equal(tooMuch.status, 400);
  assert.equal((await prisma.feesCollection.findUnique({ where: { id: first.id } })).amount, 100);
  const ok = await admin.send(`/fees-collections/${first.id}`, { studentId: "S1", feesType: "Exam Fees", amount: "90", paidDate: "2026-03-01" });
  assert.equal(ok.status, 302);
  assert.equal((await prisma.feesCollection.findUnique({ where: { id: first.id } })).amount, 90);
});

test("the outstanding report lists who owes what, and student pages show the statement", async () => {
  const page = (await admin.get("/fees-collections/outstanding")).text;
  assert.match(page, /S2/, "the second student owes everything");
  assert.match(page, /230\.50/);
  assert.equal((await admin.get(`/students/${s.inClass.id}`)).status, 200);
  assert.match((await admin.get(`/students/${s.inClass.id}`)).text, /Exam Fees/);

  const student = ctx.browser();
  await student.login("student@test.local", "password123", "student");
  const dash = await student.get("/student/dashboard");
  assert.equal(dash.status, 200);
  assert.match(dash.text, /Exam Fees/);
  assert.equal((await student.get("/fees-collections/outstanding")).status, 403);
});

test("a fee that has payments cannot be deleted; an unused one can", async () => {
  const used = await prisma.fee.findUnique({ where: { feesId: "F1" } });
  const res = await admin.send(`/fees/${used.id}/delete`);
  assert.equal(res.headers.get("location"), "/fees?notice=has-payments");
  assert.equal(await prisma.fee.count({ where: { id: used.id } }), 1);

  const unused = await prisma.fee.findUnique({ where: { feesId: "F3" } });
  assert.equal((await admin.send(`/fees/${unused.id}/delete`)).headers.get("location"), "/fees");
  assert.equal(await prisma.fee.count({ where: { id: unused.id } }), 0);
});
