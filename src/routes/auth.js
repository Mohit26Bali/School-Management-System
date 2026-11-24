const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authController = require("../controllers/authController");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_ATTEMPT_LIMIT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please wait 15 minutes and try again.",
  handler: (req, res) => {
    res.status(429).render("auth/login", {
      title: "Login",
      role: ["admin", "teacher", "student"].includes(req.body.role) ? req.body.role : "admin",
      email: req.body.email,
      error: "Too many login attempts. Please wait 15 minutes and try again.",
    });
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render("auth/forgot-password", {
      title: "Forgot Password",
      message: "Too many requests. Please wait 15 minutes and try again.",
    });
  },
});

router.get("/login", authController.showLogin);
router.post("/login", loginLimiter, authController.login);

router.get("/forgot-password", authController.showForgotPassword);
router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);

router.get("/reset-password/:token", authController.showResetPassword);
router.post("/reset-password/:token", authController.resetPassword);

router.post("/logout", authController.logout);
router.get("/logout", authController.logout);

module.exports = router;
