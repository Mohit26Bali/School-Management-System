// Library lending rules. Pure, so they can be tested directly. All days are whole days at midnight UTC.
const DAY_MS = 24 * 60 * 60 * 1000;

function settings(env = process.env) {
  const int = (v, d, min, max) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : d;
  };
  const fine = Number(env.LIBRARY_FINE_PER_DAY);
  return {
    loanDays: int(env.LIBRARY_LOAN_DAYS, 14, 1, 120),
    maxLoans: int(env.LIBRARY_MAX_LOANS, 3, 1, 50),
    finePerDay: Number.isFinite(fine) && fine >= 0 && fine <= 1000 ? Math.round(fine * 100) / 100 : 1,
  };
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

// Days past the due date at the moment of return (0 when on time or early)
function overdueDays(dueOn, returnedOn) {
  return Math.max(0, Math.floor((returnedOn.getTime() - dueOn.getTime()) / DAY_MS));
}

function fineFor(days, finePerDay) {
  return Math.round(days * finePerDay * 100) / 100;
}

function today() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

module.exports = { settings, addDays, overdueDays, fineFor, today };
