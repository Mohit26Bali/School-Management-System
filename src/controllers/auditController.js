const { wrapController } = require("../utils/asyncHandler");
const { auditPrisma: prisma } = require("../utils/audit");

const ENTITIES = { FeesCollection: "Fee payments", Expense: "Expenses", Salary: "Salaries" };
const PAGE_SIZE = 50;

async function list(req, res) {
  const entity = Object.keys(ENTITIES).includes(req.query.entity) ? req.query.entity : "";
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const where = entity ? { entity } : {};

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { id: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);

  const entries = rows.map((r) => {
    let changes = {};
    try {
      changes = JSON.parse(r.changes);
    } catch {
      /* leave empty */
    }
    return { ...r, changes };
  });

  res.render("audit/list", {
    title: "Audit Log",
    currentPage: "audit",
    entries,
    entities: ENTITIES,
    entity,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  });
}

module.exports = wrapController({ list });
