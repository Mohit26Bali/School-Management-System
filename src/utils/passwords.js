// Password rules shared by every place a password is set. Returns a message, or null when the password is acceptable.
// 72 is the most characters bcrypt actually uses; longer ones would silently be cut short.
function passwordProblem(password, email) {
  if (typeof password !== "string" || password.length < 8) return "The password must be at least 8 characters.";
  if (password.length > 72) return "The password can be at most 72 characters.";
  if (/^\s|\s$/.test(password)) return "The password cannot start or end with a space.";
  if (email && password.toLowerCase() === String(email).toLowerCase()) return "The password cannot be the same as the email address.";
  if (/^(.)\1+$/.test(password)) return "The password cannot be one character repeated.";
  return null;
}

module.exports = { passwordProblem };
