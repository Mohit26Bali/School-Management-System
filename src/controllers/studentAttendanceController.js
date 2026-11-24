const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function list(req, res) {
  const student = await prisma.student.findUnique({ where: { userId: req.session.user.id } });
  if (!student) return res.status(404).render("errors/404", { title: "Not Found" });

  const records = await prisma.attendance.findMany({
    where: { studentId: student.id },
    orderBy: { date: "desc" },
  });

  res.render("student-attendance/list", { title: "My Attendance", currentPage: "attendance", records });
}

module.exports = wrapController({ list });
