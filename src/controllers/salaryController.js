const { wrapController } = require("../utils/asyncHandler");
const { auditedClient } = require("../utils/audit");
const { parseAmount } = require("../utils/money");

// Writes to money records are recorded in the audit log (see utils/audit.js)
const prisma = auditedClient();

async function list(req, res) {
  const salaries = await prisma.salary.findMany({
    orderBy: { id: "desc" },
    include: { teacher: true },
  });
  res.render("salary/list", { title: "Salary", currentPage: "salary", salaries });
}

function showAdd(req, res) {
  res.render("salary/add", { title: "Add Salary", currentPage: "salary" });
}

async function create(req, res) {
  const { teacherId, paymentDate } = req.body;
  const amount = parseAmount(req.body.amount, "The amount");
  const parsedAmount = amount.value;

  if (!teacherId || typeof teacherId !== "string" || amount.error) {
    return res.status(400).render("salary/add", {
      title: "Add Salary",
      currentPage: "salary",
      error: amount.error || "Staff ID is required.",
      values: req.body,
    });
  }

  const teacher = await prisma.teacher.findFirst({ where: { teacherId, active: true } });
  if (!teacher) {
    return res.status(400).render("salary/add", {
      title: "Add Salary",
      currentPage: "salary",
      error: `No staff found with Staff ID "${teacherId}".`,
      values: req.body,
    });
  }

  await prisma.salary.create({
    data: {
      amount: parsedAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : null,
      teacherId: teacher.id,
    },
  });
  res.redirect("/salary");
}

async function showEdit(req, res) {
  const salary = await prisma.salary.findUnique({
    where: { id: Number(req.params.id) },
    include: { teacher: true },
  });
  if (!salary) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("salary/edit", { title: "Edit Salary", currentPage: "salary", salary });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const { paymentDate } = req.body;
  const teacherId = typeof req.body.teacherId === "string" ? req.body.teacherId : "";
  const amount = parseAmount(req.body.amount, "The amount");
  const parsedAmount = amount.value;

  const salary = await prisma.salary.findUnique({ where: { id }, include: { teacher: true } });
  if (!salary) return res.status(404).render("errors/404", { title: "Not Found" });

  if (amount.error) {
    return res.status(400).render("salary/edit", {
      title: "Edit Salary",
      currentPage: "salary",
      salary: { ...salary, ...req.body, teacher: { teacherId } },
      error: amount.error,
    });
  }

  const teacher = await prisma.teacher.findUnique({ where: { teacherId } });
  if (!teacher) {
    return res.status(400).render("salary/edit", {
      title: "Edit Salary",
      currentPage: "salary",
      salary: { ...salary, teacher: { teacherId } },
      error: `No staff found with Staff ID "${teacherId}".`,
    });
  }

  await prisma.salary.update({
    where: { id },
    data: {
      amount: parsedAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : null,
      teacherId: teacher.id,
    },
  });
  res.redirect("/salary");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!(await prisma.salary.findUnique({ where: { id } }))) return res.status(404).render("errors/404", { title: "Not Found" });
  await prisma.salary.delete({ where: { id } });
  res.redirect("/salary");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
