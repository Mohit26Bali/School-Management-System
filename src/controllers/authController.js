const { wrapController } = require("../utils/asyncHandler");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const isProduction = () => process.env.NODE_ENV === "production";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Form values can arrive as arrays or objects (a=1&a=2, a[b]=1). Anything that is not plain text counts as empty.
function asText(value) {
  return typeof value === "string" ? value : "";
}

// A real bcrypt hash of a throwaway string, compared against when the email is unknown (see login).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);

// After a password reset, sign that user out everywhere (session files live in .sessions/).
function destroyOtherSessions(userId) {
  const dir = path.join(__dirname, "..", "..", ".sessions");
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of files) {
    if (!name.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      if (data.userId === userId) fs.unlinkSync(path.join(dir, name));
    } catch {
      /* unreadable or already gone */
    }
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function dashboardPathForRole(role) {
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "student") return "/student/dashboard";
  return "/";
}

const ROLE_LABELS = { admin: "Admin", teacher: "Teacher", student: "Student" };

function showLogin(req, res) {
  res.render("auth/login", { title: "Login", role: "admin" });
}

async function login(req, res) {
  const email = asText(req.body.email).trim().toLowerCase();
  const password = asText(req.body.password);
  const role = ["admin", "teacher", "student"].includes(req.body.role) ? req.body.role : "admin";
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  // Always run one bcrypt comparison so a wrong email takes as long as a wrong password.
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !passwordOk) {
    return res.status(401).render("auth/login", {
      title: "Login",
      error: "Invalid email or password.",
      email,
      role,
    });
  }

  if (user.role !== role) {
    return res.status(401).render("auth/login", {
      title: "Login",
      error: `This account logs in as ${ROLE_LABELS[user.role]}. Switch tabs and try again.`,
      email,
      role,
    });
  }

  // A fresh session id on login, so an id planted before login can never become a logged-in session.
  await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
  req.session.userId = user.id;
  req.session.user = {
    id: user.id,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
  res.redirect(dashboardPathForRole(user.role));
}

function showForgotPassword(req, res) {
  res.render("auth/forgot-password", { title: "Forgot Password" });
}

async function forgotPassword(req, res) {
  const email = asText(req.body.email).trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  let resetUrl;
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashToken(token),
        resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const link = `${req.protocol}://${req.get("host")}/reset-password/${token}`;
    // No email service is connected. Outside production the link is shown on the page so the flow can be tried.
    // In production it is NEVER shown (anyone could reset any account); it goes to the server log for the
    // administrator to pass on, until real email delivery is added.
    console.log(`[password reset] link for ${user.email}: ${link}`);
    if (!isProduction()) resetUrl = link;
  }

  res.render("auth/forgot-password", {
    title: "Forgot Password",
    message: isProduction()
      ? "If an account exists for that email, a reset link has been prepared. Ask your school administrator for it."
      : "If an account exists for that email, a reset link has been generated below (development mode only).",
    resetUrl,
  });
}

function showResetPassword(req, res) {
  res.render("auth/reset-password", { title: "Reset Password", token: req.params.token });
}

async function resetPassword(req, res) {
  const { token } = req.params;
  const password = asText(req.body.password);
  const confirmPassword = asText(req.body.confirmPassword);

  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hashToken(String(token)), resetTokenExpiry: { gt: new Date() } },
  });

  if (!user) {
    return res.status(400).render("auth/reset-password", {
      title: "Reset Password",
      token,
      error: "This reset link is invalid or has expired. Request a new one.",
    });
  }

  const errors = [];
  if (!password || password.length < 8) errors.push("Password must be at least 8 characters.");
  if (password !== confirmPassword) errors.push("Passwords do not match.");

  if (errors.length) {
    return res.status(400).render("auth/reset-password", { title: "Reset Password", token, errors });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiry: null },
  });
  destroyOtherSessions(user.id);

  res.render("auth/login", {
    title: "Login",
    role: "admin",
    message: "Password reset successfully. Log in with your new password.",
  });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

module.exports = wrapController({
  showLogin,
  login,
  showForgotPassword,
  forgotPassword,
  showResetPassword,
  resetPassword,
  logout,
});
