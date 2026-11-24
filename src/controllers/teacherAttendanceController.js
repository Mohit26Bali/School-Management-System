const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { parseDay } = require("../utils/schedule");
const { dateProblem } = require("../utils/attendanceRules");

const prisma = new PrismaClient();

const STATUSES = ["Present", "Absent", "Late"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A real calendar day in YYYY-MM-DD form, otherwise today
function chosenDay(value) {
  const date = parseDay(value);
  return date ? { dateStr: value.trim(), date } : { dateStr: todayStr(), date: parseDay(todayStr()) };
}

// Why attendance cannot be marked on this day (weekend, holiday, future, locked), or null
async function blockedReason(date) {
  const rule = dateProblem(date, parseDay(todayStr()));
  if (rule) return rule;
  const holiday = await prisma.holiday.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } });
  return holiday ? `That day is a holiday (${holiday.name}), so no attendance is taken.` : null;
}

async function showForm(req, res) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.session.user.id }, include: { classRef: true } });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });

  const { dateStr, date } = chosenDay(req.query.date);
  const blocked = await blockedReason(date);

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
    blocked,
  });
}

async function save(req, res) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.session.user.id } });
  if (!teacher) return res.status(404).render("errors/404", { title: "Not Found" });

  const { dateStr, date } = chosenDay(req.body.date);
  const status = req.body.status && typeof req.body.status === "object" ? req.body.status : {};

  // A teacher can only mark students in their own homeroom class, and only on a day that is open for attendance.
  if (!teacher.classId || (await blockedReason(date))) return res.redirect(`/teacher/attendance?date=${dateStr}`);

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
