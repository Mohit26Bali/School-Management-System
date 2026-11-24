// Rules for the details typed in when adding or editing a student or teacher. Pure functions, so they can be tested directly.
// Each returns a list of plain-language problems (empty = fine).

const NAME = /^[\p{L}][\p{L} .'-]*$/u;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function text(v) {
  return typeof v === "string" ? v.trim() : "";
}

function dayOrNull(v) {
  const t = text(v);
  if (!DAY.test(t)) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : d;
}

function ageOn(dob, now) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const before = now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  return before ? age - 1 : age;
}

function checkName(problems, value, label, min = 1) {
  const t = text(value);
  if (t.length < min) problems.push(`${label} is required.`);
  else if (t.length > 60) problems.push(`${label} is too long (60 characters at most).`);
  else if (!NAME.test(t)) problems.push(`${label} can only contain letters, spaces, apostrophes, dots and hyphens.`);
}

function checkCode(problems, value, label) {
  const t = text(value);
  if (!t) problems.push(`${label} is required.`);
  else if (t.length > 20 || !CODE.test(t)) problems.push(`${label} can only contain letters, numbers, dots, dashes and underscores (20 characters at most).`);
}

function checkPhone(problems, value, label) {
  const t = text(value);
  if (!t) return;
  const digits = t.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(t) || digits.length < 7 || digits.length > 15) problems.push(`${label} must be a phone number with 7 to 15 digits.`);
}

function checkEmail(problems, value, label) {
  const t = text(value);
  if (t && (t.length > 100 || !EMAIL.test(t))) problems.push(`${label} is not a valid email address.`);
}

function checkDay(problems, value, label, { now, notFuture = true, minAge, maxAge } = {}) {
  const t = text(value);
  if (!t) return;
  const d = dayOrNull(t);
  if (!d) return problems.push(`${label} is not a valid date.`);
  if (notFuture && d.getTime() > now.getTime()) return problems.push(`${label} cannot be in the future.`);
  if (minAge !== undefined || maxAge !== undefined) {
    const age = ageOn(d, now);
    if (minAge !== undefined && age < minAge) problems.push(`${label} makes the age ${age}, which is below the minimum of ${minAge}.`);
    if (maxAge !== undefined && age > maxAge) problems.push(`${label} makes the age ${age}, which is above the maximum of ${maxAge}.`);
  }
}

function checkLength(problems, value, label, max) {
  if (text(value).length > max) problems.push(`${label} is too long (${max} characters at most).`);
}

const GENDERS = ["Female", "Male", "Others"];

function studentProblems(body, now = new Date()) {
  const p = [];
  checkName(p, body.firstName, "First name");
  checkName(p, body.lastName, "Last name");
  checkCode(p, body.studentId, "Student ID");
  if (!text(body.classId)) p.push("Choose a class.");
  if (text(body.gender) && !GENDERS.includes(text(body.gender))) p.push("Choose a gender from the list.");
  checkDay(p, body.dob, "Date of birth", { now, minAge: 2, maxAge: 60 });
  checkDay(p, body.joiningDate, "Joining date", { now });
  checkPhone(p, body.mobile, "Mobile number");
  checkPhone(p, body.fatherMobile, "Father's mobile");
  checkPhone(p, body.motherMobile, "Mother's mobile");
  checkEmail(p, body.fatherEmail, "Father's email");
  checkEmail(p, body.motherEmail, "Mother's email");
  for (const [field, label] of [["fatherName", "Father's name"], ["motherName", "Mother's name"]]) {
    if (text(body[field])) checkName(p, body[field], label);
  }
  for (const [field, label] of [["presentAddress", "Present address"], ["permanentAddress", "Permanent address"]]) checkLength(p, body[field], label, 300);
  for (const [field, label] of [["religion", "Religion"], ["admissionNumber", "Admission number"], ["fatherOccupation", "Father's occupation"], ["motherOccupation", "Mother's occupation"]]) {
    checkLength(p, body[field], label, 100);
  }
  return p;
}

function teacherProblems(body, now = new Date()) {
  const p = [];
  checkName(p, body.name, "Name", 2);
  checkCode(p, body.teacherId, "Teacher ID");
  if (text(body.gender) && !GENDERS.includes(text(body.gender))) p.push("Choose a gender from the list.");
  checkDay(p, body.dob, "Date of birth", { now, minAge: 18, maxAge: 80 });
  checkDay(p, body.joiningDate, "Joining date", { now });
  checkPhone(p, body.mobile, "Mobile number");
  checkEmail(p, body.email, "Login email");
  for (const [field, label] of [["qualification", "Qualification"], ["experience", "Experience"], ["city", "City"], ["state", "State"], ["country", "Country"]]) {
    checkLength(p, body[field], label, 100);
  }
  checkLength(p, body.address, "Address", 300);
  checkLength(p, body.zipCode, "Zip code", 20);
  return p;
}

module.exports = { studentProblems, teacherProblems, ageOn };
