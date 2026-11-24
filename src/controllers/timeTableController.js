const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { getClasses, getSubjects } = require("../utils/academicOptions");
const { parseTime, parseDay, findClash } = require("../utils/schedule");

const prisma = new PrismaClient();

async function formOptions() {
  return { classes: await getClasses(), subjects: await getSubjects() };
}

async function list(req, res) {
  const entries = await prisma.timeTableEntry.findMany({
    orderBy: { id: "desc" },
    include: { teacher: true, classRef: true, subjectRef: true },
  });
  res.render("time-table/list", { title: "Time Table", currentPage: "time-table", entries });
}

async function showAdd(req, res) {
  res.render("time-table/add", { title: "Add Time Table", currentPage: "time-table", ...(await formOptions()) });
}

function describe(entry) {
  const subject = entry.subjectRef ? entry.subjectRef.name : "a lesson";
  const cls = entry.classRef ? ` for ${entry.classRef.name} ${entry.classRef.section}` : "";
  return `${subject}${cls}, ${entry.startTime}-${entry.endTime}`;
}

// Checks a lesson against the school's rules. Returns { error } or { teacher, data }.
//  - a real active teacher, a real date, 24-hour times with the end after the start
//  - not on a holiday
//  - the teacher teaches that subject to that class level
//  - the teacher and the class are each free at that time (a lesson ending when the next starts is fine)
async function checkEntry(body, excludeId) {
  const teacherCode = typeof body.teacherId === "string" ? body.teacherId.trim() : "";
  if (!teacherCode) return { error: "Teacher Id is required." };

  const teacher = await prisma.teacher.findFirst({ where: { teacherId: teacherCode, active: true } });
  if (!teacher) return { error: `No active teacher found with Teacher Id "${teacherCode}".` };

  const classId = body.classId ? Number(body.classId) : null;
  const subjectId = body.subjectId ? Number(body.subjectId) : null;
  const date = parseDay(body.date);
  const start = parseTime(body.startTime);
  const end = parseTime(body.endTime);

  if (!date) return { error: "Choose a valid date (YYYY-MM-DD)." };
  if (start === null || end === null) return { error: "Enter the start and end time as HH:MM (24-hour), for example 09:30." };
  if (end <= start) return { error: "The end time must be after the start time." };
  if (!classId || !subjectId) return { error: "Choose a class and a subject." };

  const classRow = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRow) return { error: "That class does not exist." };
  if (!(await prisma.subject.findUnique({ where: { id: subjectId } }))) return { error: "That subject does not exist." };

  const holiday = await prisma.holiday.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } });
  if (holiday) return { error: `That day is a holiday (${holiday.name}). No lessons can be scheduled.` };

  const teaches = await prisma.teacherSubject.findFirst({
    where: { teacherId: teacher.id, subjectId, class: { name: classRow.name } },
  });
  if (!teaches) {
    return { error: `${teacher.name} is not assigned to teach this subject to class ${classRow.name}. Assign it on the teacher's page first.` };
  }

  const sameDay = await prisma.timeTableEntry.findMany({
    where: { date, ...(excludeId ? { id: { not: excludeId } } : {}), OR: [{ teacherId: teacher.id }, { classId }] },
    include: { classRef: true, subjectRef: true },
  });
  const teacherClash = findClash(sameDay.filter((e) => e.teacherId === teacher.id), start, end);
  if (teacherClash) return { error: `${teacher.name} already has ${describe(teacherClash)} at that time.` };
  const classClash = findClash(sameDay.filter((e) => e.classId === classId), start, end);
  if (classClash) return { error: `Class ${classRow.name} ${classRow.section} already has ${describe(classClash)} at that time.` };

  return {
    teacher,
    data: { classId, subjectId, date, startTime: body.startTime.trim(), endTime: body.endTime.trim(), teacherId: teacher.id },
  };
}

async function create(req, res) {
  const checked = await checkEntry(req.body, null);
  if (checked.error) {
    return res.status(400).render("time-table/add", {
      title: "Add Time Table",
      currentPage: "time-table",
      ...(await formOptions()),
      error: checked.error,
      values: req.body,
    });
  }
  await prisma.timeTableEntry.create({ data: checked.data });
  res.redirect("/time-table");
}

async function showEdit(req, res) {
  const entry = await prisma.timeTableEntry.findUnique({
    where: { id: Number(req.params.id) },
    include: { teacher: true },
  });
  if (!entry) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("time-table/edit", { title: "Edit Time Table", currentPage: "time-table", entry, ...(await formOptions()) });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const entry = await prisma.timeTableEntry.findUnique({ where: { id }, include: { teacher: true } });
  if (!entry) return res.status(404).render("errors/404", { title: "Not Found" });

  const checked = await checkEntry(req.body, id);
  if (checked.error) {
    return res.status(400).render("time-table/edit", {
      title: "Edit Time Table",
      currentPage: "time-table",
      entry: { ...entry, ...req.body, teacher: { teacherId: typeof req.body.teacherId === "string" ? req.body.teacherId : "" } },
      ...(await formOptions()),
      error: checked.error,
    });
  }
  await prisma.timeTableEntry.update({ where: { id }, data: checked.data });
  res.redirect("/time-table");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!(await prisma.timeTableEntry.findUnique({ where: { id } }))) return res.status(404).render("errors/404", { title: "Not Found" });
  await prisma.timeTableEntry.delete({ where: { id } });
  res.redirect("/time-table");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
