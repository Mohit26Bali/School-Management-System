const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CLASS_NAME_ORDER = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function classSortKey(c) {
  const idx = CLASS_NAME_ORDER.indexOf(c.name);
  return [idx === -1 ? CLASS_NAME_ORDER.length : idx, c.section];
}

function sortClasses(classes) {
  return [...classes].sort((a, b) => {
    const [ai, as_] = classSortKey(a);
    const [bi, bs] = classSortKey(b);
    if (ai !== bi) return ai - bi;
    return as_.localeCompare(bs);
  });
}

// Full name+section matrix, for forms where section granularity matters (Student, Teacher, TimeTableEntry, Attendance).
async function getClasses() {
  const classes = await prisma.class.findMany();
  return sortClasses(classes);
}

// One representative row per class name, for forms where only the class name matters (Exam, Fee, Book, Subject).
async function getClassesByNameOnly() {
  const classes = await getClasses();
  const seen = new Set();
  const result = [];
  for (const c of classes) {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      result.push(c);
    }
  }
  return result;
}

async function getSubjects() {
  return prisma.subject.findMany({ orderBy: { name: "asc" } });
}

async function findClassById(classId) {
  if (!classId) return null;
  return prisma.class.findUnique({ where: { id: Number(classId) } });
}

module.exports = { getClasses, getClassesByNameOnly, getSubjects, findClassById };
