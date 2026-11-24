const { wrapController } = require("../utils/asyncHandler");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { getClasses, findClassById } = require("../utils/academicOptions");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    firstName: body.firstName,
    lastName: body.lastName,
    studentId: body.studentId,
    gender: body.gender || null,
    dob: body.dob ? new Date(body.dob) : null,
    classId: body.classId ? Number(body.classId) : null,
    religion: body.religion || null,
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
    mobile: body.mobile || null,
    admissionNumber: body.admissionNumber || null,
    fatherName: body.fatherName || null,
    fatherOccupation: body.fatherOccupation || null,
    fatherMobile: body.fatherMobile || null,
    fatherEmail: body.fatherEmail || null,
    motherName: body.motherName || null,
    motherOccupation: body.motherOccupation || null,
    motherMobile: body.motherMobile || null,
    motherEmail: body.motherEmail || null,
    presentAddress: body.presentAddress || null,
    permanentAddress: body.permanentAddress || null,
  };
}

// ?show=active (default) | inactive | all
function showFilter(query) {
  const show = ["active", "inactive", "all"].includes(query.show) ? query.show : "active";
  return { show, where: show === "all" ? {} : { active: show === "active" } };
}

const NOTICES = {
  deleted: "Removed. They had no records, so they were deleted completely.",
  deactivated: "Marked inactive. They have records (attendance, results or payments), so those were kept, and they can no longer sign in.",
  reactivated: "Reactivated.",
};

async function list(req, res) {
  const { show, where } = showFilter(req.query);
  const students = await prisma.student.findMany({ where, orderBy: { id: "desc" }, include: { classRef: true } });
  res.render("students/list", { title: "Students", currentPage: "students", students, show, notice: NOTICES[req.query.notice] || null });
}

async function showAdd(req, res) {
  res.render("students/add", { title: "Add Students", currentPage: "students", classes: await getClasses() });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

  if (!data.firstName || !data.lastName || !data.studentId) {
    return res.status(400).render("students/add", {
      title: "Add Students",
      currentPage: "students",
      classes: await getClasses(),
      error: "First name, last name, and Student ID are required.",
      values: req.body,
    });
  }

  const existing = await prisma.student.findUnique({ where: { studentId: data.studentId } });
  if (existing) {
    return res.status(400).render("students/add", {
      title: "Add Students",
      currentPage: "students",
      classes: await getClasses(),
      error: `Student ID "${data.studentId}" is already in use.`,
      values: req.body,
    });
  }

  if (data.classId && !(await findClassById(data.classId))) {
    return res.status(400).render("students/add", {
      title: "Add Students",
      currentPage: "students",
      classes: await getClasses(),
      error: "Selected class is invalid.",
      values: req.body,
    });
  }

  await prisma.student.create({ data });
  res.redirect("/students");
}

async function showEdit(req, res) {
  const student = await prisma.student.findUnique({ where: { id: Number(req.params.id) } });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("students/edit", { title: "Edit Student", currentPage: "students", student, classes: await getClasses() });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.studentId !== student.studentId) {
    const existing = await prisma.student.findUnique({ where: { studentId: data.studentId } });
    if (existing) {
      return res.status(400).render("students/edit", {
        title: "Edit Student",
        currentPage: "students",
        student: { ...student, ...req.body },
        classes: await getClasses(),
        error: `Student ID "${data.studentId}" is already in use.`,
      });
    }
  }

  if (data.classId && !(await findClassById(data.classId))) {
    return res.status(400).render("students/edit", {
      title: "Edit Student",
      currentPage: "students",
      student: { ...student, ...req.body },
      classes: await getClasses(),
      error: "Selected class is invalid.",
    });
  }

  await prisma.student.update({ where: { id }, data });
  res.redirect("/students");
}

async function showDetails(req, res) {
  const student = await prisma.student.findUnique({ where: { id: Number(req.params.id) }, include: { classRef: true } });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("students/details", { title: "Student Details", currentPage: "students", student });
}

// A student with attendance, exam results or fee payments is never erased: school records must stay complete.
// They are marked inactive instead (and their login stops working). A student with no history is deleted outright.
async function remove(req, res) {
  const id = Number(req.params.id);
  const student = await prisma.student.findUnique({
    where: { id },
    include: { _count: { select: { attendance: true, examResults: true, feesCollections: true } } },
  });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });

  const hasHistory = Object.values(student._count).some((n) => n > 0);
  if (hasHistory) {
    await prisma.student.update({ where: { id }, data: { active: false, leftOn: new Date() } });
    if (student.userId) await prisma.user.update({ where: { id: student.userId }, data: { active: false } });
    return res.redirect("/students?notice=deactivated");
  }
  await prisma.student.delete({ where: { id } });
  if (student.userId) await prisma.user.delete({ where: { id: student.userId } });
  res.redirect("/students?notice=deleted");
}

async function reactivate(req, res) {
  const id = Number(req.params.id);
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });
  await prisma.student.update({ where: { id }, data: { active: true, leftOn: null } });
  if (student.userId) await prisma.user.update({ where: { id: student.userId }, data: { active: true } });
  res.redirect("/students?show=inactive&notice=reactivated");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, showDetails, remove, reactivate });
