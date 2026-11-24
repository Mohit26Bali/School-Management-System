// Who lives in which hostel room, and who rides which transport route. The two work the same way, so they share this file:
// one current assignment per student, a place must be free, and ending an assignment keeps the history.
const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { setFlash } = require("../utils/flash");
const { today } = require("../utils/library");

const prisma = new PrismaClient();

function text(v) {
  return typeof v === "string" ? v.trim() : "";
}

// ---------- hostel ----------
async function roomsWithSpace() {
  const rooms = await prisma.hostelRoom.findMany({
    orderBy: [{ block: "asc" }, { roomNo: "asc" }],
    include: { _count: { select: { allocations: { where: { endedOn: null } } } } },
  });
  return rooms.map((r) => {
    const beds = r.noOfBeds || 1;
    return { ...r, beds, occupied: r._count.allocations, free: Math.max(0, beds - r._count.allocations) };
  });
}

async function hostelList(req, res) {
  const show = req.query.show === "history" ? "history" : "current";
  const stays = await prisma.hostelAllocation.findMany({
    where: show === "current" ? { endedOn: null } : { endedOn: { not: null } },
    include: { room: true, student: true },
    orderBy: show === "current" ? { startedOn: "desc" } : { endedOn: "desc" },
    take: 200,
  });
  res.render("hostel/allocations", { title: "Hostel Residents", currentPage: "hostel-residents", stays, show });
}

async function hostelForm(req, res) {
  res.render("hostel/allocate", { title: "Allocate a Room", currentPage: "hostel-residents", rooms: await roomsWithSpace() });
}

async function hostelAllocate(req, res) {
  const rooms = await roomsWithSpace();
  const fail = (error) => res.status(400).render("hostel/allocate", { title: "Allocate a Room", currentPage: "hostel-residents", rooms, error, values: req.body });

  const roomId = /^\d+$/.test(text(req.body.roomId)) ? Number(req.body.roomId) : null;
  const room = rooms.find((r) => r.id === roomId);
  const code = text(req.body.studentId);
  if (!room) return fail("Choose a room.");
  if (!code) return fail("Student ID is required.");
  if (room.availability !== "Available") return fail(`Room ${room.roomNo} (Block ${room.block}) is marked "${room.availability}".`);
  if (room.free < 1) return fail(`Room ${room.roomNo} (Block ${room.block}) is full (${room.occupied} of ${room.beds} beds).`);

  const student = await prisma.student.findFirst({ where: { studentId: code, active: true } });
  if (!student) return fail(`No active student found with Student ID "${code}".`);
  const current = await prisma.hostelAllocation.findFirst({ where: { studentId: student.id, endedOn: null }, include: { room: true } });
  if (current) return fail(`${student.firstName} ${student.lastName} already lives in Room ${current.room.roomNo} (Block ${current.room.block}). Vacate that first.`);

  await prisma.hostelAllocation.create({ data: { roomId: room.id, studentId: student.id, startedOn: today() } });
  setFlash(req, "success", `${student.firstName} ${student.lastName} moved into Room ${room.roomNo} (Block ${room.block}).`);
  res.redirect("/hostel/allocations");
}

async function hostelVacate(req, res) {
  const stay = await prisma.hostelAllocation.findUnique({ where: { id: Number(req.params.id) }, include: { room: true, student: true } });
  if (!stay) return res.status(404).render("errors/404", { title: "Not Found" });
  if (stay.endedOn) setFlash(req, "warning", "That stay has already ended.");
  else {
    await prisma.hostelAllocation.update({ where: { id: stay.id }, data: { endedOn: today() } });
    setFlash(req, "success", `${stay.student.firstName} ${stay.student.lastName} left Room ${stay.room.roomNo} (Block ${stay.room.block}).`);
  }
  res.redirect("/hostel/allocations");
}

// ---------- transport ----------
async function routesWithSeats() {
  const routes = await prisma.transport.findMany({
    orderBy: { routeName: "asc" },
    include: { _count: { select: { riders: { where: { endedOn: null } } } } },
  });
  return routes.map((r) => ({ ...r, riding: r._count.riders, free: r.seats ? Math.max(0, r.seats - r._count.riders) : null }));
}

async function transportList(req, res) {
  const show = req.query.show === "history" ? "history" : "current";
  const rides = await prisma.transportRider.findMany({
    where: show === "current" ? { endedOn: null } : { endedOn: { not: null } },
    include: { transport: true, student: true },
    orderBy: show === "current" ? { startedOn: "desc" } : { endedOn: "desc" },
    take: 200,
  });
  res.render("transport/riders", { title: "Transport Riders", currentPage: "transport-riders", rides, show });
}

async function transportForm(req, res) {
  res.render("transport/assign", { title: "Assign a Route", currentPage: "transport-riders", routes: await routesWithSeats() });
}

async function transportAssign(req, res) {
  const routes = await routesWithSeats();
  const fail = (error) => res.status(400).render("transport/assign", { title: "Assign a Route", currentPage: "transport-riders", routes, error, values: req.body });

  const routeId = /^\d+$/.test(text(req.body.routeId)) ? Number(req.body.routeId) : null;
  const route = routes.find((r) => r.id === routeId);
  const code = text(req.body.studentId);
  if (!route) return fail("Choose a route.");
  if (!code) return fail("Student ID is required.");
  if (route.seats && route.free < 1) return fail(`${route.routeName} is full (${route.riding} of ${route.seats} seats).`);

  const student = await prisma.student.findFirst({ where: { studentId: code, active: true } });
  if (!student) return fail(`No active student found with Student ID "${code}".`);
  const current = await prisma.transportRider.findFirst({ where: { studentId: student.id, endedOn: null }, include: { transport: true } });
  if (current) return fail(`${student.firstName} ${student.lastName} already rides ${current.transport.routeName}. Remove them from it first.`);

  await prisma.transportRider.create({ data: { transportId: route.id, studentId: student.id, startedOn: today() } });
  setFlash(req, "success", `${student.firstName} ${student.lastName} now rides ${route.routeName}.`);
  res.redirect("/transport/riders");
}

async function transportEnd(req, res) {
  const ride = await prisma.transportRider.findUnique({ where: { id: Number(req.params.id) }, include: { transport: true, student: true } });
  if (!ride) return res.status(404).render("errors/404", { title: "Not Found" });
  if (ride.endedOn) setFlash(req, "warning", "That ride has already ended.");
  else {
    await prisma.transportRider.update({ where: { id: ride.id }, data: { endedOn: today() } });
    setFlash(req, "success", `${ride.student.firstName} ${ride.student.lastName} no longer rides ${ride.transport.routeName}.`);
  }
  res.redirect("/transport/riders");
}

module.exports = wrapController({ hostelList, hostelForm, hostelAllocate, hostelVacate, transportList, transportForm, transportAssign, transportEnd });
