const { wrapController } = require("../utils/asyncHandler");
const { auditedClient } = require("../utils/audit");
const { parseAmount } = require("../utils/money");

// Writes to money records are recorded in the audit log (see utils/audit.js)
const prisma = auditedClient();

function fieldsFromBody(body) {
  return {
    expensesId: body.expensesId,
    itemName: body.itemName,
    itemQuality: body.itemQuality || null,
    amount: body.amount ? parseFloat(body.amount) : null,
    sourceOfPurchase: body.sourceOfPurchase || null,
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
    purchaseBy: body.purchaseBy || null,
  };
}

async function list(req, res) {
  const expenses = await prisma.expense.findMany({ orderBy: { id: "desc" } });
  res.render("expenses/list", { title: "Expenses", currentPage: "expenses", expenses });
}

function showAdd(req, res) {
  res.render("expenses/add", { title: "Add Expenses", currentPage: "expenses" });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  const amount = parseAmount(req.body.amount, "The amount");
  if (!data.expensesId || !data.itemName || amount.error) {
    return res.status(400).render("expenses/add", {
      title: "Add Expenses",
      currentPage: "expenses",
      error: amount.error || "Expenses ID and Item Name are required.",
      values: req.body,
    });
  }

  const existing = await prisma.expense.findUnique({ where: { expensesId: data.expensesId } });
  if (existing) {
    return res.status(400).render("expenses/add", {
      title: "Add Expenses",
      currentPage: "expenses",
      error: `Expenses ID "${data.expensesId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.expense.create({ data });
  res.redirect("/expenses");
}

async function showEdit(req, res) {
  const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } });
  if (!expense) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("expenses/edit", { title: "Edit Expense", currentPage: "expenses", expense });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return res.status(404).render("errors/404", { title: "Not Found" });

  const amount = parseAmount(req.body.amount, "The amount");
  if (!data.expensesId || !data.itemName || amount.error) {
    return res.status(400).render("expenses/edit", {
      title: "Edit Expense",
      currentPage: "expenses",
      expense: { ...expense, ...req.body },
      error: amount.error || "Expenses ID and Item Name are required.",
    });
  }

  if (data.expensesId !== expense.expensesId) {
    const existing = await prisma.expense.findUnique({ where: { expensesId: data.expensesId } });
    if (existing) {
      return res.status(400).render("expenses/edit", {
        title: "Edit Expense",
        currentPage: "expenses",
        expense: { ...expense, ...req.body },
        error: `Expenses ID "${data.expensesId}" is already in use.`,
      });
    }
  }

  await prisma.expense.update({ where: { id }, data });
  res.redirect("/expenses");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!(await prisma.expense.findUnique({ where: { id } }))) return res.status(404).render("errors/404", { title: "Not Found" });
  await prisma.expense.delete({ where: { id } });
  res.redirect("/expenses");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
