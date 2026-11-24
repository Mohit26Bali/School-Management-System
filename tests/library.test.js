// Run with: node --test tests/library.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");
const { settings, addDays, overdueDays, fineFor } = require("../src/utils/library");

let ctx, prisma, s, admin, books;

before(async () => {
  ctx = await startApp({ env: { LIBRARY_LOAN_DAYS: "14", LIBRARY_MAX_LOANS: "2", LIBRARY_FINE_PER_DAY: "0.50" } });
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  books = [];
  for (let i = 1; i <= 4; i++) books.push(await prisma.book.create({ data: { bookId: `BK${i}`, name: `Book ${i}`, status: "In Stock" } }));
  await prisma.book.create({ data: { bookId: "BK-LOST", name: "Lost Book", status: "Out of Stock" } });
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

// Loans are in whole days at midnight UTC, like the app stores them
const daysAgo = (n) => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - n));
};
const issue = (bookId, studentId = "S1") => admin.send("/library/loans", { bookId, studentId });
const pageText = async () => (await admin.get("/library/loans")).text;

test("library rules: settings, due dates, lateness and fines", () => {
  assert.deepEqual(settings({}), { loanDays: 14, maxLoans: 3, finePerDay: 1 });
  assert.deepEqual(settings({ LIBRARY_LOAN_DAYS: "7", LIBRARY_MAX_LOANS: "5", LIBRARY_FINE_PER_DAY: "0.25" }), { loanDays: 7, maxLoans: 5, finePerDay: 0.25 });
  assert.equal(settings({ LIBRARY_LOAN_DAYS: "0" }).loanDays, 14);
  assert.equal(settings({ LIBRARY_FINE_PER_DAY: "-3" }).finePerDay, 1);
  assert.equal(settings({ LIBRARY_FINE_PER_DAY: "0" }).finePerDay, 0, "0 switches fines off");
  const issued = new Date("2026-03-02");
  assert.equal(addDays(issued, 14).toISOString().slice(0, 10), "2026-03-16");
  const due = new Date("2026-03-16");
  assert.equal(overdueDays(due, new Date("2026-03-16")), 0, "on the due day is not late");
  assert.equal(overdueDays(due, new Date("2026-03-10")), 0);
  assert.equal(overdueDays(due, new Date("2026-03-19")), 3);
  assert.equal(fineFor(3, 0.5), 1.5);
  assert.equal(fineFor(0, 1), 0);
  assert.equal(fineFor(3, 0.1), 0.3, "no float drift");
});

test("issuing a book creates a loan due in 14 days and marks the book out", async () => {
  const res = await issue("BK1");
  assert.equal(res.headers.get("location"), "/library/loans");
  assert.match(await pageText(), /Issued &#34;Book 1&#34; to In Class/);
  const loan = await prisma.loan.findFirst({ where: { bookId: books[0].id } });
  assert.equal(loan.studentId, s.inClass.id);
  assert.equal(Math.round((loan.dueOn - loan.issuedOn) / 86400000), 14);
  assert.equal((await prisma.book.findUnique({ where: { id: books[0].id } })).status, "Out of Stock");
  assert.match(await pageText(), /Book 1/);
});

test("a book that is out cannot be issued twice, and an out-of-stock book cannot be issued", async () => {
  const count = await prisma.loan.count();
  assert.match((await issue("BK1", "S2")).text, /already out on loan/);
  assert.match((await issue("BK-LOST")).text, /marked &#34;Out of Stock&#34;/);
  assert.equal(await prisma.loan.count(), count);
});

test("unknown books and students, inactive students and odd input are refused", async () => {
  const count = await prisma.loan.count();
  assert.match((await issue("NOPE")).text, /No book found/);
  assert.match((await issue("BK2", "NOPE")).text, /No active student/);
  await prisma.student.update({ where: { id: s.otherClass.id }, data: { active: false } });
  assert.match((await issue("BK2", "S2")).text, /No active student/);
  await prisma.student.update({ where: { id: s.otherClass.id }, data: { active: true } });
  assert.equal((await issue("", "")).status, 400);
  const odd = await admin.postRaw("/library/loans", `_csrf=${await admin.csrf()}&bookId[]=BK2&studentId=S1`, { "content-type": "application/x-www-form-urlencoded" });
  assert.equal(odd.status, 400);
  assert.equal(await prisma.loan.count(), count);
});

test("a student cannot have more books out than the limit, nor borrow while one is overdue", async () => {
  assert.equal((await issue("BK2")).status, 302);
  const limit = await issue("BK3");
  assert.equal(limit.status, 400);
  assert.match(limit.text, /already has 2 books out/);

  // make S2's only loan overdue, then try a second book
  assert.equal((await issue("BK3", "S2")).status, 302);
  await prisma.loan.updateMany({ where: { bookId: books[2].id }, data: { dueOn: daysAgo(3) } });
  const overdue = await issue("BK4", "S2");
  assert.equal(overdue.status, 400);
  assert.match(overdue.text, /has an overdue book/);
});

test("returning on time costs nothing and puts the book back in stock", async () => {
  const loan = await prisma.loan.findFirst({ where: { bookId: books[0].id, returnedOn: null } });
  const res = await admin.send(`/library/loans/${loan.id}/return`);
  assert.equal(res.headers.get("location"), "/library/loans");
  assert.match(await pageText(), /returned by In Class/);
  const done = await prisma.loan.findUnique({ where: { id: loan.id } });
  assert.ok(done.returnedOn);
  assert.equal(done.fine, 0);
  assert.equal((await prisma.book.findUnique({ where: { id: books[0].id } })).status, "In Stock");
  assert.match((await admin.get("/library/loans?show=history")).text, /Book 1/);
});

test("returning late charges the fine per day, and a second return is refused", async () => {
  const loan = await prisma.loan.findFirst({ where: { bookId: books[2].id, returnedOn: null } }); // overdue by 3 days
  await admin.send(`/library/loans/${loan.id}/return`);
  assert.match(await pageText(), /3 days late: fine 1\.50/);
  assert.equal((await prisma.loan.findUnique({ where: { id: loan.id } })).fine, 1.5);

  await admin.send(`/library/loans/${loan.id}/return`);
  assert.match(await pageText(), /already been returned/);
  assert.equal((await prisma.book.findUnique({ where: { id: books[2].id } })).status, "In Stock");
  assert.equal((await admin.send("/library/loans/99999/return")).status, 404);
});

test("once the overdue book is back, the student can borrow again", async () => {
  assert.equal((await issue("BK4", "S2")).status, 302);
});

test("a book on loan cannot be marked In Stock or deleted; one with history cannot be deleted", async () => {
  const out = await prisma.loan.findFirst({ where: { returnedOn: null } });
  const book = await prisma.book.findUnique({ where: { id: out.bookId } });
  const edit = await admin.send(`/library/${book.id}`, { bookId: book.bookId, name: book.name, status: "In Stock" });
  assert.equal(edit.status, 400);
  assert.match(edit.text, /out on loan/);
  assert.equal((await prisma.book.findUnique({ where: { id: book.id } })).status, "Out of Stock");

  await admin.send(`/library/${book.id}/delete`);
  assert.match((await admin.get("/library")).text, /lending history/);
  assert.equal(await prisma.book.count({ where: { id: book.id } }), 1);

  const fresh = await prisma.book.create({ data: { bookId: "BK-NEW", name: "Never lent" } });
  await admin.send(`/library/${fresh.id}/delete`);
  assert.equal(await prisma.book.count({ where: { id: fresh.id } }), 0, "a book that was never lent can go");
  assert.equal((await admin.send("/library/99999/delete")).status, 404);
});

test("only admins use the library desk", async () => {
  const student = ctx.browser();
  await student.login("student@test.local", "password123", "student");
  assert.equal((await student.get("/library/loans")).status, 403);
  assert.equal((await student.send("/library/loans", { bookId: "BK2", studentId: "S1" })).status, 403);
  assert.equal((await ctx.browser().get("/library/loans")).headers.get("location"), "/login");
});
