// What a student owes and has paid, per fee type.
//
// A fee on the schedule (Fees page) applies to a student when it has no class set (everyone) or when its class matches
// the student's class level (name, any section). The amount due for a fee type is the total of the fees of that type that
// apply; payments (Fees Collection) count toward the type they were recorded under.

const cents = (n) => Math.round(Number(n) * 100);
const money = (c) => c / 100;

function appliesTo(fee, className) {
  return !fee.classRef || fee.classRef.name === className;
}

// fees: [{ feesType, amount, classRef }], payments: [{ feesType, amount }]. Pure, so it can be tested directly.
function computeStatement(fees, payments, className) {
  const rows = new Map();
  const row = (type) => {
    if (!rows.has(type)) rows.set(type, { feesType: type, dueC: 0, paidC: 0 });
    return rows.get(type);
  };
  for (const fee of fees) if (appliesTo(fee, className)) row(fee.feesType).dueC += cents(fee.amount);
  for (const p of payments) row(p.feesType).paidC += cents(p.amount);

  const lines = [...rows.values()]
    .map((r) => ({
      feesType: r.feesType,
      due: money(r.dueC),
      paid: money(r.paidC),
      outstanding: money(Math.max(0, r.dueC - r.paidC)),
      overpaid: money(Math.max(0, r.paidC - r.dueC)),
    }))
    .sort((a, b) => a.feesType.localeCompare(b.feesType));

  return {
    lines,
    totalDue: money(lines.reduce((s, l) => s + cents(l.due), 0)),
    totalPaid: money(lines.reduce((s, l) => s + cents(l.paid), 0)),
    totalOutstanding: money(lines.reduce((s, l) => s + cents(l.outstanding), 0)),
  };
}

// How much more can be paid for one fee type? (null when no such fee applies to this student)
// excludePaymentId: when editing a payment, that payment does not count against itself.
function remainingFor(statement, feesType, excludedPayment) {
  const line = statement.lines.find((l) => l.feesType === feesType);
  if (!line || line.due === 0) return null;
  const alreadyPaid = cents(line.paid) - (excludedPayment ? cents(excludedPayment.amount) : 0);
  return money(Math.max(0, cents(line.due) - alreadyPaid));
}

async function statementFor(prisma, student) {
  const className = student.classRef ? student.classRef.name : null;
  const [fees, payments] = await Promise.all([
    prisma.fee.findMany({ include: { classRef: true } }),
    prisma.feesCollection.findMany({ where: { studentId: student.id } }),
  ]);
  return computeStatement(fees, payments, className);
}

module.exports = { computeStatement, remainingFor, statementFor, cents, money };
