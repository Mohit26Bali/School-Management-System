const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
  const { teacherId, amount, paymentDate } = req.body;
  const parsedAmount = amount ? parseFloat(amount) : null;

  if (!teacherId || parsedAmount === null || Number.isNaN(parsedAmount)) {
    return res.status(400).render("salary/add", {
      title: "Add Salary",
      currentPage: "salary",
      error: "Staff ID and a valid Amount are required.",
      values: req.body,
    });
  }

  const teacher = await prisma.teacher.findUnique({ where: { teacherId } });
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
  const { teacherId, amount, paymentDate } = req.body;
  const parsedAmount = amount ? parseFloat(amount) : null;

  const salary = await prisma.salary.findUnique({ where: { id }, include: { teacher: true } });
  if (!salary) return res.status(404).render("errors/404", { title: "Not Found" });

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
  await prisma.salary.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/salary");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
