const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { getClassesByNameOnly } = require("../utils/academicOptions");
const { parseAmount } = require("../utils/money");

const prisma = new PrismaClient();

const FEES_TYPES = ["Class Test", "Exam Fees", "Hostel Fees", "Transport Fees", "Mess Fees"];

function fieldsFromBody(body) {
  return {
    feesId: body.feesId,
    feesType: body.feesType || null,
    classId: body.classId ? Number(body.classId) : null,
    amount: body.amount ? parseFloat(body.amount) : null,
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
  };
}

async function list(req, res) {
  const fees = await prisma.fee.findMany({ orderBy: { id: "desc" }, include: { classRef: true } });
  res.render("fees/list", {
    title: "Fees",
    currentPage: "fees",
    fees,
    notice: req.query.notice === "has-payments" ? "Payments have been collected for that fee, so it cannot be deleted." : null,
  });
}

async function showAdd(req, res) {
  res.render("fees/add", { title: "Add Fees", currentPage: "fees", feesTypes: FEES_TYPES, classes: await getClassesByNameOnly() });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  const amount = parseAmount(req.body.amount, "The amount");
  if (!data.feesId || !FEES_TYPES.includes(data.feesType) || amount.error) {
    return res.status(400).render("fees/add", {
      title: "Add Fees",
      currentPage: "fees",
      feesTypes: FEES_TYPES,
      classes: await getClassesByNameOnly(),
      error: amount.error || "Fees ID and Fees Type are required.",
      values: req.body,
    });
  }

  const existing = await prisma.fee.findUnique({ where: { feesId: data.feesId } });
  if (existing) {
    return res.status(400).render("fees/add", {
      title: "Add Fees",
      currentPage: "fees",
      feesTypes: FEES_TYPES,
      classes: await getClassesByNameOnly(),
      error: `Fees ID "${data.feesId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.fee.create({ data });
  res.redirect("/fees");
}

async function showEdit(req, res) {
  const fee = await prisma.fee.findUnique({ where: { id: Number(req.params.id) } });
  if (!fee) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("fees/edit", { title: "Edit Fees", currentPage: "fees", fee, feesTypes: FEES_TYPES, classes: await getClassesByNameOnly() });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const fee = await prisma.fee.findUnique({ where: { id } });
  if (!fee) return res.status(404).render("errors/404", { title: "Not Found" });

  const amount = parseAmount(req.body.amount, "The amount");
  if (!data.feesId || !FEES_TYPES.includes(data.feesType) || amount.error) {
    return res.status(400).render("fees/edit", {
      title: "Edit Fees",
      currentPage: "fees",
      fee: { ...fee, ...req.body },
      feesTypes: FEES_TYPES,
      classes: await getClassesByNameOnly(),
      error: amount.error || "Fees ID and a valid Fees Type are required.",
    });
  }

  if (data.feesId !== fee.feesId) {
    const existing = await prisma.fee.findUnique({ where: { feesId: data.feesId } });
    if (existing) {
      return res.status(400).render("fees/edit", {
        title: "Edit Fees",
        currentPage: "fees",
        fee: { ...fee, ...req.body },
        feesTypes: FEES_TYPES,
        classes: await getClassesByNameOnly(),
        error: `Fees ID "${data.feesId}" is already in use.`,
      });
    }
  }

  await prisma.fee.update({ where: { id }, data });
  res.redirect("/fees");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const fee = await prisma.fee.findUnique({ where: { id }, include: { classRef: true } });
  if (!fee) return res.status(404).render("errors/404", { title: "Not Found" });
  // Payments are recorded against the fee type; deleting the schedule line would leave them with nothing they were paid against.
  const paid = await prisma.feesCollection.count({
    where: { feesType: fee.feesType, ...(fee.classRef ? { student: { classRef: { name: fee.classRef.name } } } : {}) },
  });
  if (paid > 0) return res.redirect("/fees?notice=has-payments");
  await prisma.fee.delete({ where: { id } });
  res.redirect("/fees");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
