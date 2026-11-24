const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { getClasses } = require("../utils/academicOptions");

const prisma = new PrismaClient();

async function list(req, res) {
  const classes = await getClasses();
  const counts = await prisma.student.groupBy({ by: ["classId"], where: { active: true }, _count: true });
  const enrolledByClass = new Map(counts.map((c) => [c.classId, c._count]));
  res.render("classes/list", {
    title: "Classes",
    currentPage: "classes",
    classes: classes.map((c) => ({ ...c, enrolled: enrolledByClass.get(c.id) || 0 })),
    error: req.query.error || null,
    saved: req.query.saved || null,
  });
}

// Capacity is a whole number from 1 to 200 and cannot be set below the number of students already enrolled.
async function updateCapacity(req, res) {
  const id = Number(req.params.id);
  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return res.status(404).render("errors/404", { title: "Not Found" });

  const raw = typeof req.body.capacity === "string" ? req.body.capacity.trim() : "";
  const capacity = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (!(capacity >= 1 && capacity <= 200)) {
    return res.redirect(`/classes?error=${encodeURIComponent("Capacity must be a whole number from 1 to 200.")}`);
  }
  const enrolled = await prisma.student.count({ where: { classId: id, active: true } });
  if (capacity < enrolled) {
    return res.redirect(`/classes?error=${encodeURIComponent(`Class ${cls.name} ${cls.section} already has ${enrolled} students, so its capacity cannot be below ${enrolled}.`)}`);
  }
  await prisma.class.update({ where: { id }, data: { capacity } });
  res.redirect(`/classes?saved=${id}`);
}

module.exports = wrapController({ list, updateCapacity });
