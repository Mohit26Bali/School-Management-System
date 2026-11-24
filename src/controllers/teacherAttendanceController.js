const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const STATUSES = ["Present", "Absent", "Late"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Only real calendar dates in YYYY-MM-DD form are accepted; anything else falls back to today.
function validDate(value) {
  if (typeof value !== "string" || !/^d{4}-d{2}-d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

async function showForm(req, res) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.session.user.id }, include: { classRef: true } });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });

  const dateStr = validDate(req.query.date) ? req.query.date : todayStr();
  const date = new Date(dateStr);

  const [students, existing] = await Promise.all([
    teacher.classId
      ? prisma.student.findMany({ where: { classId: teacher.classId, active: true }, orderBy: { firstName: "asc" } })
      : [],
    prisma.attendance.findMany({ where: { teacherId: teacher.id, date } }),
  ]);

  const statusByStudentId = {};
  for (const a of existing) statusByStudentId[a.studentId] = a.status;

  res.render("teacher-attendance/show", {
    title: "Mark Attendance",
    currentPage: "attendance",
    teacher,
    students,
    statusByStudentId,
    dateStr,
    statuses: STATUSES,
    saved: req.query.saved,
  });
}

async function save(req, res) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.session.user.id } });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });

  const dateStr = validDate(req.body.date) ? req.body.date : todayStr();
  const date = new Date(dateStr);
  const status = req.body.status && typeof req.body.status === "object" ? req.body.status : {};

  // A teacher can only mark students in their own homeroom class.
  if (!teacher.classId) return res.redirect(`/teacher/attendance?date=${dateStr}`);

  for (const [key, value] of Object.entries(status)) {
    const match = /^student-(\d+)$/.exec(key);
    if (!match || !STATUSES.includes(value)) continue;
    const studentId = Number(match[1]);

    const student = await prisma.student.findFirst({ where: { id: studentId, classId: teacher.classId, active: true } });
    if (!student) continue;

    await prisma.attendance.upsert({
      where: { studentId_date: { studentId, date } },
      update: { status: value },
      create: {
        studentId,
        date,
        status: value,
        classId: student.classId,
        teacherId: teacher.id,
      },
    });
  }

  res.redirect(`/teacher/attendance?date=${dateStr}&saved=1`);
}

module.exports = wrapController({ showForm, save });
