const { wrapController } = require("../utils/asyncHandler");
const { PrismaClient } = require("@prisma/client");
const { buildCalendar, buildHighlightsForCurrentMonth } = require("../utils/calendar");

const prisma = new PrismaClient();

function lastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-US", { month: "short" }) });
  }
  return keys;
}

function monthKeyOf(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function showDashboard(req, res) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [studentCount, teacherCount, feesAgg, expensesAgg, feesRows, expenseRows, holidays, events] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.feesCollection.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.feesCollection.findMany({ where: { paidDate: { gte: sixMonthsAgo } }, select: { amount: true, paidDate: true } }),
    prisma.expense.findMany({ where: { purchaseDate: { gte: sixMonthsAgo } }, select: { amount: true, purchaseDate: true } }),
    prisma.holiday.findMany(),
    prisma.event.findMany(),
  ]);

  const months = lastNMonthKeys(6);
  const feesByMonth = {};
  const expensesByMonth = {};
  for (const row of feesRows) {
    if (!row.paidDate) continue;
    const key = monthKeyOf(row.paidDate);
    feesByMonth[key] = (feesByMonth[key] || 0) + row.amount;
  }
  for (const row of expenseRows) {
    if (!row.purchaseDate) continue;
    const key = monthKeyOf(row.purchaseDate);
    expensesByMonth[key] = (expensesByMonth[key] || 0) + row.amount;
  }

  const chartLabels = months.map((m) => m.label);
  const feesSeries = months.map((m) => Math.round((feesByMonth[m.key] || 0) * 100) / 100);
  const expensesSeries = months.map((m) => Math.round((expensesByMonth[m.key] || 0) * 100) / 100);

  const calendar = buildCalendar(buildHighlightsForCurrentMonth(holidays, events));

  res.render("dashboard/admin", {
    title: "Dashboard",
    currentPage: "dashboard",
    studentCount,
    teacherCount,
    feesTotal: feesAgg._sum.amount || 0,
    expensesTotal: expensesAgg._sum.amount || 0,
    chartLabels,
    feesSeries,
    expensesSeries,
    calendar,
  });
}

module.exports = wrapController({ showDashboard });
