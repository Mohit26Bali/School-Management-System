const { wrapController } = require("../utils/asyncHandler");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function showProfile(req, res, extra = {}) {
  const profileUser = await prisma.user.findUnique({ where: { id: req.session.user.id } });
  res.render("profile/show", { title: "Profile", currentPage: "profile", profileUser, ...extra });
}

async function updateProfile(req, res) {
  const { name } = req.body;

  if (!name) {
    return showProfile(req, res, { profileError: "Name is required." });
  }

  const data = { name };
  if (req.file) data.avatarUrl = `/uploads/${req.file.filename}`;

  const user = await prisma.user.update({ where: { id: req.session.user.id }, data });
  req.session.user = { ...req.session.user, name: user.name, avatarUrl: user.avatarUrl };

  showProfile(req, res, { profileSuccess: "Profile updated." });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.session.user.id } });
  const errors = [];

  if (!(await bcrypt.compare(currentPassword || "", user.passwordHash))) {
    errors.push("Current password is incorrect.");
  }
  if (!newPassword || newPassword.length < 8) {
    errors.push("New password must be at least 8 characters.");
  }
  if (newPassword !== confirmPassword) {
    errors.push("New passwords do not match.");
  }

  if (errors.length) {
    return showProfile(req, res, { passwordErrors: errors });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  showProfile(req, res, { passwordSuccess: "Password changed." });
}

module.exports = wrapController({ showProfile, updateProfile, changePassword });
