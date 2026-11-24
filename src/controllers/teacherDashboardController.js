const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { buildCalendar, buildHighlightsForCurrentMonth } = require("../utils/calendar");

const prisma = new PrismaClient();

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function weekBucketLabel(weeksAgo) {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  return `Wk of ${d.toLocaleString("en-US", { month: "short", day: "numeric" })}`;
}

async function showDashboard(req, res) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.session.user.id }, include: { classRef: true } });
  if (!teacher) {
    return res.status(404).render("errors/404", { title: "Not Found" });
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [allEntries, totalStudents, upcomingLessons, holidays, events, teacherSubjects] = await Promise.all([
    prisma.timeTableEntry.findMany({ where: { teacherId: teacher.id } }),
    teacher.classId ? prisma.student.count({ where: { classId: teacher.classId, active: true } }) : 0,
    prisma.timeTableEntry.findMany({
      where: { teacherId: teacher.id, date: { gte: now } },
      orderBy: { date: "asc" },
      take: 3,
      include: { subjectRef: true, classRef: true },
    }),
    prisma.holiday.findMany(),
    prisma.event.findMany(),
    prisma.teacherSubject.findMany({ where: { teacherId: teacher.id }, distinct: ["subjectId"] }),
  ]);

  const classesThisWeek = allEntries.filter((e) => e.date && e.date >= now && e.date <= weekFromNow).length;
  const subjectsTaught = teacherSubjects.length;
  const totalHours = allEntries.reduce((sum, e) => sum + hoursBetween(e.startTime, e.endTime), 0);

  const pastCount = allEntries.filter((e) => e.date && e.date < now).length;
  const semesterProgress = allEntries.length ? Math.round((pastCount / allEntries.length) * 100) : 0;

  const weekLabels = [];
  const weekSeries = [];
  for (let w = 5; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - w * 7 - 6);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const count = allEntries.filter((e) => e.date && e.date >= weekStart && e.date <= weekEnd).length;
    weekLabels.push(weekBucketLabel(w));
    weekSeries.push(count);
  }

  const calendar = buildCalendar(buildHighlightsForCurrentMonth(holidays, events));

  res.render("dashboard/teacher", {
    title: "Dashboard",
    currentPage: "dashboard",
    teacher,
    classesThisWeek,
    totalStudents,
    subjectsTaught,
    totalHours: Math.round(totalHours),
    upcomingLessons,
    semesterProgress,
    weekLabels,
    weekSeries,
    calendar,
  });
}

module.exports = wrapController({ showDashboard });
