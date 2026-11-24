const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { setFlash } = require("../utils/flash");
const { getClassesByNameOnly } = require("../utils/academicOptions");

const prisma = new PrismaClient();

const LANGUAGES = ["English", "Turkish", "Chinese", "Spanish", "Arabic"];
const TYPES = ["Book", "DVD", "CD", "Newspaper"];
const STATUSES = ["In Stock", "Out of Stock"];

function fieldsFromBody(body) {
  return {
    bookId: body.bookId,
    name: body.name,
    language: body.language || null,
    department: body.department || null,
    classId: body.classId ? Number(body.classId) : null,
    type: body.type || null,
    status: body.status || "In Stock",
  };
}

async function formOptions() {
  return { languages: LANGUAGES, classes: await getClassesByNameOnly(), types: TYPES, statuses: STATUSES };
}

async function list(req, res) {
  const books = await prisma.book.findMany({ orderBy: { id: "desc" }, include: { classRef: true } });
  res.render("library/list", { title: "Library", currentPage: "library", books });
}

async function showAdd(req, res) {
  res.render("library/add", { title: "Add Books", currentPage: "library", ...(await formOptions()) });
}

async function create(req, res) {
  const data = fieldsFromBody(req.body);

  if (!data.bookId || !data.name) {
    return res.status(400).render("library/add", {
      title: "Add Books",
      currentPage: "library",
      ...(await formOptions()),
      error: "Book ID and Book Name are required.",
      values: req.body,
    });
  }

  const existing = await prisma.book.findUnique({ where: { bookId: data.bookId } });
  if (existing) {
    return res.status(400).render("library/add", {
      title: "Add Books",
      currentPage: "library",
      ...(await formOptions()),
      error: `Book ID "${data.bookId}" is already in use.`,
      values: req.body,
    });
  }

  await prisma.book.create({ data });
  res.redirect("/library");
}

async function showEdit(req, res) {
  const book = await prisma.book.findUnique({ where: { id: Number(req.params.id) } });
  if (!book) return res.status(404).render("errors/404", { title: "Not Found" });
  res.render("library/edit", { title: "Edit Book", currentPage: "library", book, ...(await formOptions()) });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = fieldsFromBody(req.body);

  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) return res.status(404).render("errors/404", { title: "Not Found" });

  if (data.bookId !== book.bookId) {
    const existing = await prisma.book.findUnique({ where: { bookId: data.bookId } });
    if (existing) {
      return res.status(400).render("library/edit", {
        title: "Edit Book",
        currentPage: "library",
        book: { ...book, ...req.body },
        ...(await formOptions()),
        error: `Book ID "${data.bookId}" is already in use.`,
      });
    }
  }

  // A book that is out on loan stays "Out of Stock" until it is returned at the Loans desk.
  if (data.status === "In Stock" && (await prisma.loan.findFirst({ where: { bookId: id, returnedOn: null } }))) {
    return res.status(400).render("library/edit", {
      title: "Edit Book",
      currentPage: "library",
      book: { ...book, ...req.body },
      ...(await formOptions()),
      error: "This book is out on loan, so it cannot be marked In Stock. Return it under Book Loans first.",
    });
  }

  await prisma.book.update({ where: { id }, data });
  res.redirect("/library");
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!(await prisma.book.findUnique({ where: { id } }))) return res.status(404).render("errors/404", { title: "Not Found" });
  // Lending history is kept, so a book that has ever been lent cannot be deleted.
  if ((await prisma.loan.count({ where: { bookId: id } })) > 0) {
    setFlash(req, "warning", "That book has lending history, so it cannot be deleted. Mark it Out of Stock instead.");
    return res.redirect("/library");
  }
  await prisma.book.delete({ where: { id } });
  res.redirect("/library");
}

module.exports = wrapController({ list, showAdd, create, showEdit, update, remove });
