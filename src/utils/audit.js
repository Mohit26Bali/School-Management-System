// An audit trail for money records. Every create, change and delete of a fee payment, expense or salary is written to the
// AuditLog table with who did it, so figures can never change without a trace.
//
// How it is wired: the three controllers use `auditedClient()` instead of a plain Prisma client, which wraps those models'
// create / update / delete. The signed-in user comes from a per-request store filled in by `auditContext` (app.js), so the
// controllers themselves need no extra code.
const { AsyncLocalStorage } = require("async_hooks");
const { PrismaClient } = require("@prisma/client");

const store = new AsyncLocalStorage();
const base = new PrismaClient();

function auditContext(req, res, next) {
  store.run({ user: req.session && req.session.user ? req.session.user : null }, next);
}

const IGNORED_FIELDS = new Set(["createdAt"]);

function plain(record) {
  const out = {};
  for (const [k, v] of Object.entries(record || {})) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

// {field: [before, after]} for the fields that actually changed
function diff(before, after) {
  const changes = {};
  for (const key of Object.keys(after)) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = [before[key] ?? null, after[key] ?? null];
  }
  return changes;
}

async function write(action, entity, entityId, changes) {
  const ctx = store.getStore();
  const user = ctx && ctx.user;
  try {
    await base.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        userId: user ? user.id : null,
        userName: user ? user.name : null,
        changes: JSON.stringify(changes),
      },
    });
  } catch (err) {
    // The money change itself already succeeded; do not turn that into an error page, but make the gap loud.
    console.error("[audit] could not write the audit log entry:", err.message);
  }
}

function hooks(entity, delegateName) {
  const delegate = () => base[delegateName];
  return {
    async create({ args, query }) {
      const created = await query(args);
      await write("create", entity, created.id, plain(created));
      return created;
    },
    async update({ args, query }) {
      const before = await delegate().findUnique({ where: args.where });
      const updated = await query(args);
      const changes = diff(plain(before), plain(updated));
      if (Object.keys(changes).length) await write("update", entity, updated.id, changes);
      return updated;
    },
    async delete({ args, query }) {
      const before = await delegate().findUnique({ where: args.where });
      const removed = await query(args);
      await write("delete", entity, removed.id, plain(before || removed));
      return removed;
    },
  };
}

function auditedClient() {
  return new PrismaClient().$extends({
    query: {
      feesCollection: hooks("FeesCollection", "feesCollection"),
      expense: hooks("Expense", "expense"),
      salary: hooks("Salary", "salary"),
    },
  });
}

module.exports = { auditContext, auditedClient, auditPrisma: base };
