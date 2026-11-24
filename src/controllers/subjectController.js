const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    subjectId: body.subjectId,
    name: body.name,
  };
}

async function list(req, res) {
  const subjects = await prisma.subject.findMany({ orderBy: { id: "desc" } });
  res.render("subjects/list", { title: "Subjects", currentPage: "subjects", subjects });
}

function showAdd(req, res) {
  res.render("subjects/add", { title: "Add Subject", currentPage: "subjects" });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.subjectId || !data.name) {
    return res.status(400).render("subjects/add", {
      title: "Add Subject",
      currentPage: "subjects",
      error: "Subject ID and Name are required.",
      values: req.body,
    });
  }

  const existing = await prisma.subject.findUnique({ where: { subjectId: data.subjectId } });
  if (existing) {
    return res.status(400).render("subjects/add", {
      title: "Add Subject",
      currentPage: "subjects",
      error: `Subject ID "${data.subjectId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.subject.create({ data });
  res.redirect("/subjects");
}

async function showEdit(req, res) {
  const subject = await prisma.subject.findUnique({ where: { id: Number(req.params.id) } });
  if (!subject) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("subjects/edit", { title: "Edit Subject", currentPage: "subjects", subject });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.subjectId !== subject.subjectId) {
    const existing = await prisma.subject.findUnique({ where: { subjectId: data.subjectId } });
    if (existing) {
      return res.status(400).render("subjects/edit", {
        title: "Edit Subject",
        currentPage: "subjects",
        subject: { ...subject, ...req.body },
        error: `Subject ID "${data.subjectId}" is already in use.`,
      });
    }
  }

  await prisma.subject.update({ where: { id }, data });
  res.redirect("/subjects");
}

async function remove(req, res) {
  await prisma.subject.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/subjects");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
