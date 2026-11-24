const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TYPES = ["Public Holiday", "College Holiday", "Exam Holiday", "Others"];

function fieldsFromBody(body) {
  return {
    holidayId: body.holidayId,
    name: body.name,
    type: body.type || null,
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
  };
}

async function list(req, res) {
  const holidays = await prisma.holiday.findMany({ orderBy: { id: "desc" } });
  res.render("holiday/list", { title: "Holiday", currentPage: "holiday", holidays });
}

function showAdd(req, res) {
  res.render("holiday/add", { title: "Add Holiday", currentPage: "holiday", types: TYPES });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.holidayId || !data.name) {
    return res.status(400).render("holiday/add", {
      title: "Add Holiday",
      currentPage: "holiday",
      types: TYPES,
      error: "Holiday Id and Holiday Name are required.",
      values: req.body,
    });
  }

  const existing = await prisma.holiday.findUnique({ where: { holidayId: data.holidayId } });
  if (existing) {
    return res.status(400).render("holiday/add", {
      title: "Add Holiday",
      currentPage: "holiday",
      types: TYPES,
      error: `Holiday Id "${data.holidayId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.holiday.create({ data });
  res.redirect("/holiday");
}

async function showEdit(req, res) {
  const holiday = await prisma.holiday.findUnique({ where: { id: Number(req.params.id) } });
  if (!holiday) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("holiday/edit", { title: "Edit Holiday", currentPage: "holiday", holiday, types: TYPES });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.holidayId !== holiday.holidayId) {
    const existing = await prisma.holiday.findUnique({ where: { holidayId: data.holidayId } });
    if (existing) {
      return res.status(400).render("holiday/edit", {
        title: "Edit Holiday",
        currentPage: "holiday",
        holiday: { ...holiday, ...req.body },
        types: TYPES,
        error: `Holiday Id "${data.holidayId}" is already in use.`,
      });
    }
  }

  await prisma.holiday.update({ where: { id }, data });
  res.redirect("/holiday");
}

async function remove(req, res) {
  await prisma.holiday.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/holiday");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
