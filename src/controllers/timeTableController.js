const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { getClasses, getSubjects } = require("../utils/academicOptions");

const prisma = new PrismaClient();

async function formOptions() {
  return { classes: await getClasses(), subjects: await getSubjects() };
}

async function list(req, res) {
  const entries = await prisma.timeTableEntry.findMany({
    orderBy: { id: "desc" },
    include: { teacher: true, classRef: true, subjectRef: true },
  });
  res.render("time-table/list", { title: "Time Table", currentPage: "time-table", entries });
}

async function showAdd(req, res) {
  res.render("time-table/add", { title: "Add Time Table", currentPage: "time-table", ...(await formOptions()) });
}

async function create(req, res) {
  const { teacherId, classId, subjectId, date, startTime, endTime } = req.body;

  if (!teacherId) {
    return res.status(400).render("time-table/add", {
      title: "Add Time Table",
      currentPage: "time-table",
      ...(await formOptions()),
      error: "Teacher Id is required.",
      values: req.body,
    });
  }

  const teacher = await prisma.teacher.findUnique({ where: { teacherId } });
  if (!teacher) {
    return res.status(400).render("time-table/add", {
      title: "Add Time Table",
      currentPage: "time-table",
      ...(await formOptions()),
      error: `No teacher found with Teacher Id "${teacherId}".`,
      values: req.body,
    });
  }

  await prisma.timeTableEntry.create({
    data: {
      classId: classId ? Number(classId) : null,
      subjectId: subjectId ? Number(subjectId) : null,
      date: date ? new Date(date) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      teacherId: teacher.id,
    },
  });
  res.redirect("/time-table");
}

async function showEdit(req, res) {
  const entry = await prisma.timeTableEntry.findUnique({
    where: { id: Number(req.params.id) },
    include: { teacher: true },
  });
  if (!entry) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("time-table/edit", { title: "Edit Time Table", currentPage: "time-table", entry, ...(await formOptions()) });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const { teacherId, classId, subjectId, date, startTime, endTime } = req.body;

  const entry = await prisma.timeTableEntry.findUnique({ where: { id }, include: { teacher: true } });
  if (!entry) return res.status(404).render("errors/404", { title: "Not Found" });

  const teacher = await prisma.teacher.findUnique({ where: { teacherId } });
  if (!teacher) {
    return res.status(400).render("time-table/edit", {
      title: "Edit Time Table",
      currentPage: "time-table",
      entry: { ...entry, teacher: { teacherId } },
      ...(await formOptions()),
      error: `No teacher found with Teacher Id "${teacherId}".`,
    });
  }

  await prisma.timeTableEntry.update({
    where: { id },
    data: {
      classId: classId ? Number(classId) : null,
      subjectId: subjectId ? Number(subjectId) : null,
      date: date ? new Date(date) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      teacherId: teacher.id,
    },
  });
  res.redirect("/time-table");
}

async function remove(req, res) {
  await prisma.timeTableEntry.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/time-table");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
