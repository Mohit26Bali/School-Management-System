// Time rules for the timetable, kept free of the database so they can be tested directly.

// "09:30" -> 570 (minutes since midnight), or null when it is not a 24-hour HH:MM time
function parseTime(text) {
  if (typeof text !== "string") return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// "2026-03-02" -> Date at midnight UTC, or null when it is not a real calendar date
function parseDay(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return null;
  const date = new Date(text.trim());
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text.trim() ? null : date;
}

// Two lessons clash when they overlap; one that ends exactly when the next starts does not.
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// existing: [{ startTime, endTime, ... }] on the same day. Returns the first one that overlaps the candidate, or null.
function findClash(existing, start, end) {
  for (const e of existing) {
    const s = parseTime(e.startTime);
    const t = parseTime(e.endTime);
    if (s === null || t === null) continue;
    if (overlaps(start, end, s, t)) return e;
  }
  return null;
}

module.exports = { parseTime, parseDay, overlaps, findClash };
