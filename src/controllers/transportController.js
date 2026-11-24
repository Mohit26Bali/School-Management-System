const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { setFlash } = require("../utils/flash");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    routeName: body.routeName,
    vehicleNumber: body.vehicleNumber,
    driverName: body.driverName || null,
    licenseNumber: body.licenseNumber || null,
    contactNumber: body.contactNumber || null,
    driverAddress: body.driverAddress || null,
    seats: typeof body.seats === "string" && /^\d{1,3}$/.test(body.seats.trim()) && Number(body.seats) > 0 ? Number(body.seats) : null,
  };
}

async function list(req, res) {
  const routes = await prisma.transport.findMany({ orderBy: { id: "desc" } });
  res.render("transport/list", { title: "Transport", currentPage: "transport", routes });
}

function showAdd(req, res) {
  res.render("transport/add", { title: "Add Transport", currentPage: "transport" });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.routeName || !data.vehicleNumber) {
    return res.status(400).render("transport/add", {
      title: "Add Transport",
      currentPage: "transport",
      error: "Route Name and Vehicle Number are required.",
      values: req.body,
    });
  }

  const existing = await prisma.transport.findUnique({ where: { vehicleNumber: data.vehicleNumber } });
  if (existing) {
    return res.status(400).render("transport/add", {
      title: "Add Transport",
      currentPage: "transport",
      error: `Vehicle Number "${data.vehicleNumber}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.transport.create({ data });
  res.redirect("/transport");
}

async function showEdit(req, res) {
  const route = await prisma.transport.findUnique({ where: { id: Number(req.params.id) } });
  if (!route) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("transport/edit", { title: "Edit Transport", currentPage: "transport", route });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const route = await prisma.transport.findUnique({ where: { id } });
  if (!route) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.vehicleNumber !== route.vehicleNumber) {
    const existing = await prisma.transport.findUnique({ where: { vehicleNumber: data.vehicleNumber } });
    if (existing) {
      return res.status(400).render("transport/edit", {
        title: "Edit Transport",
        currentPage: "transport",
        route: { ...route, ...req.body },
        error: `Vehicle Number "${data.vehicleNumber}" is already in use.`,
      });
    }
  }

  const riding = await prisma.transportRider.count({ where: { transportId: id, endedOn: null } });
  if (data.seats && riding > data.seats) {
    return res.status(400).render("transport/edit", {
      title: "Edit Transport",
      currentPage: "transport",
      route: { ...route, ...req.body },
      error: `${riding} students ride this route, so it cannot have fewer than ${riding} seats.`,
    });
  }

  await prisma.transport.update({ where: { id }, data });
  res.redirect("/transport");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!(await prisma.transport.findUnique({ where: { id } }))) return res.status(404).render("errors/404", { title: "Not Found" });
  if ((await prisma.transportRider.count({ where: { transportId: id } })) > 0) {
    setFlash(req, "warning", "Students have ridden that route, so it cannot be deleted.");
    return res.redirect("/transport");
  }
  await prisma.transport.delete({ where: { id } });
  res.redirect("/transport");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
