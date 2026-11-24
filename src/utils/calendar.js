function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildCalendar(highlightsByDate) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = fmt(now);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = fmt(dateObj);
    cells.push({
      day: d,
      dateStr,
      isToday: dateStr === todayStr,
      highlights: highlightsByDate[dateStr] || [],
    });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const lastWeek = weeks[weeks.length - 1];
  while (lastWeek.length < 7) lastWeek.push(null);

  return {
    monthLabel: firstDay.toLocaleString("en-US", { month: "long", year: "numeric" }),
    weeks,
  };
}

/**
 * Builds a { 'YYYY-MM-DD': [{ label, type }] } map from Holiday and Event rows
 * for the current calendar month, for the shared dashboard calendar widget.
 */
function buildHighlightsForCurrentMonth(holidays, events) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const highlights = {};

  function addRange(start, end, label, type) {
    if (!start) return;
    const from = new Date(Math.max(start.getTime(), new Date(year, month, 1).getTime()));
    const to = new Date(Math.min((end || start).getTime(), new Date(year, month + 1, 0).getTime()));
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = fmt(d);
      if (!highlights[key]) highlights[key] = [];
      highlights[key].push({ label, type });
    }
  }

  for (const h of holidays) addRange(h.startDate, h.endDate, h.name, "holiday");
  for (const ev of events) addRange(ev.eventDate, ev.eventDate, ev.name, "event");

  return highlights;
}

module.exports = { buildCalendar, buildHighlightsForCurrentMonth, fmt };
