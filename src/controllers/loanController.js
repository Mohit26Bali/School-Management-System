const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { settings, addDays, overdueDays, fineFor, today } = require("../utils/library");
const { setFlash } = require("../utils/flash");

const prisma = new PrismaClient();

async function list(req, res) {
  const show = req.query.show === "history" ? "history" : "open";
  const loans = await prisma.loan.findMany({
    where: show === "open" ? { returnedOn: null } : { returnedOn: { not: null } },
    include: { book: true, student: true },
    orderBy: show === "open" ? { dueOn: "asc" } : { returnedOn: "desc" },
    take: 200,
  });
  res.render("library/loans", {
    title: "Book Loans",
    currentPage: "loans",
    loans,
    show,
    now: today(),
    cfg: settings(),
  });
}

function showIssue(req, res) {
  res.render("library/issue", { title: "Issue a Book", currentPage: "loans", cfg: settings() });
}

// A book can be issued when it is in stock and not already out; to an active student with fewer than the maximum loans.
async function issue(req, res) {
  const cfg = settings();
  const bookCode = typeof req.body.bookId === "string" ? req.body.bookId.trim() : "";
  const studentCode = typeof req.body.studentId === "string" ? req.body.studentId.trim() : "";
  const fail = (error) => res.status(400).render("library/issue", { title: "Issue a Book", currentPage: "loans", cfg, error, values: req.body });

  if (!bookCode || !studentCode) return fail("Book ID and Student ID are required.");
  const book = await prisma.book.findUnique({ where: { bookId: bookCode } });
  if (!book) return fail(`No book found with Book ID "${bookCode}".`);
  const student = await prisma.student.findFirst({ where: { studentId: studentCode, active: true } });
  if (!student) return fail(`No active student found with Student ID "${studentCode}".`);

  if (await prisma.loan.findFirst({ where: { bookId: book.id, returnedOn: null } })) return fail(`"${book.name}" is already out on loan.`);
  if (book.status !== "In Stock") return fail(`"${book.name}" is marked "${book.status}" and cannot be issued.`);
  const open = await prisma.loan.count({ where: { studentId: student.id, returnedOn: null } });
  if (open >= cfg.maxLoans) return fail(`${student.firstName} ${student.lastName} already has ${open} books out, which is the limit (${cfg.maxLoans}). Return one first.`);
  if (await prisma.loan.findFirst({ where: { studentId: student.id, returnedOn: null, dueOn: { lt: today() } } })) {
    return fail(`${student.firstName} ${student.lastName} has an overdue book. It must be returned before another is issued.`);
  }

  const issuedOn = today();
  await prisma.$transaction([
    prisma.loan.create({ data: { bookId: book.id, studentId: student.id, issuedOn, dueOn: addDays(issuedOn, cfg.loanDays) } }),
    prisma.book.update({ where: { id: book.id }, data: { status: "Out of Stock" } }),
  ]);
  setFlash(req, "success", `Issued "${book.name}" to ${student.firstName} ${student.lastName}. Due back in ${cfg.loanDays} days.`);
  res.redirect("/library/loans");
}

async function returnBook(req, res) {
  const id = Number(req.params.id);
  const loan = await prisma.loan.findUnique({ where: { id }, include: { book: true, student: true } });
  if (!loan) return res.status(404).render("errors/404", { title: "Not Found" });
  if (loan.returnedOn) {
    setFlash(req, "warning", "That book has already been returned.");
    return res.redirect("/library/loans");
  }

  const returnedOn = today();
  const late = overdueDays(loan.dueOn, returnedOn);
  const fine = fineFor(late, settings().finePerDay);
  await prisma.$transaction([
    prisma.loan.update({ where: { id }, data: { returnedOn, fine } }),
    prisma.book.update({ where: { id: loan.bookId }, data: { status: "In Stock" } }),
  ]);
  const note = fine > 0 ? ` It was ${late} day${late === 1 ? "" : "s"} late: fine ${fine.toFixed(2)}.` : "";
  setFlash(req, fine > 0 ? "warning" : "success", `"${loan.book.name}" returned by ${loan.student.firstName} ${loan.student.lastName}.${note}`);
  res.redirect("/library/loans");
}

module.exports = wrapController({ list, showIssue, issue, returnBook });
