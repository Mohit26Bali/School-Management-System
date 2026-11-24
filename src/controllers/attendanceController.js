const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { getClasses } = require("../utils/academicOptions");

const prisma = new PrismaClient();

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function list(req, res) {
  const dateStr = req.query.date || todayStr();
  const classFilter = req.query.classId ? Number(req.query.classId) : "";
  const date = new Date(dateStr);

  const where = { date };
  if (classFilter) where.classId = classFilter;

  const [records, classes] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: { student: true, teacher: true, classRef: true },
      orderBy: { student: { firstName: "asc" } },
    }),
    getClasses(),
  ]);

  res.render("attendance/list", {
    title: "Attendance",
    currentPage: "attendance",
    records,
    dateStr,
    classFilter,
    classes,
  });
}

module.exports = wrapController({ list });
