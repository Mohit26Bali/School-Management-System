// Run with: node --test tests/stays.test.js
// Hostel rooms and transport routes: places are limited, one assignment per student, history is kept.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, seedBasics } = require("./helpers");

let ctx, prisma, s, admin, room, tiny, route, minibus;

before(async () => {
  ctx = await startApp();
  prisma = ctx.prisma;
  s = await seedBasics(prisma, ctx.hash);
  room = await prisma.hostelRoom.create({ data: { block: "A", roomNo: "101", noOfBeds: 2, availability: "Available" } });
  tiny = await prisma.hostelRoom.create({ data: { block: "A", roomNo: "102", noOfBeds: 1, availability: "Available" } });
  await prisma.hostelRoom.create({ data: { block: "B", roomNo: "201", noOfBeds: 4, availability: "Not Available" } });
  route = await prisma.transport.create({ data: { routeName: "North Loop", vehicleNumber: "BUS-1" } });
  minibus = await prisma.transport.create({ data: { routeName: "Mini", vehicleNumber: "BUS-2", seats: 1 } });
  for (const code of ["S5", "S6"]) await prisma.student.create({ data: { firstName: "Extra", lastName: code, studentId: code, classId: s.classA.id } });
  admin = await ctx.adminBrowser();
});
after(() => ctx.stop());

const flashAfter = async (url) => (await admin.get(url)).text;

test("a room takes students up to its beds, one room per student", async () => {
  const put = (roomId, studentId) => admin.send("/hostel/allocations", { roomId: String(roomId), studentId });
  const ok = await put(room.id, "S1");
  assert.equal(ok.headers.get("location"), "/hostel/allocations");
  assert.match(await flashAfter("/hostel/allocations"), /moved into Room 101/);
  assert.equal((await put(room.id, "S2")).status, 302);

  const full = await put(room.id, "S5");
  assert.equal(full.status, 400);
  assert.match(full.text, /is full \(2 of 2 beds\)/);

  const twice = await put(tiny.id, "S1");
  assert.equal(twice.status, 400);
  assert.match(twice.text, /already lives in Room 101/);
  assert.equal(await prisma.hostelAllocation.count({ where: { endedOn: null } }), 2);
});

test("hostel refusals: unavailable room, unknown or inactive student, no room chosen, odd input", async () => {
  const blocked = await prisma.hostelRoom.findFirst({ where: { roomNo: "201" } });
  assert.match((await admin.send("/hostel/allocations", { roomId: String(blocked.id), studentId: "S5" })).text, /marked &#34;Not Available&#34;/);
  assert.match((await admin.send("/hostel/allocations", { roomId: String(tiny.id), studentId: "NOPE" })).text, /No active student/);
  await prisma.student.update({ where: { studentId: "S6" }, data: { active: false } });
  assert.match((await admin.send("/hostel/allocations", { roomId: String(tiny.id), studentId: "S6" })).text, /No active student/);
  assert.match((await admin.send("/hostel/allocations", { roomId: "", studentId: "S5" })).text, /Choose a room/);
  assert.match((await admin.send("/hostel/allocations", { roomId: "abc", studentId: "S5" })).text, /Choose a room/);
  const odd = await admin.postRaw("/hostel/allocations", `_csrf=${await admin.csrf()}&roomId[]=1&studentId=S5`, { "content-type": "application/x-www-form-urlencoded" });
  assert.equal(odd.status, 400);
  assert.equal(await prisma.hostelAllocation.count(), 2);
  await prisma.student.update({ where: { studentId: "S6" }, data: { active: true } });
});

test("vacating frees the bed and keeps the history; the room cannot lose beds or be deleted while it matters", async () => {
  const stay = await prisma.hostelAllocation.findFirst({ where: { roomId: room.id, student: { studentId: "S2" } } });
  await admin.send(`/hostel/allocations/${stay.id}/vacate`);
  assert.match(await flashAfter("/hostel/allocations"), /left Room 101/);
  assert.ok((await prisma.hostelAllocation.findUnique({ where: { id: stay.id } })).endedOn);
  assert.match((await admin.get("/hostel/allocations?show=history")).text, /Class|S2|In/);
  assert.equal((await admin.send("/hostel/allocations", { roomId: String(room.id), studentId: "S5" })).status, 302, "the freed bed can be used");

  // two now live in room 101 again (S1 and S5): beds cannot drop below 2, and the room cannot be deleted
  const shrink = await admin.send(`/hostel/${room.id}`, { block: "A", roomNo: "101", noOfBeds: "1", availability: "Available" });
  assert.equal(shrink.status, 400);
  assert.match(shrink.text, /cannot have fewer than 2 beds/);
  await admin.send(`/hostel/${room.id}/delete`);
  assert.match(await flashAfter("/hostel"), /cannot be deleted/);
  assert.equal(await prisma.hostelRoom.count({ where: { id: room.id } }), 1);

  await admin.send(`/hostel/allocations/${stay.id}/vacate`);
  assert.match(await flashAfter("/hostel/allocations"), /already ended/);
  assert.equal((await admin.send("/hostel/allocations/99999/vacate")).status, 404);
});

test("a route with seats stops at its seats; without seats it is unlimited; one route per student", async () => {
  const put = (routeId, studentId) => admin.send("/transport/riders", { routeId: String(routeId), studentId });
  assert.equal((await put(minibus.id, "S1")).status, 302);
  assert.match(await flashAfter("/transport/riders"), /now rides Mini/);
  const full = await put(minibus.id, "S2");
  assert.equal(full.status, 400);
  assert.match(full.text, /is full \(1 of 1 seats\)/);
  const second = await put(route.id, "S1");
  assert.equal(second.status, 400);
  assert.match(second.text, /already rides Mini/);

  for (const code of ["S2", "S5", "S6"]) assert.equal((await put(route.id, code)).status, 302, code);
  assert.equal(await prisma.transportRider.count({ where: { transportId: route.id, endedOn: null } }), 3);
  assert.match((await put(route.id, "NOPE")).text, /No active student/);
  assert.match((await put("", "S2")).text, /Choose a route/);
});

test("ending a ride frees the seat; routes keep history and cannot lose seats or be deleted", async () => {
  const ride = await prisma.transportRider.findFirst({ where: { transportId: minibus.id, endedOn: null } });
  await admin.send(`/transport/riders/${ride.id}/end`);
  assert.match(await flashAfter("/transport/riders"), /no longer rides Mini/);
  assert.equal((await admin.send("/transport/riders", { routeId: String(minibus.id), studentId: "S2" })).status, 400, "S2 already rides North Loop");
  assert.equal((await admin.send("/transport/riders", { routeId: String(minibus.id), studentId: "S1" })).status, 302, "the seat is free and S1 is free to ride again");

  const shrink = await admin.send(`/transport/${route.id}`, { routeName: "North Loop", vehicleNumber: "BUS-1", seats: "2" });
  assert.equal(shrink.status, 400);
  assert.match(shrink.text, /cannot have fewer than 3 seats/);
  await admin.send(`/transport/${route.id}/delete`);
  assert.match(await flashAfter("/transport"), /cannot be deleted/);
  assert.equal(await prisma.transport.count({ where: { id: route.id } }), 1);

  await admin.send(`/transport/riders/${ride.id}/end`);
  assert.match(await flashAfter("/transport/riders"), /already ended/);
  assert.equal((await admin.send("/transport/riders/99999/end")).status, 404);
});

test("seats can be set on a route from the form, and blank means unlimited", async () => {
  const fresh = await prisma.transport.create({ data: { routeName: "East", vehicleNumber: "BUS-9", seats: 5 } });
  await admin.send(`/transport/${fresh.id}`, { routeName: "East", vehicleNumber: "BUS-9", seats: "" });
  assert.equal((await prisma.transport.findUnique({ where: { id: fresh.id } })).seats, null);
  await admin.send(`/transport/${fresh.id}`, { routeName: "East", vehicleNumber: "BUS-9", seats: "40" });
  assert.equal((await prisma.transport.findUnique({ where: { id: fresh.id } })).seats, 40);
  await admin.send(`/transport/${fresh.id}`, { routeName: "East", vehicleNumber: "BUS-9", seats: "-3" });
  assert.equal((await prisma.transport.findUnique({ where: { id: fresh.id } })).seats, null, "a nonsense value means unlimited, never a crash");
  await admin.send(`/transport/${fresh.id}/delete`);
  assert.equal(await prisma.transport.count({ where: { id: fresh.id } }), 0, "an unused route can be deleted");
});

test("a student who leaves is moved out of the room and off the route, but only after returning books", async () => {
  const leaver = await prisma.student.create({ data: { firstName: "Going", lastName: "Away", studentId: "LV1", classId: s.classA.id } });
  const book = await prisma.book.create({ data: { bookId: "LV-BK", name: "Held Book", status: "In Stock" } });
  const free = await prisma.hostelRoom.create({ data: { block: "C", roomNo: "301", noOfBeds: 2, availability: "Available" } });
  await admin.send("/hostel/allocations", { roomId: String(free.id), studentId: "LV1" });
  await admin.send("/transport/riders", { routeId: String(route.id), studentId: "LV1" });
  await admin.send("/library/loans", { bookId: "LV-BK", studentId: "LV1" });

  const page = (await admin.get(`/students/${leaver.id}`)).text;
  assert.match(page, /Room 301 \(Block C\)/);
  assert.match(page, /North Loop/);

  await admin.send(`/students/${leaver.id}/delete`);
  assert.match(await flashAfter("/students"), /still has library books out/);
  assert.equal((await prisma.student.findUnique({ where: { id: leaver.id } })).active, true);

  const loan = await prisma.loan.findFirst({ where: { bookId: book.id, returnedOn: null } });
  await admin.send(`/library/loans/${loan.id}/return`);
  await admin.send(`/students/${leaver.id}/delete`);
  assert.equal((await prisma.student.findUnique({ where: { id: leaver.id } })).active, false);
  assert.equal(await prisma.hostelAllocation.count({ where: { studentId: leaver.id, endedOn: null } }), 0);
  assert.equal(await prisma.transportRider.count({ where: { studentId: leaver.id, endedOn: null } }), 0);
  assert.equal(await prisma.hostelAllocation.count({ where: { studentId: leaver.id } }), 1, "the stay stays in the history");
});

test("only admins see the hostel and transport desks", async () => {
  const student = ctx.browser();
  await student.login("student@test.local", "password123", "student");
  for (const url of ["/hostel/allocations", "/transport/riders", "/hostel/allocations/allocate", "/transport/riders/assign"]) {
    assert.equal((await student.get(url)).status, 403, url);
  }
  assert.equal((await admin.get("/hostel/allocations/allocate")).status, 200);
  assert.equal((await admin.get("/transport/riders/assign")).status, 200);
});
