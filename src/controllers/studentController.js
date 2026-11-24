const { wrapController } = require("../utils/asyncHandler");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { setPortalLogin } = require("../utils/portalAccounts");
const { setFlash } = require("../utils/flash");
const { getClasses, findClassById } = require("../utils/academicOptions");
const { statementFor } = require("../utils/feeBalance");
const { studentProblems } = require("../utils/people");

const prisma = new PrismaClient();

// Is this class already at its capacity (counting active students only)?
async function classFullMessage(classId, currentClassId) {
  if (!classId || classId === currentClassId) return null;
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return null;
  const enrolled = await prisma.student.count({ where: { classId, active: true } });
  return enrolled >= cls.capacity ? `Class ${cls.name} ${cls.section} is full (${enrolled} of ${cls.capacity} places). Choose another class or raise its capacity under Classes.` : null;
}

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

  const problems = studentProblems(req.body);
  if (problems.length) {
    return res.status(400).render("students/add", {
      title: "Add Students",
      currentPage: "students",
      classes: await getClasses(),
      error: problems.join(" "),
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

  const full = await classFullMessage(data.classId, null);
  if (full) {
    return res.status(400).render("students/add", { title: "Add Students", currentPage: "students", classes: await getClasses(), error: full, values: req.body });
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

  const problems = studentProblems(req.body);
  if (problems.length) {
    return res.status(400).render("students/edit", {
      title: "Edit Student",
      currentPage: "students",
      student: { ...student, ...req.body },
      classes: await getClasses(),
      error: problems.join(" "),
    });
  }

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

  const full = await classFullMessage(data.classId, student.classId);
  if (full) {
    return res.status(400).render("students/edit", {
      title: "Edit Student",
      currentPage: "students",
      student: { ...student, ...req.body },
      classes: await getClasses(),
      error: full,
    });
  }

  await prisma.student.update({ where: { id }, data });
  res.redirect("/students");
}

async function showDetails(req, res) {
  const student = await prisma.student.findUnique({ where: { id: Number(req.params.id) }, include: { classRef: true } });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("students/details", {
    title: "Student Details",
    currentPage: "students",
    student,
    statement: await statementFor(prisma, student),
    portalUser: student.userId ? await prisma.user.findUnique({ where: { id: student.userId } }) : null,
  });
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

// Admin gives this person a portal login, or resets the password of the one they have.
async function setLogin(req, res) {
  const id = Number(req.params.id);
  const person = await prisma.student.findUnique({ where: { id } });
  if (!person) return res.status(404).render("errors/404", { title: "Not Found" });
  const result = await setPortalLogin(prisma, person, "student", req.body);
  if (result.error) setFlash(req, "danger", result.error);
  else if (result.created) setFlash(req, "success", "Login created. Share the email and password with them in person.");
  else setFlash(req, "success", "Login updated. They were signed out everywhere and must use the new password.");
  res.redirect(`/students/${id}`);
}

async function reactivate(req, res) {
  const id = Number(req.params.id);
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });
  await prisma.student.update({ where: { id }, data: { active: true, leftOn: null } });
  if (student.userId) await prisma.user.update({ where: { id: student.userId }, data: { active: true } });
  res.redirect("/students?show=inactive&notice=reactivated");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, showDetails, remove, reactivate, setLogin });
