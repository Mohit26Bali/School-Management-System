/**
 * Wraps every function on a controller object so a rejected promise (or a
 * thrown error inside an async function) is passed to next(err) instead of
 * crashing the whole process. Express 4 does not do this automatically for
 * async route handlers. Non-function exports (e.g. a multer instance) pass
 * through untouched.
 */
function wrapController(handlers) {
  const wrapped = {};
  for (const [key, value] of Object.entries(handlers)) {
    if (typeof value === "function") {
      wrapped[key] = function (req, res, next) {
        Promise.resolve(value(req, res, next)).catch(next);
      };
    } else {
      wrapped[key] = value;
    }
  }
  return wrapped;
}

module.exports = { wrapController };
