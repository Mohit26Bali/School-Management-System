const { wrapController } = require("../utils/asyncHandler");
const { statementFor } = require("../utils/feeBalance");
const { PrismaClient } = require("@prisma/client");
const { buildCalendar, buildHighlightsForCurrentMonth } = require("../utils/calendar");

const prisma = new PrismaClient();

async function showDashboard(req, res) {
  const student = await prisma.student.findUnique({ where: { userId: req.session.user.id }, include: { classRef: true } });
  if (!student) {
    return res.status(404).render("errors/404", { title: "Not Found" });
  }

  const now = new Date();

  const [subjectsCount, feesCollections, examResults, upcomingLessons, holidays, events, attendanceRecords] = await Promise.all([
    student.classId
      ? prisma.teacherSubject.findMany({ where: { classId: student.classId }, distinct: ["subjectId"] }).then((rows) => rows.length)
      : 0,
    prisma.feesCollection.findMany({ where: { studentId: student.id } }),
    prisma.examResult.findMany({
      where: { studentId: student.id },
      include: { exam: true },
      orderBy: { exam: { examDate: "asc" } },
    }),
    student.classId
      ? prisma.timeTableEntry.findMany({
          where: { classId: student.classId, date: { gte: now } },
          orderBy: { date: "asc" },
          take: 3,
          include: { subjectRef: true },
        })
      : [],
    prisma.holiday.findMany(),
    prisma.event.findMany(),
    prisma.attendance.findMany({ where: { studentId: student.id } }),
  ]);

  const feesPaidCount = feesCollections.length;
  const feesPaidTotal = feesCollections.reduce((sum, f) => sum + f.amount, 0);
  const examsAttended = examResults.length;
  const examsPassed = examResults.filter((r) => r.passed).length;
  const passRate = examsAttended ? Math.round((examsPassed / examsAttended) * 100) : 0;

  const presentCount = attendanceRecords.filter((a) => a.status === "Present").length;
  const attendancePercent = attendanceRecords.length ? Math.round((presentCount / attendanceRecords.length) * 100) : null;

  const marksLabels = examResults.map((r) => r.exam.examName);
  const marksSeries = examResults.map((r) => Math.round((r.marksObtained / r.maxMarks) * 100));

  const calendar = buildCalendar(buildHighlightsForCurrentMonth(holidays, events));

  const statement = await statementFor(prisma, student);

  res.render("dashboard/student", {
    title: "Dashboard",
    statement,
    currentPage: "dashboard",
    student,
    subjectsCount,
    feesPaidCount,
    feesPaidTotal,
    examsAttended,
    examsPassed,
    passRate,
    attendancePercent,
    marksLabels,
    marksSeries,
    upcomingLessons,
    calendar,
  });
}

module.exports = wrapController({ showDashboard });
