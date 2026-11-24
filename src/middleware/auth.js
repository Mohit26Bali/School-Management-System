function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).render("errors/403", { title: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
