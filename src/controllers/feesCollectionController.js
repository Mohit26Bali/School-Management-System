const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student) {
    return res.status(400).render("fees-collections/add", {
      title: "Add Fees Collection",
      currentPage: "fees-collections",
      feesTypes: FEES_TYPES,
      error: `No student found with Student ID "${studentId}".`,
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

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student) {
    return res.status(400).render("fees-collections/edit", {
      title: "Edit Fees Collection",
      currentPage: "fees-collections",
      collection: { ...collection, student: { studentId } },
      feesTypes: FEES_TYPES,
      error: `No student found with Student ID "${studentId}".`,
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
  await prisma.feesCollection.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/fees-collections");
}

async function showInvoice(req, res) {
  const collection = await prisma.feesCollection.findUnique({
    where: { id: Number(req.params.id) },
    include: { student: { include: { classRef: true } } },
  });
  if (!collection) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("fees-collections/invoice", { title: "Receipt", currentPage: "fees-collections", collection });
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove, showInvoice });
