// Year-end: move a class (or part of it) up to the next class, or graduate them.
const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { getClasses } = require("../utils/academicOptions");
const { setFlash } = require("../utils/flash");
const { today } = require("../utils/library");

const prisma = new PrismaClient();

const label = (c) => `${c.name} ${c.section}`;

async function classesWithCounts() {
  const classes = await getClasses();
  const counts = await prisma.student.groupBy({ by: ["classId"], where: { active: true }, _count: true });
  const byClass = new Map(counts.map((c) => [c.classId, c._count]));
  return classes.map((c) => ({ ...c, enrolled: byClass.get(c.id) || 0, free: Math.max(0, c.capacity - (byClass.get(c.id) || 0)) }));
}

async function show(req, res) {
  const classes = await classesWithCounts();
  const fromId = /^\d+$/.test(String(req.query.from || "")) ? Number(req.query.from) : null;
  const source = classes.find((c) => c.id === fromId) || null;
  const students = source
    ? await prisma.student.findMany({
        where: { classId: source.id, active: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        include: { _count: { select: { loans: { where: { returnedOn: null } } } } },
      })
    : [];
  res.render("promotion/show", { title: "Promote Students", currentPage: "promotion", classes, source, students });
}

async function promote(req, res) {
  const classes = await classesWithCounts();
  const fail = (message, from) => {
    setFlash(req, "danger", message);
    return res.redirect(from ? `/promotion?from=${from}` : "/promotion");
  };

  const fromId = /^\d+$/.test(String(req.body.fromId || "")) ? Number(req.body.fromId) : null;
  const source = classes.find((c) => c.id === fromId);
  if (!source) return fail("Choose the class to move students out of.");

  const graduate = req.body.target === "graduate";
  const target = graduate ? null : classes.find((c) => String(c.id) === String(req.body.target));
  if (!graduate && !target) return fail("Choose where they are going.", source.id);
  if (target && target.id === source.id) return fail("They are already in that class.", source.id);

  const raw = req.body.studentIds;
  const ids = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((x) => typeof x === "string" && /^\d+$/.test(x)).map(Number);
  if (!ids.length) return fail("Tick at least one student.", source.id);

  // Only active students that really are in the source class
  const students = await prisma.student.findMany({
    where: { id: { in: ids }, classId: source.id, active: true },
    include: { _count: { select: { loans: { where: { returnedOn: null } } } } },
  });
  if (!students.length) return fail("None of those students are in that class any more.", source.id);

  if (target && students.length > target.free) {
    return fail(`Class ${label(target)} has ${target.free} free places (capacity ${target.capacity}), but you are moving ${students.length}. Raise its capacity under Classes, or move fewer.`, source.id);
  }

  const moving = graduate ? students.filter((s) => s._count.loans === 0) : students;
  const held = graduate ? students.length - moving.length : 0;
  if (!moving.length) return fail("Every one of them still has library books out. Return the books first.", source.id);
  const movingIds = moving.map((s) => s.id);
  const now = today();

  if (target) {
    await prisma.student.updateMany({ where: { id: { in: movingIds } }, data: { classId: target.id } });
    setFlash(req, "success", `Moved ${moving.length} student${moving.length === 1 ? "" : "s"} from ${label(source)} to ${label(target)}.`);
  } else {
    // Graduating: they leave school, so their room and route end and their login stops (records are kept).
    const users = moving.map((s) => s.userId).filter(Boolean);
    await prisma.$transaction([
      prisma.hostelAllocation.updateMany({ where: { studentId: { in: movingIds }, endedOn: null }, data: { endedOn: now } }),
      prisma.transportRider.updateMany({ where: { studentId: { in: movingIds }, endedOn: null }, data: { endedOn: now } }),
      prisma.student.updateMany({ where: { id: { in: movingIds } }, data: { active: false, leftOn: new Date() } }),
      prisma.user.updateMany({ where: { id: { in: users } }, data: { active: false } }),
    ]);
    const extra = held ? ` ${held} could not graduate because they still have library books out.` : "";
    setFlash(req, held ? "warning" : "success", `Graduated ${moving.length} student${moving.length === 1 ? "" : "s"} from ${label(source)}.${extra}`);
  }
  res.redirect(`/promotion?from=${source.id}`);
}

module.exports = wrapController({ show, promote });
