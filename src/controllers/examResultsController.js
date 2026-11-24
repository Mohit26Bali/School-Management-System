const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { parseMarks, isPass, passMark } = require("../utils/grading");

const prisma = new PrismaClient();

// Admins can enter results for any exam. A teacher only for exams in a subject and class level they are assigned to
// (the same TeacherSubject assignments that appear on the Teacher page).
async function teacherPairs(user) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: user.id },
    include: { teacherSubjects: { include: { class: true } } },
  });
  if (!teacher || !teacher.active) return null;
  return new Set(teacher.teacherSubjects.map((t) => `${t.subjectId}|${t.class.name}`));
}

function examKey(exam) {
  return exam.subjectId && exam.classRef ? `${exam.subjectId}|${exam.classRef.name}` : null;
}

async function canGrade(user, exam) {
  if (user.role === "admin") return true;
  const pairs = await teacherPairs(user);
  const key = examKey(exam);
  return Boolean(pairs && key && pairs.has(key));
}

async function list(req, res) {
  const exams = await prisma.exam.findMany({
    orderBy: { examDate: "desc" },
    include: { classRef: true, subjectRef: true, _count: { select: { results: true } } },
  });
  let visible = exams;
  if (req.session.user.role === "teacher") {
    const pairs = await teacherPairs(req.session.user);
    visible = exams.filter((e) => pairs && examKey(e) && pairs.has(examKey(e)));
  }
  res.render("exam-results/list", { title: "Exam Results", currentPage: "exam-results", exams: visible });
}

async function loadSheet(req, res, extra = {}) {
  const examId = Number(req.params.examId);
  const exam = Number.isInteger(examId)
    ? await prisma.exam.findUnique({ where: { id: examId }, include: { classRef: true, subjectRef: true } })
    : null;
  if (!exam) return { notFound: res.status(404).render("errors/404", { title: "Not Found" }) };
  if (!(await canGrade(req.session.user, exam))) {
    return { forbidden: res.status(403).render("errors/403", { title: "Forbidden" }) };
  }

  const students = exam.classRef
    ? await prisma.student.findMany({
        where: { active: true, classRef: { name: exam.classRef.name } },
        include: { classRef: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      })
    : [];
  const results = await prisma.examResult.findMany({ where: { examId: exam.id } });
  const marksByStudent = {};
  for (const r of results) marksByStudent[r.studentId] = r.marksObtained;
  return { exam, students, marksByStudent };
}

async function showSheet(req, res) {
  const sheet = await loadSheet(req, res);
  if (!sheet.exam) return;
  res.render("exam-results/sheet", {
    title: "Enter Results",
    currentPage: "exam-results",
    ...sheet,
    passMark: passMark(sheet.exam.maxMarks, sheet.exam.passPercent),
    entered: null,
    errors: null,
    saved: req.query.saved,
  });
}

async function saveSheet(req, res) {
  const sheet = await loadSheet(req, res);
  if (!sheet.exam) return;
  const { exam, students } = sheet;

  const submitted = req.body.marks && typeof req.body.marks === "object" ? req.body.marks : {};
  const errors = [];
  const toSave = [];
  const toClear = [];
  const entered = {};

  for (const student of students) {
    const raw = submitted[`student-${student.id}`];
    entered[student.id] = typeof raw === "string" ? raw : "";
    const parsed = parseMarks(raw, exam.maxMarks);
    if (parsed.error) errors.push(`${student.firstName} ${student.lastName}: ${parsed.error}`);
    else if (parsed.blank) toClear.push(student.id);
    else toSave.push({ studentId: student.id, marks: parsed.value });
  }

  if (errors.length) {
    return res.status(400).render("exam-results/sheet", {
      title: "Enter Results",
      currentPage: "exam-results",
      ...sheet,
      passMark: passMark(exam.maxMarks, exam.passPercent),
      entered,
      errors,
      saved: null,
    });
  }

  await prisma.$transaction([
    ...toSave.map((r) =>
      prisma.examResult.upsert({
        where: { examId_studentId: { examId: exam.id, studentId: r.studentId } },
        update: { marksObtained: r.marks, maxMarks: exam.maxMarks, passed: isPass(r.marks, exam.maxMarks, exam.passPercent) },
        create: {
          examId: exam.id,
          studentId: r.studentId,
          marksObtained: r.marks,
          maxMarks: exam.maxMarks,
          passed: isPass(r.marks, exam.maxMarks, exam.passPercent),
        },
      })
    ),
    prisma.examResult.deleteMany({ where: { examId: exam.id, studentId: { in: toClear } } }),
  ]);

  res.redirect(`/exam-results/${exam.id}?saved=1`);
}

module.exports = wrapController({ list, showSheet, saveSheet });
