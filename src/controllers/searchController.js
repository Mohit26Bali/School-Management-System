const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function search(req, res) {
  const q = (req.query.q || "").trim();

  let students = [];
  let teachers = [];

  if (q) {
    students = await prisma.student.findMany({
      where: {
        active: true,
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { studentId: { contains: q } },
        ],
      },
      include: { classRef: true },
      take: 20,
    });
    teachers = await prisma.teacher.findMany({
      where: {
        active: true,
        OR: [{ name: { contains: q } }, { teacherId: { contains: q } }],
      },
      include: { teacherSubjects: { include: { subject: true } } },
      take: 20,
    });
  }

  res.render("search/results", { title: "Search", currentPage: "search", q, students, teachers });
}

module.exports = wrapController({ search });
