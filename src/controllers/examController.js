const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { getClassesByNameOnly, getSubjects } = require("../utils/academicOptions");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    examName: body.examName,
    classId: body.classId ? Number(body.classId) : null,
    subjectId: body.subjectId ? Number(body.subjectId) : null,
    fees: body.fees ? parseFloat(body.fees) : null,
    startTime: body.startTime || null,
    endTime: body.endTime || null,
    examDate: body.examDate ? new Date(body.examDate) : null,
  };
}

async function formOptions() {
  return { classes: await getClassesByNameOnly(), subjects: await getSubjects() };
}

async function list(req, res) {
  const exams = await prisma.exam.findMany({ orderBy: { id: "desc" }, include: { classRef: true, subjectRef: true } });
  res.render("exam/list", { title: "Exam", currentPage: "exam", exams });
}

async function showAdd(req, res) {
  res.render("exam/add", { title: "Add Exam", currentPage: "exam", ...(await formOptions()) });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.examName) {
    return res.status(400).render("exam/add", {
      title: "Add Exam",
      currentPage: "exam",
      ...(await formOptions()),
      error: "Exam Name is required.",
      values: req.body,
    });
  }

  await prisma.exam.create({ data });
  res.redirect("/exam");
}

async function showEdit(req, res) {
  const exam = await prisma.exam.findUnique({ where: { id: Number(req.params.id) } });
  if (!exam) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("exam/edit", { title: "Edit Exam", currentPage: "exam", exam, ...(await formOptions()) });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) return res.status(404).render("errors/404", { title: "Not Found" });

  if (!data.examName) {
    return res.status(400).render("exam/edit", {
      title: "Edit Exam",
      currentPage: "exam",
      exam: { ...exam, ...req.body },
      ...(await formOptions()),
      error: "Exam Name is required.",
    });
  }

  await prisma.exam.update({ where: { id }, data });
  res.redirect("/exam");
}

async function remove(req, res) {
  await prisma.exam.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/exam");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
