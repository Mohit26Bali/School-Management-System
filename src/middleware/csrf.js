const crypto = require("crypto");

function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function tokenMatches(req) {
  const submitted = req.body && req.body._csrf;
  return Boolean(submitted) && submitted === req.session.csrfToken;
}

// Used globally. Defers multipart/form-data requests (file uploads) to
// verifyCsrfTokenParsed, which the affected routes call themselves after
// their multer middleware has actually parsed the body.
function verifyCsrfToken(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  if (req.is("multipart/form-data")) return next();

  if (tokenMatches(req)) return next();
  res.status(403).render("errors/403", { title: "Forbidden" });
}

// Used on multipart routes, placed after the multer middleware in the route
// chain, once req.body is actually populated.
function verifyCsrfTokenParsed(req, res, next) {
  if (tokenMatches(req)) return next();
  res.status(403).render("errors/403", { title: "Forbidden" });
}

module.exports = { ensureCsrfToken, verifyCsrfToken, verifyCsrfTokenParsed };
