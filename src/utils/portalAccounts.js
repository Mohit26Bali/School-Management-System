// Giving a student or teacher a login for the portal, or resetting it, from the admin side.
const bcrypt = require("bcryptjs");
const { passwordProblem } = require("./passwords");
const { destroySessionsFor } = require("./sessions");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// person: a Student or Teacher row. role: "student" | "teacher". body: the submitted form.
// Returns { error } or { created: true } / { updated: true }.
async function setPortalLogin(prisma, person, role, body) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email.length > 100 || !EMAIL.test(email)) return { error: "Enter a valid email address for the login." };
  const problem = passwordProblem(password, email);
  if (problem) return { error: problem };

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken && taken.id !== person.userId) return { error: `The email "${email}" is already used by another account.` };

  const name = person.name || `${person.firstName} ${person.lastName}`;
  const passwordHash = await bcrypt.hash(password, 10);

  if (person.userId) {
    await prisma.user.update({ where: { id: person.userId }, data: { email, passwordHash, active: person.active } });
    destroySessionsFor(person.userId); // the old password no longer works anywhere
    return { updated: true };
  }

  const user = await prisma.user.create({ data: { name, email, passwordHash, role, active: person.active } });
  const model = role === "student" ? prisma.student : prisma.teacher;
  await model.update({ where: { id: person.id }, data: { userId: user.id } });
  return { created: true };
}

module.exports = { setPortalLogin };
