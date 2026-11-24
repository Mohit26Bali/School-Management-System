// Money typed into a form: a positive amount with at most two decimals, up to 999,999,999.99.
// Returns { value } or { error }.
function parseAmount(raw, label = "The amount") {
  if (typeof raw !== "string" || raw.trim() === "") return { error: `${label} is required.` };
  const text = raw.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return { error: `${label} must be a positive number with at most two decimals.` };
  const value = Number(text);
  if (!(value > 0)) return { error: `${label} must be greater than zero.` };
  return { value };
}

module.exports = { parseAmount };
