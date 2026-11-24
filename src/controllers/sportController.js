const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function fieldsFromBody(body) {
  return {
    sportsId: body.sportsId,
    name: body.name,
    coachName: body.coachName || null,
    startedYear: body.startedYear ? new Date(body.startedYear) : null,
  };
}

async function list(req, res) {
  const sports = await prisma.sport.findMany({ orderBy: { id: "desc" } });
  res.render("sports/list", { title: "Sports", currentPage: "sports", sports });
}

function showAdd(req, res) {
  res.render("sports/add", { title: "Add Sports", currentPage: "sports" });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.sportsId || !data.name) {
    return res.status(400).render("sports/add", {
      title: "Add Sports",
      currentPage: "sports",
      error: "Sports ID and Sports Name are required.",
      values: req.body,
    });
  }

  const existing = await prisma.sport.findUnique({ where: { sportsId: data.sportsId } });
  if (existing) {
    return res.status(400).render("sports/add", {
      title: "Add Sports",
      currentPage: "sports",
      error: `Sports ID "${data.sportsId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.sport.create({ data });
  res.redirect("/sports");
}

async function showEdit(req, res) {
  const sport = await prisma.sport.findUnique({ where: { id: Number(req.params.id) } });
  if (!sport) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("sports/edit", { title: "Edit Sports", currentPage: "sports", sport });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const sport = await prisma.sport.findUnique({ where: { id } });
  if (!sport) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.sportsId !== sport.sportsId) {
    const existing = await prisma.sport.findUnique({ where: { sportsId: data.sportsId } });
    if (existing) {
      return res.status(400).render("sports/edit", {
        title: "Edit Sports",
        currentPage: "sports",
        sport: { ...sport, ...req.body },
        error: `Sports ID "${data.sportsId}" is already in use.`,
      });
    }
  }

  await prisma.sport.update({ where: { id }, data });
  res.redirect("/sports");
}

async function remove(req, res) {
  await prisma.sport.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/sports");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
