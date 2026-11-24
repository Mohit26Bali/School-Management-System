// Run with: node --test tests/promotion.test.js
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");

let ctx, prisma, s, admin, from, to, small, kids;

before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  from = await prisma.class.create({ data: { name: "9", section: "A", capacity: 10 } });
  to = await prisma.class.create({ data: { name: "10", section: "C", capacity: 10 } });
  small = await prisma.class.create({ data: { name: "10", section: "D", capacity: 2 } });
  kids = [];
  for (let i = 1; i <= 4; i++) kids.push(await prisma.student.create({ data: { firstName: `Kid${i}`, lastName: "Nine", studentId: `P${i}`, classId: from.id } }));
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

// POSTs the promotion form (studentIds repeat, like ticked boxes)
async function move(target, ids, fromId = from.id) {
  const body = new URLSearchParams();
  body.append("_csrf", await admin.csrf());
  body.append("fromId", String(fromId));
  body.append("target", String(target));
  for (const id of ids) body.append("studentIds", String(id));
  return admin.postRaw("/promotion", body.toString(), { "content-type": "application/x-www-form-urlencoded" });
}
// The message shown once after the redirect, so this must be the very next request
const shown = async (fromId = from.id) => (await admin.get(`/promotion?from=${fromId}`)).text;
const classOf = async (student) => (await prisma.student.findUnique({ where: { id: student.id } })).classId;

test("the page lists a class's active students and the places free elsewhere", async () => {
  const page = await shown();
  assert.match(page, /Kid1/);
  assert.match(page, /10 C \(10 places free\)/);
  assert.match(page, /Graduate/);
  assert.doesNotMatch((await admin.get("/promotion")).text, /Kid1/, "no class picked, no list");
});

test("ticked students move to the next class and the rest stay", async () => {
  const res = await move(to.id, [kids[0].id, kids[1].id]);
  assert.equal(res.headers.get("location"), `/promotion?from=${from.id}`);
  assert.match(await shown(), /Moved 2 students from 9 A to 10 C/);
  assert.deepEqual([await classOf(kids[0]), await classOf(kids[1]), await classOf(kids[2]), await classOf(kids[3])], [to.id, to.id, from.id, from.id]);
});

test("a destination without enough free places refuses the whole move", async () => {
  const extra = await prisma.student.create({ data: { firstName: "Extra", lastName: "Nine", studentId: "P9", classId: from.id } });
  await move(small.id, [kids[2].id, kids[3].id, extra.id]);
  assert.match(await shown(), /has 2 free places .*but you are moving 3/);
  for (const k of [kids[2], kids[3], extra]) assert.equal(await classOf(k), from.id, "nobody moved");

  await move(small.id, [kids[2].id, kids[3].id]);
  assert.match(await shown(), /Moved 2 students from 9 A to 10 D/);
  await prisma.student.updateMany({ where: { id: { in: [kids[2].id, kids[3].id] } }, data: { classId: from.id } }); // back for the next tests
});

test("students from another class, the same class, odd ids and missing choices are refused", async () => {
  await move(to.id, [s.inClass.id]); // s.inClass is in 10 A, not 9 A
  assert.match(await shown(), /None of those students are in that class/);
  assert.equal(await classOf(s.inClass), s.classA.id);

  await move(from.id, [kids[2].id]);
  assert.match(await shown(), /already in that class/);
  await move("", [kids[2].id]);
  assert.match(await shown(), /Choose where they are going/);
  await move(to.id, []);
  assert.match(await shown(), /Tick at least one student/);
  await move(to.id, ["abc", "1; DROP TABLE"]);
  assert.match(await shown(), /Tick at least one student/);
  await move(to.id, [kids[2].id], 99999);
  assert.match(await shown(null), /Choose the class/);
});

test("an inactive student cannot be promoted", async () => {
  await prisma.student.update({ where: { id: kids[3].id }, data: { active: false } });
  await move(to.id, [kids[3].id]);
  assert.match(await shown(), /None of those students are in that class/);
  assert.equal(await classOf(kids[3]), from.id);
  await prisma.student.update({ where: { id: kids[3].id }, data: { active: true } });
});

test("graduating ends the room, stops the login, keeps the records, and skips students with books out", async () => {
  const user = await prisma.user.create({ data: { name: "Grad", email: "grad@test.local", passwordHash: ctx.hash, role: "student" } });
  await prisma.student.update({ where: { id: kids[2].id }, data: { userId: user.id } });
  const room = await prisma.hostelRoom.create({ data: { block: "Z", roomNo: "1", noOfBeds: 2 } });
  await prisma.hostelAllocation.create({ data: { roomId: room.id, studentId: kids[2].id, startedOn: new Date() } });
  const book = await prisma.book.create({ data: { bookId: "PB", name: "Held", status: "Out of Stock" } });
  await prisma.loan.create({ data: { bookId: book.id, studentId: kids[3].id, issuedOn: new Date(), dueOn: new Date(Date.now() + 86400000) } });

  await move("graduate", [kids[2].id, kids[3].id]);
  const text = await shown();
  assert.match(text, /Graduated 1 student from 9 A/);
  assert.match(text, /1 could not graduate because they still have library books out/);

  const grad = await prisma.student.findUnique({ where: { id: kids[2].id } });
  assert.equal(grad.active, false);
  assert.ok(grad.leftOn);
  assert.equal(grad.classId, from.id, "the class they finished in is kept");
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).active, false);
  assert.equal(await prisma.hostelAllocation.count({ where: { studentId: kids[2].id, endedOn: null } }), 0);
  assert.equal(await prisma.hostelAllocation.count({ where: { studentId: kids[2].id } }), 1, "the stay stays in the history");
  assert.equal((await ctx.browser().login("grad@test.local", "password123", "student")).status, 401);
  assert.equal((await prisma.student.findUnique({ where: { id: kids[3].id } })).active, true, "the one with a book stays");

  await move("graduate", [kids[3].id]);
  assert.match(await shown(), /Every one of them still has library books out/);
});

test("only admins can promote", async () => {
  const teacher = ctx.browser();
  await teacher.login("teacher@test.local", "password123", "teacher");
  assert.equal((await teacher.get("/promotion")).status, 403);
  assert.equal((await teacher.send("/promotion", { fromId: String(from.id), target: "graduate", studentIds: String(kids[3].id) })).status, 403);
  assert.equal((await ctx.browser().get("/promotion")).headers.get("location"), "/login");
});
