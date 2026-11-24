const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    eventId: body.eventId,
    name: body.name,
    eventDate: body.eventDate ? new Date(body.eventDate) : null,
  };
}

async function list(req, res) {
  const events = await prisma.event.findMany({ orderBy: { id: "desc" } });
  res.render("event/list", { title: "Events", currentPage: "event", events });
}

function showAdd(req, res) {
  res.render("event/add", { title: "Add Events", currentPage: "event" });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.eventId || !data.name) {
    return res.status(400).render("event/add", {
      title: "Add Events",
      currentPage: "event",
      error: "Event ID and Event Name are required.",
      values: req.body,
    });
  }

  const existing = await prisma.event.findUnique({ where: { eventId: data.eventId } });
  if (existing) {
    return res.status(400).render("event/add", {
      title: "Add Events",
      currentPage: "event",
      error: `Event ID "${data.eventId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.event.create({ data });
  res.redirect("/event");
}

async function showEdit(req, res) {
  const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
  if (!event) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("event/edit", { title: "Edit Event", currentPage: "event", event });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.eventId !== event.eventId) {
    const existing = await prisma.event.findUnique({ where: { eventId: data.eventId } });
    if (existing) {
      return res.status(400).render("event/edit", {
        title: "Edit Event",
        currentPage: "event",
        event: { ...event, ...req.body },
        error: `Event ID "${data.eventId}" is already in use.`,
      });
    }
  }

  await prisma.event.update({ where: { id }, data });
  res.redirect("/event");
}

async function remove(req, res) {
  await prisma.event.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/event");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
