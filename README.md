# School Management System

A full-stack school/college administration web app built with **Node.js, Express, Prisma (SQLite), and server-rendered EJS views**. It supports three roles — **Admin**, **Teacher**, and **Student** — each with their own dashboard and permissions, and covers the day-to-day operations of running a school: student/teacher records, attendance, exams, fees, timetables, library, hostel, transport, and more.

## Tech Stack

| Layer           | Choice                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Runtime         | Node.js, Express 4                                                                                          |
| Views           | EJS templates, server-rendered (no SPA framework)                                                           |
| Database        | SQLite via Prisma ORM                                                                                       |
| Auth            | `express-session` (file-backed store) + `bcryptjs` password hashing                                         |
| Security        | `helmet` security headers, hand-rolled CSRF protection, `express-rate-limit` on login                       |
| File uploads    | `multer` (student/teacher profile photos)                                                                   |
| Frontend assets | Bootstrap-based admin template (vendored CSS/JS), DataTables, Select2, bootstrap-datetimepicker, ApexCharts |

No build step, no bundler — static assets are served as-is from `public/`, and pages are rendered server-side per request.

## Getting Started

```bash
npm install
npx prisma migrate dev      # create/update the SQLite database
npx prisma db seed          # (or: node prisma/seed.js) populate sample data
npm run dev                 # starts the server at http://localhost:3000
```

Environment config lives in `.env` (copy `.env.example` to start):

```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="<32+ random characters>"
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. In development a missing or weak `SESSION_SECRET` falls back to a temporary random one (you are signed out on every restart); with `NODE_ENV=production` the app **refuses to start** without a real one. Other optional settings (`PORT`, `NODE_ENV`, `TRUST_PROXY`, `LOGIN_ATTEMPT_LIMIT`, `WEEKEND_DAYS`, `ATTENDANCE_EDIT_DAYS`) are described in `.env.example`.

### Tests

```bash
npm test
```

Starts the real app on a throwaway database and checks login, sessions, CSRF, role access, password reset, attendance rules, uploads, the login rate limit, inactive people and exam results.

### Seeded logins (after running the seed script)

| Role              | Email                            | Password     |
| ----------------- | -------------------------------- | ------------ |
| Admin             | `admin@school.local`             | `admin123`   |
| Teacher (several) | e.g. `daisy.parks@school.local`  | `teacher123` |
| Student (a few)   | e.g. `aaliyah.wong@school.local` | `student123` |

The seed script prints the full list of generated logins to the console when it runs.

There is intentionally **no self-registration** — accounts are provisioned by an admin from the Students/Teachers pages (a **Portal login** card on each details page creates or resets the login). This avoids unauthenticated users being able to register themselves as admin.

## Roles & Permissions

Role is stored on the `User` record and checked by `requireRole` middleware (`src/middleware/auth.js`) on every route group.

- **Admin** — full access: manage students, teachers, departments, subjects, fees, fee collection, expenses, salaries, exams, library, hostel, transport, sports, holidays, events, timetable, and the attendance report. Sees a dashboard with school-wide KPIs and charts, plus a header search box (students/teachers) and real notifications.
- **Teacher** — sees their own dashboard (classes this week, students taught, subjects taught, teaching hours, upcoming lessons, semester progress), marks daily attendance for their homeroom class, and edits their own profile.
- **Student** — sees their own dashboard (subjects, fees paid, exam results/pass rate, attendance %, upcoming lessons), views their own attendance history and exam results, and edits their own profile.

## Data Model

The schema (`prisma/schema.prisma`) is fully relational — there are no free-text "class"/"section"/"subject" string fields doing the job of a foreign key. Key entities:

- **User** — login identity (email/password hash/role), optionally linked 1:1 to a `Student` or `Teacher` record.
- **Class** — the class+section unit (e.g. "10 - A"), referenced by FK from Student, Teacher (homeroom), Exam, TimeTableEntry, Attendance, Fee, and Book — this is what replaced the old string-matching approach.
- **Student** / **Teacher** — core people records; a Teacher has one homeroom `Class` and any number of subjects taught via `TeacherSubject`.
- **TeacherSubject** — join table expressing "this teacher teaches this subject for this class" (many-to-many).
- **Subject** — a pure catalog of subject names (no class scoping — which classes a subject applies to is expressed via `TeacherSubject`/`Exam`).
- **Attendance** — one row per student per day (`@@unique([studentId, date])`), tied to the class and the teacher who marked it.
- **Exam** / **ExamResult** — exams per class/subject, with per-student results (marks, pass/fail).
- **TimeTableEntry** — a scheduled lesson (teacher, class, subject, date/time).
- **FeesCollection** / **Fee** — money actually collected from students vs. the fee schedule/types configured by class.
- Supporting entities: **Department, Book (library), HostelRoom, Transport, Sport, Holiday, Event, Salary, Expense.**

## Application Structure

```
src/
  app.js                 # Express app setup: middleware, route mounting, error handling
  server.js              # HTTP server bootstrap
  routes/                # One router per resource, thin — just maps HTTP verbs to controller fns
  controllers/           # All business logic + Prisma queries live here
  middleware/
    auth.js              # requireAuth / requireRole
    csrf.js              # session-bound CSRF token issue + verification
    notifications.js     # per-role "recent activity" for the header bell
  utils/
    asyncHandler.js       # wraps every controller so async errors reach Express's error handler
    academicOptions.js    # shared Class/Subject dropdown data for forms
    calendar.js            # calendar widget data (holidays/events)
  views/                 # EJS templates, one folder per resource + partials/
prisma/
  schema.prisma          # data model
  seed.js                # sample data generator (idempotent — safe to re-run)
  migrations/            # versioned migration history
public/                  # static assets: css, js, images, vendor libraries, uploaded photos
```

**Routing note:** Express treats a router mounted at `/` as a prefix match for _every_ path, so role-scoped routes (`/teacher/dashboard`, `/student/dashboard`, `/search`, etc.) are registered in `app.js` **before** the admin catch-all `/` mount — otherwise the admin-only middleware would shadow them.

## Notable Features

- **Async error handling** — every controller export is wrapped by `wrapController()` so a rejected promise in a route handler is passed to Express's error handler instead of crashing the process; a generic branded 500 page is rendered.
- **Persistent sessions** — sessions are stored on disk (`session-file-store`, in `.sessions/`) rather than in memory, so logins survive a server restart.
- **Password reset** — a real token-based flow (`crypto`-generated token, sha256 hash stored, 1-hour expiry, single-use, no account-enumeration on unknown emails). There is no email provider configured, so in development (`NODE_ENV` not `production`) the link is shown on the confirmation page. **In production it is never shown** (that would let anyone reset any account); it is written to the server log for the administrator to pass on, until real email delivery is added. A successful reset also signs that user out everywhere.
- **Safe uploads** — profile photos are checked by their actual bytes (JPEG, PNG or WebP only, 2 MB max), saved under a random file name with an extension chosen by the server, so an uploaded script can never be served as a page.
- **Sessions** — the session id changes at login, cookies are `HttpOnly` and `SameSite=Lax` (and `Secure` in production), and the app will not start in production without a real `SESSION_SECRET`. Login takes the same time for an unknown email as for a wrong password.
- **CSRF protection** — every POST form carries a session-bound `_csrf` token, checked by custom middleware (not the deprecated `csurf` package). File-upload (multipart) routes verify the token _after_ `multer` parses the body, since the request is still multipart at that point.
- **Security headers** — `helmet` is enabled with CSP explicitly disabled (the UI relies on inline `<script>`/`<style>` blocks throughout for charts, the theme toggle, etc.); the other headers (HSTS, X-Frame-Options, nosniff) are on.
- **Login rate limiting** — 10 attempts / 15 minutes per IP via `express-rate-limit`, applied to both correct and incorrect attempts (not just failures) to actually stop brute-forcing.
- **Exam results entry** — admins (any exam) and teachers (only exams for a subject and class they are assigned to) enter marks on a sheet per exam. Each exam has a maximum mark and a pass mark (default 100 and 40%); pass or fail is worked out from those, not typed in. Invalid marks save nothing and name the student; an empty box means no result (absent). Changing the pass mark re-grades entered results; the maximum cannot change once results exist, and an exam with results cannot be deleted.
- **Fee balances** — each fee on the schedule (Fees page) applies to everyone or to one class level. A payment must be for a fee that applies to that student, be more than zero with at most two decimals, not be dated in the future, and not exceed what is still owed for that fee type (part-payments are fine). Each student has a statement (due / paid / outstanding) on their details page and dashboard, and admins get an **Outstanding Fees** report. A fee that has payments cannot be deleted.
- **Audit log** — every create, change and delete of a fee payment, expense or salary is recorded with who did it and what changed (updates store only the fields that changed; deletes keep the full record). Admins read it under **Audit Log**. Amounts on these forms must be positive with at most two decimals, and an inactive teacher cannot be paid.
- **Timetable rules** — a lesson needs an active teacher, a real date, 24-hour times with the end after the start, and a class and subject. It is refused on a holiday, when the teacher is not assigned to teach that subject to that class level, or when the teacher or the class already has an overlapping lesson (back-to-back lessons are fine).
- **Data rules for people** — names (letters only), IDs, gender, dates of birth (students 2-60, teachers 18-80) and joining dates (never in the future), phone numbers (7-15 digits) and emails are checked, with every problem named. Each class has a **capacity** (default 40, changed on the Classes page); a student cannot be added or moved into a full class (inactive students do not use a place). A photo uploaded with a refused form is deleted again.
- **Admin sets logins** — on a student or teacher details page an admin can create a portal login or reset the password (there is no email delivery, so this is how a forgotten password is fixed). Resetting signs the person out everywhere. Passwords need 8-72 characters, no leading or trailing space, and cannot equal the email; changing your own password signs your other browsers out.
- **Library lending** — issue a book to an active student at **Library > Issue a Book** and return it from **Book Loans**. A book can only be out once; each student has a limit of books out (3), cannot borrow while one is overdue, and loans last 14 days. Late returns are fined per day. A book on loan cannot be marked In Stock, and a book with lending history cannot be deleted. All three numbers are settings (`LIBRARY_LOAN_DAYS`, `LIBRARY_MAX_LOANS`, `LIBRARY_FINE_PER_DAY`).
- **One-time messages** — notices such as "Capacity saved" are stored in the session and shown once, never read from the address bar, so a crafted link cannot show a misleading message.
- **Inactive instead of deleted** — removing a student or teacher who has attendance, results, payments or salaries marks them inactive (login blocked, hidden from active lists and sheets, records kept) and they can be reactivated; someone with no history is deleted completely. Lists have Active / Inactive / All tabs.
- **Attendance days** — attendance cannot be marked for a future day, on a weekend day (`WEEKEND_DAYS`, default Saturday and Sunday), on a holiday from the Holiday list, or more than `ATTENDANCE_EDIT_DAYS` (default 14) days back. A closed day shows why instead of the form.
- **Attendance tracking** — teachers mark daily Present/Absent/Late per student in their homeroom; admins get a filterable report; students see their own history and an attendance-percentage KPI on their dashboard.
- **Dark mode** — a manual, persisted toggle (cookie-based) in the header; the theme class is applied to `<html>` via a blocking inline script in `<head>` to avoid a flash of the wrong theme on load.
- **DataTables / Select2 / datepicker / input masking** — wired up on list pages and forms (search, sort, pagination on tables; searchable dropdowns for class/subject/etc.; a real date picker instead of raw `<input type="date">`; masked phone number inputs).
- **Header search** (admin-only) — looks up students and teachers by name/ID.
- **Real notifications** — the header bell shows actual recent activity per role (recent fee payments for admin, upcoming lessons for teachers, graded exam results for students) instead of a static placeholder.

## Known Limitations / Not Implemented

- No messaging/inbox feature.
- No real email delivery (password reset links are shown on-page instead — see above).
- SQLite is used for development; there's no configured production datastore (e.g. Postgres) or deployment pipeline.
- The automated tests cover security and access rules (`npm test`); the page-by-page CRUD screens are verified by hand.
- Logging out is also possible with a plain link (`GET /logout`), so another site can sign a user out. Harmless, but a POST-only logout button would be tidier.
