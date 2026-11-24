const { wrapController } = require("../utils/asyncHandler");
const { auditedClient } = require("../utils/audit");

const { statementFor, remainingFor, computeStatement, cents } = require("../utils/feeBalance");

// Writes to money records are recorded in the audit log (see utils/audit.js)
const prisma = auditedClient();

// Checks a payment against the fee schedule. Returns an error message, or null when it is fine.
// A payment must be for a fee that applies to the student, be more than zero, and not go beyond what is still owed.
async function paymentProblem({ student, feesType, amount, paidDate, replacing }) {
  if (!FEES_TYPES.includes(feesType)) return "Choose a fees type from the list.";
  if (!(amount > 0)) return "The amount must be greater than zero.";
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return "The amount can have at most two decimal places.";
  if (paidDate) {
    const d = new Date(paidDate);
    if (Number.isNaN(d.getTime())) return "The paid date is not a valid date.";
    if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return "The paid date cannot be in the future.";
  }
  const statement = await statementFor(prisma, student);
  const sameType = replacing && replacing.studentId === student.id && replacing.feesType === feesType ? replacing : null;
  const remaining = remainingFor(statement, feesType, sameType);
  if (remaining === null) {
    const cls = student.classRef ? student.classRef.name : "this student";
    return `No "${feesType}" is on the Fees schedule for class ${cls}. Add it under Fees first.`;
  }
  if (cents(amount) > cents(remaining)) {
    return `That is more than is owed. Outstanding for ${feesType}: ${remaining.toFixed(2)}.`;
  }
  return null;
}

const FEES_TYPES = ["Class Test", "Exam Fees", "Hostel Fees", "Transport Fees", "Mess Fees"];

async function list(req, res) {
  const collections = await prisma.feesCollection.findMany({
    orderBy: { id: "desc" },
    include: { student: true },
  });
  res.render("fees-collections/list", { title: "Fees Collection", currentPage: "fees-collections", collections });
}

function showAdd(req, res) {
  res.render("fees-collections/add", { title: "Add Fees Collection", currentPage: "fees-collections", feesTypes: FEES_TYPES });
}

async function create(req, res) {
  const { studentId, feesType, amount, paidDate } = req.body;
  const parsedAmount = amount ? parseFloat(amount) : null;

  if (!studentId || !feesType || parsedAmount === null || Number.isNaN(parsedAmount)) {
    return res.status(400).render("fees-collections/add", {
      title: "Add Fees Collection",
      currentPage: "fees-collections",
      feesTypes: FEES_TYPES,
      error: "Student ID, Fees Type, and a valid Amount are required.",
      values: req.body,
    });
  }

  const student = await prisma.student.findFirst({ where: { studentId: String(studentId), active: true }, include: { classRef: true } });
  if (!student) {
    return res.status(400).render("fees-collections/add", {
      title: "Add Fees Collection",
      currentPage: "fees-collections",
      feesTypes: FEES_TYPES,
      error: `No student found with Student ID "${studentId}".`,
      values: req.body,
    });
  }

  const problem = await paymentProblem({ student, feesType, amount: parsedAmount, paidDate });
  if (problem) {
    return res.status(400).render("fees-collections/add", {
      title: "Add Fees Collection",
      currentPage: "fees-collections",
      feesTypes: FEES_TYPES,
      error: problem,
      values: req.body,
    });
  }

  await prisma.feesCollection.create({
    data: {
      feesType,
      amount: parsedAmount,
      paidDate: paidDate ? new Date(paidDate) : null,
      studentId: student.id,
    },
  });
  res.redirect("/fees-collections");
}

async function showEdit(req, res) {
  const collection = await prisma.feesCollection.findUnique({
    where: { id: Number(req.params.id) },
    include: { student: true },
  });
  if (!collection) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("fees-collections/edit", {
    title: "Edit Fees Collection",
    currentPage: "fees-collections",
    collection,
    feesTypes: FEES_TYPES,
  });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const { studentId, feesType, amount, paidDate } = req.body;
  const parsedAmount = amount ? parseFloat(amount) : null;

  const collection = await prisma.feesCollection.findUnique({ where: { id }, include: { student: true } });
  if (!collection) return res.status(404).render("errors/404", { title: "Not Found" });

  const student = await prisma.student.findFirst({ where: { studentId: String(studentId), active: true }, include: { classRef: true } });
  if (!student) {
    return res.status(400).render("fees-collections/edit", {
      title: "Edit Fees Collection",
      currentPage: "fees-collections",
      collection: { ...collection, student: { studentId } },
      feesTypes: FEES_TYPES,
      error: `No student found with Student ID "${studentId}".`,
    });
  }

  const problem = await paymentProblem({ student, feesType, amount: parsedAmount, paidDate, replacing: collection });
  if (problem) {
    return res.status(400).render("fees-collections/edit", {
      title: "Edit Fees Collection",
      currentPage: "fees-collections",
      collection: { ...collection, ...req.body, student: { studentId } },
      feesTypes: FEES_TYPES,
      error: problem,
    });
  }

  await prisma.feesCollection.update({
    where: { id },
    data: {
      feesType,
      amount: parsedAmount,
      paidDate: paidDate ? new Date(paidDate) : null,
      studentId: student.id,
    },
  });
  res.redirect("/fees-collections");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!(await prisma.feesCollection.findUnique({ where: { id } }))) return res.status(404).render("errors/404", { title: "Not Found" });
  await prisma.feesCollection.delete({ where: { id } });
  res.redirect("/fees-collections");
}

// Every active student who still owes something on the fee schedule.
async function outstanding(req, res) {
  const [students, fees, payments] = await Promise.all([
    prisma.student.findMany({ where: { active: true }, include: { classRef: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.fee.findMany({ include: { classRef: true } }),
    prisma.feesCollection.findMany(),
  ]);
  const paymentsByStudent = new Map();
  for (const p of payments) {
    if (!paymentsByStudent.has(p.studentId)) paymentsByStudent.set(p.studentId, []);
    paymentsByStudent.get(p.studentId).push(p);
  }
  const rows = [];
  let grandTotal = 0;
  for (const student of students) {
    const st = computeStatement(fees, paymentsByStudent.get(student.id) || [], student.classRef ? student.classRef.name : null);
    if (st.totalOutstanding > 0) {
      rows.push({ student, ...st });
      grandTotal += cents(st.totalOutstanding);
    }
  }
  rows.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  res.render("fees-collections/outstanding", { title: "Outstanding Fees", currentPage: "fees-outstanding", rows, grandTotal: grandTotal / 100 });
}

async function showInvoice(req, res) {
  const collection = await prisma.feesCollection.findUnique({
    where: { id: Number(req.params.id) },
    include: { student: { include: { classRef: true } } },
  });
  if (!collection) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("fees-collections/invoice", { title: "Receipt", currentPage: "fees-collections", collection });
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove, showInvoice, outstanding });
