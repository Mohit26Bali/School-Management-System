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
    maxMarks: body.maxMarks === undefined || body.maxMarks === "" ? 100 : Number(body.maxMarks),
    passPercent: body.passPercent === undefined || body.passPercent === "" ? 40 : Number(body.passPercent),
  };
}

function marksError(data) {
  if (!Number.isFinite(data.maxMarks) || data.maxMarks <= 0 || data.maxMarks > 1000) return "Maximum marks must be a number between 1 and 1000.";
  if (!Number.isFinite(data.passPercent) || data.passPercent < 0 || data.passPercent > 100) return "The pass mark must be a percentage between 0 and 100.";
  return null;
}

async function formOptions() {
  return { classes: await getClassesByNameOnly(), subjects: await getSubjects() };
}

async function list(req, res) {
  const exams = await prisma.exam.findMany({ orderBy: { id: "desc" }, include: { classRef: true, subjectRef: true } });
  res.render("exam/list", {
    title: "Exam",
    currentPage: "exam",
    exams,
    notice: req.query.notice === "has-results" ? "That exam has results entered, so it cannot be deleted." : null,
  });
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
  if (marksError(data)) {
    return res.status(400).render("exam/add", { title: "Add Exam", currentPage: "exam", ...(await formOptions()), error: marksError(data), values: req.body });
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
  if (marksError(data)) {
    return res.status(400).render("exam/edit", { title: "Edit Exam", currentPage: "exam", exam: { ...exam, ...req.body }, ...(await formOptions()), error: marksError(data) });
  }
  if (data.maxMarks !== exam.maxMarks) {
    const entered = await prisma.examResult.count({ where: { examId: id } });
    if (entered > 0) {
      return res.status(400).render("exam/edit", { title: "Edit Exam", currentPage: "exam", exam: { ...exam, ...req.body }, ...(await formOptions()), error: "Results are already entered for this exam, so its maximum marks cannot change." });
    }
  }

  await prisma.exam.update({ where: { id }, data });
  // A changed pass mark re-grades results that were already entered.
  if (data.passPercent !== exam.passPercent) {
    const results = await prisma.examResult.findMany({ where: { examId: id } });
    for (const r of results) {
      const passed = (r.marksObtained / r.maxMarks) * 100 >= data.passPercent;
      if (passed !== r.passed) await prisma.examResult.update({ where: { id: r.id }, data: { passed } });
    }
  }
  res.redirect("/exam");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if ((await prisma.examResult.count({ where: { examId: id } })) > 0) {
    return res.redirect("/exam?notice=has-results");
  }
  await prisma.exam.delete({ where: { id } });
  res.redirect("/exam");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
