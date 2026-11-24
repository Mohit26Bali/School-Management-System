const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { setFlash } = require("../utils/flash");

const prisma = new PrismaClient();

const ROOM_TYPES = ["Normal", "AC", "Suite"];
const AVAILABILITY = ["Available", "Not Available"];

function fieldsFromBody(body) {
  return {
    block: body.block,
    roomNo: body.roomNo,
    roomType: body.roomType || null,
    noOfBeds: body.noOfBeds ? parseInt(body.noOfBeds, 10) : null,
    costPerBed: body.costPerBed ? parseFloat(body.costPerBed) : null,
    availability: body.availability || "Available",
  };
}

const formOptions = { roomTypes: ROOM_TYPES, availabilityOptions: AVAILABILITY };

async function list(req, res) {
  const rooms = await prisma.hostelRoom.findMany({ orderBy: { id: "desc" } });
  res.render("hostel/list", { title: "Hostel", currentPage: "hostel", rooms });
}

function showAdd(req, res) {
  res.render("hostel/add", { title: "Add Room", currentPage: "hostel", ...formOptions });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.block || !data.roomNo) {
    return res.status(400).render("hostel/add", {
      title: "Add Room",
      currentPage: "hostel",
      ...formOptions,
      error: "Block and Room No are required.",
      values: req.body,
    });
  }

  const existing = await prisma.hostelRoom.findUnique({
    where: { block_roomNo: { block: data.block, roomNo: data.roomNo } },
  });
  if (existing) {
    return res.status(400).render("hostel/add", {
      title: "Add Room",
      currentPage: "hostel",
      ...formOptions,
      error: `Room "${data.roomNo}" in Block "${data.block}" already exists.`,
      values: req.body,
    });
  }

  await prisma.hostelRoom.create({ data });
  res.redirect("/hostel");
}

async function showEdit(req, res) {
  const room = await prisma.hostelRoom.findUnique({ where: { id: Number(req.params.id) } });
  if (!room) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("hostel/edit", { title: "Edit Room", currentPage: "hostel", room, ...formOptions });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const room = await prisma.hostelRoom.findUnique({ where: { id } });
  if (!room) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.block !== room.block || data.roomNo !== room.roomNo) {
    const existing = await prisma.hostelRoom.findUnique({
      where: { block_roomNo: { block: data.block, roomNo: data.roomNo } },
    });
    if (existing) {
      return res.status(400).render("hostel/edit", {
        title: "Edit Room",
        currentPage: "hostel",
        room: { ...room, ...req.body },
        ...formOptions,
        error: `Room "${data.roomNo}" in Block "${data.block}" already exists.`,
      });
    }
  }

  // Fewer beds than residents would leave people without a bed.
  const residents = await prisma.hostelAllocation.count({ where: { roomId: id, endedOn: null } });
  if (residents > (data.noOfBeds || 1)) {
    return res.status(400).render("hostel/edit", {
      title: "Edit Room",
      currentPage: "hostel",
      room: { ...room, ...req.body },
      ...formOptions,
      error: `${residents} students live in this room, so it cannot have fewer than ${residents} beds.`,
    });
  }

  await prisma.hostelRoom.update({ where: { id }, data });
  res.redirect("/hostel");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!(await prisma.hostelRoom.findUnique({ where: { id } }))) return res.status(404).render("errors/404", { title: "Not Found" });
  if ((await prisma.hostelAllocation.count({ where: { roomId: id } })) > 0) {
    setFlash(req, "warning", "Students have lived in that room, so it cannot be deleted. Mark it Not Available instead.");
    return res.redirect("/hostel");
  }
  await prisma.hostelRoom.delete({ where: { id } });
  res.redirect("/hostel");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
