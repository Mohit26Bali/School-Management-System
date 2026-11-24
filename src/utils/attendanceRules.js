// Which days attendance may be marked on. Pure rules, so they can be tested directly.
//   - never a day in the future
//   - not on a weekend day (WEEKEND_DAYS, default Saturday and Sunday: "0,6" with Sunday = 0)
//   - not on a holiday (checked by the caller against the Holiday table)
//   - teachers can look back ATTENDANCE_EDIT_DAYS days (default 14); older days are locked

function weekendDays(env = process.env.WEEKEND_DAYS) {
  const list = String(env === undefined ? "0,6" : env)
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return new Set(list);
}

function editWindowDays(env = process.env.ATTENDANCE_EDIT_DAYS) {
  const n = Number(env);
  return Number.isInteger(n) && n >= 0 ? n : 14;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// date: Date at midnight UTC for the day; today: the same for today. Returns a message or null.
function dateProblem(date, today, { weekend = weekendDays(), windowDays = editWindowDays() } = {}) {
  if (date.getTime() > today.getTime()) return "Attendance cannot be marked for a day that has not happened yet.";
  if (weekend.has(date.getUTCDay())) return `${NAMES[date.getUTCDay()]} is a weekend day. There is no school, so no attendance.`;
  if ((today.getTime() - date.getTime()) / DAY_MS > windowDays) return `That day is more than ${windowDays} days ago, so it is locked. Ask the school office to correct it.`;
  return null;
}

module.exports = { dateProblem, weekendDays, editWindowDays };
