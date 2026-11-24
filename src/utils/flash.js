// One-time messages shown after a redirect ("Saved", "Not allowed because..."). They live in the session, so the text can
// never come from a link someone else crafted.
function setFlash(req, type, text) {
  req.session.flash = { type, text: String(text).slice(0, 300) };
}

// Express middleware: hand the pending message to the views once, then forget it.
function flashMiddleware(req, res, next) {
  res.locals.flash = req.session.flash || null;
  if (req.session.flash) delete req.session.flash;
  next();
}

module.exports = { setFlash, flashMiddleware };
