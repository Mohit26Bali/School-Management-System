const { wrapController } = require("../utils/asyncHandler");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { setPortalLogin } = require("../utils/portalAccounts");
const { setFlash } = require("../utils/flash");
const { getClasses, getSubjects, findClassById } = require("../utils/academicOptions");
const { teacherProblems } = require("../utils/people");
const { passwordProblem } = require("../utils/passwords");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    teacherId: body.teacherId,
    name: body.name,
    gender: body.gender || null,
    dob: body.dob ? new Date(body.dob) : null,
    mobile: body.mobile || null,
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
    qualification: body.qualification || null,
    experience: body.experience || null,
    classId: body.classId ? Number(body.classId) : null,
    address: body.address || null,
    city: body.city || null,
    state: body.state || null,
    zipCode: body.zipCode || null,
    country: body.country || null,
  };
}

async function formOptions() {
  return { classes: await getClasses(), subjects: await getSubjects() };
}

async function syncTeacherSubjects(teacherId, classId, subjectIds) {
  await prisma.teacherSubject.deleteMany({ where: { teacherId } });
  if (!classId || !subjectIds.length) return;
  for (const subjectId of subjectIds) {
    await prisma.teacherSubject.create({ data: { teacherId, classId, subjectId } });
  }
}

function subjectIdsFromBody(body) {
  const raw = body.subjectIds;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map(Number).filter((n) => Number.isInteger(n) && n > 0);
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
  const teachers = await prisma.teacher.findMany({
    where,
    orderBy: { id: "desc" },
    include: { classRef: true, teacherSubjects: { include: { subject: true } } },
  });
  res.render("teachers/list", { title: "Teachers", currentPage: "teachers", teachers, show, notice: NOTICES[req.query.notice] || null });
}

async function showAdd(req, res) {
  res.render("teachers/add", { title: "Add Teachers", currentPage: "teachers", ...(await formOptions()) });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

  const problems = teacherProblems(req.body);
  if (problems.length) {
    return res.status(400).render("teachers/add", {
      title: "Add Teachers",
      currentPage: "teachers",
      ...(await formOptions()),
      error: problems.join(" "),
      values: req.body,
    });
  }

  const existing = await prisma.teacher.findUnique({ where: { teacherId: data.teacherId } });
  if (existing) {
    return res.status(400).render("teachers/add", {
      title: "Add Teachers",
      currentPage: "teachers",
      ...(await formOptions()),
      error: `Teacher ID "${data.teacherId}" is already in use.`,
      values: req.body,
    });
  }

  if (data.classId && !(await findClassById(data.classId))) {
    return res.status(400).render("teachers/add", {
      title: "Add Teachers",
      currentPage: "teachers",
      ...(await formOptions()),
      error: "Selected class is invalid.",
      values: req.body,
    });
  }

  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  let userId;

  if (email || password) {
    if (!email || !password) {
      return res.status(400).render("teachers/add", {
        title: "Add Teachers",
        currentPage: "teachers",
        ...(await formOptions()),
        error: "Both email and password are required to create portal login access.",
        values: req.body,
      });
    }
    const weakPassword = passwordProblem(password, email);
    if (weakPassword) {
      return res.status(400).render("teachers/add", {
        title: "Add Teachers",
        currentPage: "teachers",
        ...(await formOptions()),
        error: weakPassword,
        values: req.body,
      });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).render("teachers/add", {
        title: "Add Teachers",
        currentPage: "teachers",
        ...(await formOptions()),
        error: `An account with email "${email}" already exists.`,
        values: req.body,
      });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email, passwordHash, role: "teacher" },
    });
    userId = user.id;
  }

  const teacher = await prisma.teacher.create({ data: { ...data, userId } });
  await syncTeacherSubjects(teacher.id, data.classId, subjectIdsFromBody(req.body));
  res.redirect("/teachers");
}

async function showEdit(req, res) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: Number(req.params.id) },
    include: { teacherSubjects: true },
  });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("teachers/edit", { title: "Edit Teacher", currentPage: "teachers", teacher, ...(await formOptions()) });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });

  const problems = teacherProblems(req.body);
  if (problems.length) {
    return res.status(400).render("teachers/edit", {
      title: "Edit Teacher",
      currentPage: "teachers",
      teacher: { ...teacher, ...req.body },
      ...(await formOptions()),
      error: problems.join(" "),
    });
  }

  if (data.teacherId !== teacher.teacherId) {
    const existing = await prisma.teacher.findUnique({ where: { teacherId: data.teacherId } });
    if (existing) {
      return res.status(400).render("teachers/edit", {
        title: "Edit Teacher",
        currentPage: "teachers",
        teacher: { ...teacher, ...req.body },
        ...(await formOptions()),
        error: `Teacher ID "${data.teacherId}" is already in use.`,
      });
    }
  }

  if (data.classId && !(await findClassById(data.classId))) {
    return res.status(400).render("teachers/edit", {
      title: "Edit Teacher",
      currentPage: "teachers",
      teacher: { ...teacher, ...req.body },
      ...(await formOptions()),
      error: "Selected class is invalid.",
    });
  }

  await prisma.teacher.update({ where: { id }, data });
  await syncTeacherSubjects(id, data.classId, subjectIdsFromBody(req.body));
  res.redirect("/teachers");
}

async function showDetails(req, res) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: Number(req.params.id) },
    include: { classRef: true, teacherSubjects: { include: { subject: true } } },
  });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("teachers/details", {
    title: "Teacher Details",
    currentPage: "teachers",
    teacher,
    portalUser: teacher.userId ? await prisma.user.findUnique({ where: { id: teacher.userId } }) : null,
  });
}

// A teacher who has marked attendance, been paid or been scheduled is marked inactive, not erased (see students).
async function remove(req, res) {
  const id = Number(req.params.id);
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { _count: { select: { attendanceMarked: true, salaries: true, timeTableEntries: true } } },
  });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });

  const hasHistory = Object.values(teacher._count).some((n) => n > 0);
  if (hasHistory) {
    await prisma.teacher.update({ where: { id }, data: { active: false, leftOn: new Date() } });
    if (teacher.userId) await prisma.user.update({ where: { id: teacher.userId }, data: { active: false } });
    return res.redirect("/teachers?notice=deactivated");
  }
  await prisma.teacherSubject.deleteMany({ where: { teacherId: id } });
  await prisma.teacher.delete({ where: { id } });
  if (teacher.userId) await prisma.user.delete({ where: { id: teacher.userId } });
  res.redirect("/teachers?notice=deleted");
}

// Admin gives this person a portal login, or resets the password of the one they have.
async function setLogin(req, res) {
  const id = Number(req.params.id);
  const person = await prisma.teacher.findUnique({ where: { id } });
  if (!person) return res.status(404).render("errors/404", { title: "Not Found" });
  const result = await setPortalLogin(prisma, person, "teacher", req.body);
  if (result.error) setFlash(req, "danger", result.error);
  else if (result.created) setFlash(req, "success", "Login created. Share the email and password with them in person.");
  else setFlash(req, "success", "Login updated. They were signed out everywhere and must use the new password.");
  res.redirect(`/teachers/${id}`);
}

async function reactivate(req, res) {
  const id = Number(req.params.id);
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });
  await prisma.teacher.update({ where: { id }, data: { active: true, leftOn: null } });
  if (teacher.userId) await prisma.user.update({ where: { id: teacher.userId }, data: { active: true } });
  res.redirect("/teachers?show=inactive&notice=reactivated");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, showDetails, remove, reactivate, setLogin });
