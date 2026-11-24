// Marks rules, kept free of the database so they can be tested directly.

// raw: what was typed in the marks box. Returns { blank: true }, { value } or { error }.
function parseMarks(raw, maxMarks) {
  if (raw === undefined || raw === null) return { blank: true };
  if (typeof raw !== "string") return { error: "Enter a number." };
  const text = raw.trim();
  if (text === "") return { blank: true };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: "Enter a number such as 72 or 72.5." };
  const value = Number(text);
  if (value > maxMarks) return { error: `Cannot be more than ${maxMarks}.` };
  return { value };
}

function isPass(marks, maxMarks, passPercent) {
  if (!(maxMarks > 0)) return false;
  return (marks / maxMarks) * 100 >= passPercent;
}

// The mark needed to pass, for display ("Pass mark: 40 of 100").
function passMark(maxMarks, passPercent) {
  return Math.round(((maxMarks * passPercent) / 100) * 100) / 100;
}

module.exports = { parseMarks, isPass, passMark };
