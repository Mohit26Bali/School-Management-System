const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const FileStore = require("session-file-store")(session);
const { ensureCsrfToken, verifyCsrfToken } = require("./middleware/csrf");
const { attachNotifications } = require("./middleware/notifications");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const teacherDashboardRoutes = require("./routes/teacherDashboard");
const studentDashboardRoutes = require("./routes/studentDashboard");
const teacherAttendanceRoutes = require("./routes/teacherAttendance");
const studentAttendanceRoutes = require("./routes/studentAttendance");
const attendanceRoutes = require("./routes/attendance");
const profileRoutes = require("./routes/profile");
const studentRoutes = require("./routes/students");
const teacherRoutes = require("./routes/teachers");
const departmentRoutes = require("./routes/departments");
const subjectRoutes = require("./routes/subjects");
const feeRoutes = require("./routes/fees");
const feesCollectionRoutes = require("./routes/feesCollections");
const expenseRoutes = require("./routes/expenses");
const salaryRoutes = require("./routes/salary");
const examRoutes = require("./routes/exam");
const libraryRoutes = require("./routes/library");
const hostelRoutes = require("./routes/hostel");
const transportRoutes = require("./routes/transport");
const sportRoutes = require("./routes/sports");
const holidayRoutes = require("./routes/holiday");
const eventRoutes = require("./routes/event");
const timeTableRoutes = require("./routes/timeTable");
const searchRoutes = require("./routes/search");
const examResultsRoutes = require("./routes/examResults");
const auditRoutes = require("./routes/audit");
const { auditContext } = require("./utils/audit");
const { requireAuth, requireRole } = require("./middleware/auth");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// contentSecurityPolicy is disabled: this app relies on inline <script>/<style>
// blocks throughout (chart init, theme toggle, calendar widget) that a default
// CSP would block. The other headers helmet sets (X-Frame-Options, X-Content-
// Type-Options, HSTS, etc.) are enabled and don't require any code changes.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

const isProduction = process.env.NODE_ENV === "production";

// Behind a host's proxy (Render, Railway, Nginx...) set TRUST_PROXY=1 so secure cookies and rate limits see the real client.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 16 || /change-me/i.test(sessionSecret)) {
  if (isProduction) {
    throw new Error("SESSION_SECRET must be set to a long random value (16+ characters) in production.");
  }
  // Development only: a random secret per run, so nobody can rely on a guessable one. Logins reset on restart.
  sessionSecret = require("crypto").randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET is missing or weak; using a temporary one. Set a real value in .env.");
}

app.use(
  session({
    store: new FileStore({
      path: path.join(__dirname, "..", ".sessions"),
      logFn: () => {},
    }),
    name: "sms.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8, httpOnly: true, sameSite: "lax", secure: isProduction },
  })
);

app.use((req, res, next) => {
  res.locals.sessionUser = req.session.user || null;
  next();
});

app.use(auditContext);
app.use(ensureCsrfToken);
app.use(verifyCsrfToken);
app.use(attachNotifications);

app.use("/", authRoutes);
app.use("/search", requireAuth, requireRole("admin"), searchRoutes);
app.use("/teacher/dashboard", requireAuth, requireRole("teacher"), teacherDashboardRoutes);
app.use("/student/dashboard", requireAuth, requireRole("student"), studentDashboardRoutes);
app.use("/teacher/attendance", requireAuth, requireRole("teacher"), teacherAttendanceRoutes);
app.use("/student/attendance", requireAuth, requireRole("student"), studentAttendanceRoutes);
app.use("/profile", requireAuth, profileRoutes);
app.use("/exam-results", requireAuth, requireRole("admin", "teacher"), examResultsRoutes);
app.use("/attendance", requireAuth, requireRole("admin"), attendanceRoutes);
app.use("/audit", requireAuth, requireRole("admin"), auditRoutes);
app.use("/", requireAuth, requireRole("admin"), dashboardRoutes);
app.use("/students", requireAuth, requireRole("admin"), studentRoutes);
app.use("/teachers", requireAuth, requireRole("admin"), teacherRoutes);
app.use("/departments", requireAuth, requireRole("admin"), departmentRoutes);
app.use("/subjects", requireAuth, requireRole("admin"), subjectRoutes);
app.use("/fees-collections", requireAuth, requireRole("admin"), feesCollectionRoutes);
app.use("/fees", requireAuth, requireRole("admin"), feeRoutes);
app.use("/expenses", requireAuth, requireRole("admin"), expenseRoutes);
app.use("/salary", requireAuth, requireRole("admin"), salaryRoutes);
app.use("/exam", requireAuth, requireRole("admin"), examRoutes);
app.use("/library", requireAuth, requireRole("admin"), libraryRoutes);
app.use("/hostel", requireAuth, requireRole("admin"), hostelRoutes);
app.use("/transport", requireAuth, requireRole("admin"), transportRoutes);
app.use("/sports", requireAuth, requireRole("admin"), sportRoutes);
app.use("/holiday", requireAuth, requireRole("admin"), holidayRoutes);
app.use("/event", requireAuth, requireRole("admin"), eventRoutes);
app.use("/time-table", requireAuth, requireRole("admin"), timeTableRoutes);

app.use((req, res) => {
  res.status(404).render("errors/404", { title: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render("errors/500", { title: "Server Error" });
});

module.exports = app;
