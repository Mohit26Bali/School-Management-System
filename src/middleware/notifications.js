const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function attachNotifications(req, res, next) {
  const user = req.session.user;
  if (!user) {
    res.locals.notifications = [];
    return next();
  }

  try {
    if (user.role === "admin") {
      const collections = await prisma.feesCollection.findMany({
        orderBy: { id: "desc" },
        take: 5,
        include: { student: true },
      });
      res.locals.notifications = collections.map((c) => ({
        text: `${c.student.firstName} ${c.student.lastName} paid ${c.feesType}`,
        detail: `$${c.amount.toFixed(2)}`,
        date: c.paidDate || c.createdAt,
      }));
    } else if (user.role === "teacher") {
      const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
      const entries = teacher
        ? await prisma.timeTableEntry.findMany({
            where: { teacherId: teacher.id, date: { gte: new Date() } },
            orderBy: { date: "asc" },
            take: 5,
          })
        : [];
      res.locals.notifications = entries.map((e) => ({
        text: `${e.subject || "Class"} — ${[e.class, e.section].filter(Boolean).join(" ")}`,
        detail: `${e.startTime || ""}-${e.endTime || ""}`,
        date: e.date,
      }));
    } else if (user.role === "student") {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      const results = student
        ? await prisma.examResult.findMany({
            where: { studentId: student.id },
            orderBy: { id: "desc" },
            take: 5,
            include: { exam: true },
          })
        : [];
      res.locals.notifications = results.map((r) => ({
        text: `${r.exam.examName} graded`,
        detail: `${r.marksObtained}/${r.maxMarks} — ${r.passed ? "Passed" : "Failed"}`,
        date: r.createdAt,
      }));
    } else {
      res.locals.notifications = [];
    }
  } catch (err) {
    res.locals.notifications = [];
  }

  next();
}

module.exports = { attachNotifications };
