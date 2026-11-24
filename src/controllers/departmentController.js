const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    departmentId: body.departmentId,
    name: body.name,
    headOfDepartment: body.headOfDepartment || null,
    startDate: body.startDate ? new Date(body.startDate) : null,
  };
}

async function list(req, res) {
  const departments = await prisma.department.findMany({ orderBy: { id: "desc" } });
  res.render("departments/list", { title: "Departments", currentPage: "departments", departments });
}

function showAdd(req, res) {
  res.render("departments/add", { title: "Add Department", currentPage: "departments" });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.departmentId || !data.name) {
    return res.status(400).render("departments/add", {
      title: "Add Department",
      currentPage: "departments",
      error: "Department ID and Name are required.",
      values: req.body,
    });
  }

  const existing = await prisma.department.findUnique({ where: { departmentId: data.departmentId } });
  if (existing) {
    return res.status(400).render("departments/add", {
      title: "Add Department",
      currentPage: "departments",
      error: `Department ID "${data.departmentId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.department.create({ data });
  res.redirect("/departments");
}

async function showEdit(req, res) {
  const department = await prisma.department.findUnique({ where: { id: Number(req.params.id) } });
  if (!department) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("departments/edit", { title: "Edit Department", currentPage: "departments", department });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.departmentId !== department.departmentId) {
    const existing = await prisma.department.findUnique({ where: { departmentId: data.departmentId } });
    if (existing) {
      return res.status(400).render("departments/edit", {
        title: "Edit Department",
        currentPage: "departments",
        department: { ...department, ...req.body },
        error: `Department ID "${data.departmentId}" is already in use.`,
      });
    }
  }

  await prisma.department.update({ where: { id }, data });
  res.redirect("/departments");
}

async function remove(req, res) {
  await prisma.department.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/departments");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
