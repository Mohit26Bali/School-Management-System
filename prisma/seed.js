const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const CLASS_NAMES = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const SECTIONS = ["A", "B", "C"];

function daysFromNow(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

function monthsAgo(n, day = 15) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return d;
}

const sampleStudents = [
  { studentId: "PRE2209", firstName: "Aaliyah", lastName: "Wong", class: "10", section: "A", dob: "2002-02-02", fatherName: "Jeffrey Wong", mobile: "097 3584 5870", presentAddress: "911 Deer Ridge Drive, USA", login: { email: "aaliyah.wong@school.local", password: "student123" } },
  { studentId: "PRE2213", firstName: "Malynne", lastName: "Fields", class: "8", section: "A", dob: "2010-06-03", fatherName: "Fields Malynne", mobile: "242 362 3100", presentAddress: "Bacardi Rd P.O. Box N-4880, New Providence" },
  { studentId: "PRE2143", firstName: "Levell", lastName: "Scott", class: "10", section: "A", dob: "2002-04-12", fatherName: "Jeffrey Scott", mobile: "026 7318 4366", presentAddress: "P.O. Box: 41, Gaborone", login: { email: "levell.scott@school.local", password: "student123" } },
  { studentId: "PRE2431", firstName: "Minnie", lastName: "Shaffer", class: "11", section: "C", dob: "2000-02-24", fatherName: "J Shaffer", mobile: "952 512 4909", presentAddress: "4771 Oral Lake Road, Golden Valley" },
  { studentId: "PRE1534", firstName: "Lois", lastName: "A", class: "10", section: "A", dob: "2006-07-22", fatherName: "Cleary Wong", mobile: "413 289 1314", presentAddress: "2844 Leverton Cove Road, Palmer" },
  { studentId: "PRE1622", firstName: "Calvin", lastName: "Reed", class: "9", section: "B", dob: "2011-03-14", fatherName: "Marcus Reed", mobile: "701 753 3810", presentAddress: "1900 Hidden Meadow Drive, Crete" },
  { studentId: "PRE1789", firstName: "Joe", lastName: "Kelley", class: "11", section: "C", dob: "2000-10-07", fatherName: "Vincent Howard", mobile: "402 221 7523", presentAddress: "3979 Ashwood Drive, Omaha" },
  { studentId: "PRE1845", firstName: "Vincent", lastName: "Howard", class: "10", section: "A", dob: "2002-01-04", fatherName: "Kelley Joe", mobile: "402 221 7523", presentAddress: "3979 Ashwood Drive, Omaha" },
  { studentId: "PRE1902", firstName: "Kozma", lastName: "Tatari", class: "9", section: "B", dob: "2006-02-01", fatherName: "Lombardi", mobile: "04 2239 968", presentAddress: "Rruga E Kavajes, Tirana" },
  { studentId: "PRE1967", firstName: "John", lastName: "Chambers", class: "11", section: "C", dob: "2003-09-13", fatherName: "Wong Jeffrey", mobile: "870 663 2334", presentAddress: "4667 Sunset Drive, Pine Bluff" },
  { studentId: "PRE2044", firstName: "Nathan", lastName: "Humphries", class: "10", section: "A", dob: "1994-04-26", fatherName: "Stephen Marley", mobile: "077 3499 9959", presentAddress: "86 Lamphey Road, Thelnetham" },
  { studentId: "PRE2098", firstName: "Zoe", lastName: "Martins", class: "8", section: "A", dob: "2011-05-19", fatherName: "Paulo Martins", mobile: "312 555 0199", presentAddress: "27 Willow Creek Rd, Denver" },
];

const sampleTeachers = [
  { teacherId: "TCH1001", name: "Daisy Parks", gender: "Female", dob: "1995-04-22", mobile: "+91 89657 48512", qualification: "M.Sc Computer Science", experience: "6 years", class: "10", section: "A", subject: "Computer Science", city: "Springfield", country: "USA", login: { email: "daisy.parks@school.local", password: "teacher123" } },
  { teacherId: "TCH1002", name: "Marcus Cole", gender: "Male", dob: "1988-11-09", mobile: "+91 90124 33210", qualification: "M.A English", experience: "10 years", class: "9", section: "B", subject: "English", city: "Riverside", country: "USA", login: { email: "marcus.cole@school.local", password: "teacher123" } },
  { teacherId: "TCH1003", name: "Elena Ruiz", gender: "Female", dob: "1990-06-17", mobile: "+1 312 555 0142", qualification: "M.Sc Mathematics", experience: "8 years", class: "10", section: "A", subject: "Mathematics", city: "Chicago", country: "USA", login: { email: "elena.ruiz@school.local", password: "teacher123" } },
  { teacherId: "TCH1004", name: "Samuel Okafor", gender: "Male", dob: "1985-01-30", mobile: "+1 214 555 0177", qualification: "M.Sc Physics", experience: "12 years", class: "11", section: "C", subject: "Physics", city: "Dallas", country: "USA", login: { email: "samuel.okafor@school.local", password: "teacher123" } },
  { teacherId: "TCH1005", name: "Priya Nair", gender: "Female", dob: "1992-08-25", mobile: "+1 617 555 0110", qualification: "M.Sc Biology", experience: "5 years", class: "9", section: "B", subject: "Biology", city: "Boston", country: "USA", login: { email: "priya.nair@school.local", password: "teacher123" } },
];

const sampleDepartments = [
  { departmentId: "DEP1001", name: "Computer Science", headOfDepartment: "Daisy Parks", startDate: "2015-06-01" },
  { departmentId: "DEP1002", name: "English", headOfDepartment: "Marcus Cole", startDate: "2012-01-15" },
  { departmentId: "DEP1003", name: "Sciences", headOfDepartment: "Samuel Okafor", startDate: "2014-08-01" },
];

const sampleSubjects = [
  { subjectId: "SUB1001", name: "Computer Science" },
  { subjectId: "SUB1002", name: "English" },
  { subjectId: "SUB1003", name: "Mathematics" },
  { subjectId: "SUB1004", name: "Physics" },
  { subjectId: "SUB1005", name: "Biology" },
  { subjectId: "SUB1006", name: "History" },
];

const sampleFees = [
  { feesId: "FEE1001", feesType: "Exam Fees", class: "10", amount: 150, startDate: "2026-01-01", endDate: "2026-01-31" },
  { feesId: "FEE1002", feesType: "Transport Fees", class: "9", amount: 80, startDate: "2026-01-01", endDate: "2026-01-31" },
  { feesId: "FEE1003", feesType: "Hostel Fees", class: "11", amount: 200, startDate: "2026-01-01", endDate: "2026-01-31" },
];

const sampleExpenses = [
  { expensesId: "EXP1001", itemName: "Whiteboard Markers", itemQuality: "Good", amount: 25.5, sourceOfPurchase: "Office Depot", purchaseBy: "Ryan Taylor", monthsAgoOffset: 5 },
  { expensesId: "EXP1002", itemName: "Projector Bulb", itemQuality: "Excellent", amount: 120, sourceOfPurchase: "TechSupply Co", purchaseBy: "Ryan Taylor", monthsAgoOffset: 5 },
  { expensesId: "EXP1003", itemName: "Lab Chemicals", itemQuality: "Good", amount: 340, sourceOfPurchase: "SciSupply", purchaseBy: "Ryan Taylor", monthsAgoOffset: 4 },
  { expensesId: "EXP1004", itemName: "Sports Equipment", itemQuality: "Good", amount: 210, sourceOfPurchase: "SportsWorld", purchaseBy: "Ryan Taylor", monthsAgoOffset: 3 },
  { expensesId: "EXP1005", itemName: "Library Books", itemQuality: "Excellent", amount: 480, sourceOfPurchase: "BookHouse", purchaseBy: "Ryan Taylor", monthsAgoOffset: 3 },
  { expensesId: "EXP1006", itemName: "Printer Ink", itemQuality: "Good", amount: 60, sourceOfPurchase: "Office Depot", purchaseBy: "Ryan Taylor", monthsAgoOffset: 2 },
  { expensesId: "EXP1007", itemName: "Bus Maintenance", itemQuality: "Good", amount: 560, sourceOfPurchase: "AutoCare", purchaseBy: "Ryan Taylor", monthsAgoOffset: 1 },
  { expensesId: "EXP1008", itemName: "Computer Repairs", itemQuality: "Good", amount: 175, sourceOfPurchase: "TechSupply Co", purchaseBy: "Ryan Taylor", monthsAgoOffset: 1 },
  { expensesId: "EXP1009", itemName: "Cleaning Supplies", itemQuality: "Good", amount: 90, sourceOfPurchase: "Office Depot", purchaseBy: "Ryan Taylor", monthsAgoOffset: 0 },
];

const sampleExams = [
  { examName: "Mid Term Exam", class: "10", subject: "Computer Science", fees: 50, startTime: "09:00", endTime: "11:00", monthsAgoOffset: 4 },
  { examName: "Final Exam", class: "9", subject: "English", fees: 75, startTime: "10:00", endTime: "12:30", monthsAgoOffset: 2 },
  { examName: "Unit Test 3", class: "10", subject: "Mathematics", fees: 30, startTime: "09:00", endTime: "10:30", monthsAgoOffset: 1 },
];

const sampleExamResults = [
  { examName: "Mid Term Exam", studentId: "PRE2209", marksObtained: 88, maxMarks: 100 },
  { examName: "Mid Term Exam", studentId: "PRE2143", marksObtained: 32, maxMarks: 100 },
  { examName: "Mid Term Exam", studentId: "PRE1534", marksObtained: 72, maxMarks: 100 },
  { examName: "Mid Term Exam", studentId: "PRE1845", marksObtained: 91, maxMarks: 100 },
  { examName: "Mid Term Exam", studentId: "PRE2044", marksObtained: 38, maxMarks: 100 },
  { examName: "Final Exam", studentId: "PRE1622", marksObtained: 76, maxMarks: 100 },
  { examName: "Final Exam", studentId: "PRE1902", marksObtained: 82, maxMarks: 100 },
  { examName: "Unit Test 3", studentId: "PRE2209", marksObtained: 27, maxMarks: 30 },
  { examName: "Unit Test 3", studentId: "PRE2143", marksObtained: 18, maxMarks: 30 },
  { examName: "Unit Test 3", studentId: "PRE1534", marksObtained: 22, maxMarks: 30 },
];

const sampleBooks = [
  { bookId: "BK1001", name: "Introduction to Algorithms", language: "English", department: "Computer Science", class: "10", type: "Book", status: "In Stock" },
  { bookId: "BK1002", name: "A Tale of Two Cities", language: "English", department: "English", class: "9", type: "Book", status: "Out of Stock" },
  { bookId: "BK1003", name: "Concepts of Physics", language: "English", department: "Sciences", class: "11", type: "Book", status: "In Stock" },
  { bookId: "BK1004", name: "World History Atlas", language: "English", department: "Sciences", class: "8", type: "Book", status: "In Stock" },
];

const sampleHostelRooms = [
  { block: "A", roomNo: "101", roomType: "Normal", noOfBeds: 4, costPerBed: 60, availability: "Available" },
  { block: "A", roomNo: "102", roomType: "AC", noOfBeds: 2, costPerBed: 100, availability: "Not Available" },
  { block: "B", roomNo: "201", roomType: "Suite", noOfBeds: 1, costPerBed: 150, availability: "Available" },
];

const sampleTransport = [
  { routeName: "North Route", vehicleNumber: "SCH-1001", driverName: "Tom Walsh", licenseNumber: "DL-58201", contactNumber: "555-0101", driverAddress: "12 Maple St" },
  { routeName: "South Route", vehicleNumber: "SCH-1002", driverName: "Lena Ford", licenseNumber: "DL-58202", contactNumber: "555-0102", driverAddress: "8 Oak Ave" },
  { routeName: "East Route", vehicleNumber: "SCH-1003", driverName: "Diego Ruiz", licenseNumber: "DL-58203", contactNumber: "555-0103", driverAddress: "44 Birchwood Ln" },
];

const sampleSports = [
  { sportsId: "SPT1001", name: "Basketball", coachName: "Marcus Cole", startedYear: "2018-01-01" },
  { sportsId: "SPT1002", name: "Swimming", coachName: "Daisy Parks", startedYear: "2020-01-01" },
];

const sampleHolidays = [
  { holidayId: "HOL1001", name: "Winter Break", type: "Public Holiday", startDate: "2026-12-20", endDate: "2027-01-02" },
  { holidayId: "HOL1002", name: "Founders Day", type: "College Holiday", startDate: "2026-09-05", endDate: "2026-09-05" },
  { holidayId: "HOL1003", name: "Summer Break", type: "Public Holiday", startDate: "2026-07-20", endDate: "2026-08-15" },
];

const sampleEvents = [
  { eventId: "EVT1001", name: "Annual Sports Day", eventDate: "2026-11-15" },
  { eventId: "EVT1002", name: "Science Fair", eventDate: "2026-10-01" },
  { eventId: "EVT1003", name: "Parent-Teacher Meeting", eventDate: "2026-07-18" },
];

const sampleFeesCollections = [
  { studentId: "PRE2209", feesType: "Exam Fees", amount: 150, monthsAgoOffset: 5 },
  { studentId: "PRE2213", feesType: "Transport Fees", amount: 80, monthsAgoOffset: 5 },
  { studentId: "PRE2143", feesType: "Exam Fees", amount: 150, monthsAgoOffset: 4 },
  { studentId: "PRE2431", feesType: "Hostel Fees", amount: 200, monthsAgoOffset: 4 },
  { studentId: "PRE1534", feesType: "Exam Fees", amount: 150, monthsAgoOffset: 3 },
  { studentId: "PRE1622", feesType: "Transport Fees", amount: 80, monthsAgoOffset: 3 },
  { studentId: "PRE1789", feesType: "Hostel Fees", amount: 200, monthsAgoOffset: 2 },
  { studentId: "PRE1845", feesType: "Exam Fees", amount: 150, monthsAgoOffset: 2 },
  { studentId: "PRE1902", feesType: "Transport Fees", amount: 80, monthsAgoOffset: 1 },
  { studentId: "PRE1967", feesType: "Exam Fees", amount: 150, monthsAgoOffset: 1 },
  { studentId: "PRE2044", feesType: "Hostel Fees", amount: 200, monthsAgoOffset: 0 },
  { studentId: "PRE2098", feesType: "Exam Fees", amount: 150, monthsAgoOffset: 0 },
  { studentId: "PRE2209", feesType: "Exam Fees", amount: 150, monthsAgoOffset: 0 },
  { studentId: "PRE2143", feesType: "Transport Fees", amount: 80, monthsAgoOffset: 0 },
];

const sampleSalaries = [
  { teacherId: "TCH1001", amount: 3200, monthsAgoOffset: 1 },
  { teacherId: "TCH1002", amount: 2900, monthsAgoOffset: 1 },
  { teacherId: "TCH1003", amount: 3400, monthsAgoOffset: 0 },
  { teacherId: "TCH1004", amount: 3600, monthsAgoOffset: 0 },
  { teacherId: "TCH1005", amount: 3000, monthsAgoOffset: 0 },
];

const sampleTimeTable = [
  { teacherId: "TCH1001", class: "10", section: "A", subject: "Computer Science", dayOffset: -7, startTime: "09:00", endTime: "10:00" },
  { teacherId: "TCH1001", class: "10", section: "A", subject: "Computer Science", dayOffset: -3, startTime: "09:00", endTime: "10:00" },
  { teacherId: "TCH1001", class: "10", section: "A", subject: "Computer Science", dayOffset: 1, startTime: "09:00", endTime: "10:00" },
  { teacherId: "TCH1001", class: "10", section: "A", subject: "Computer Science", dayOffset: 5, startTime: "09:00", endTime: "10:00" },
  { teacherId: "TCH1002", class: "9", section: "B", subject: "English", dayOffset: -5, startTime: "10:00", endTime: "11:00" },
  { teacherId: "TCH1002", class: "9", section: "B", subject: "English", dayOffset: 2, startTime: "10:00", endTime: "11:00" },
  { teacherId: "TCH1002", class: "9", section: "B", subject: "English", dayOffset: 6, startTime: "10:00", endTime: "11:00" },
  { teacherId: "TCH1003", class: "10", section: "A", subject: "Mathematics", dayOffset: -2, startTime: "11:00", endTime: "12:00" },
  { teacherId: "TCH1003", class: "10", section: "A", subject: "Mathematics", dayOffset: 0, startTime: "11:00", endTime: "12:00" },
  { teacherId: "TCH1003", class: "10", section: "A", subject: "Mathematics", dayOffset: 4, startTime: "11:00", endTime: "12:00" },
  { teacherId: "TCH1004", class: "11", section: "C", subject: "Physics", dayOffset: -4, startTime: "13:00", endTime: "14:30" },
  { teacherId: "TCH1004", class: "11", section: "C", subject: "Physics", dayOffset: 3, startTime: "13:00", endTime: "14:30" },
  { teacherId: "TCH1005", class: "9", section: "B", subject: "Biology", dayOffset: -6, startTime: "14:00", endTime: "15:00" },
  { teacherId: "TCH1005", class: "9", section: "B", subject: "Biology", dayOffset: 2, startTime: "14:00", endTime: "15:00" },
  { teacherId: "TCH1005", class: "9", section: "B", subject: "Biology", dayOffset: 7, startTime: "14:00", endTime: "15:00" },
];

async function createLogin({ name, email, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { name, email, passwordHash, role } });
}

const classByKey = new Map();
function classKey(name, section) {
  return `${name}::${section}`;
}

async function seedClasses() {
  for (const name of CLASS_NAMES) {
    for (const section of SECTIONS) {
      const cls = await prisma.class.upsert({
        where: { name_section: { name, section } },
        update: {},
        create: { name, section },
      });
      classByKey.set(classKey(name, section), cls);
    }
  }
}

function resolveClassId(name, section) {
  const exact = classByKey.get(classKey(name, section));
  if (exact) return exact.id;
  const representative = classByKey.get(classKey(name, "A"));
  return representative ? representative.id : null;
}

function representativeClassId(name) {
  const representative = classByKey.get(classKey(name, "A"));
  return representative ? representative.id : null;
}

async function main() {
  await createLogin({ name: "Ryan Taylor", email: "admin@school.local", password: "admin123", role: "admin" });

  await seedClasses();

  for (const s of sampleStudents) {
    let userId;
    if (s.login) {
      const user = await createLogin({ name: `${s.firstName} ${s.lastName}`, email: s.login.email, password: s.login.password, role: "student" });
      userId = user.id;
    }
    const { login, class: className, section, ...data } = s;
    await prisma.student.upsert({
      where: { studentId: s.studentId },
      update: {},
      create: { ...data, dob: s.dob ? new Date(s.dob) : null, classId: resolveClassId(className, section), userId },
    });
  }

  for (const sub of sampleSubjects) {
    await prisma.subject.upsert({ where: { subjectId: sub.subjectId }, update: {}, create: sub });
  }
  const subjectByName = new Map((await prisma.subject.findMany()).map((s) => [s.name, s]));

  for (const t of sampleTeachers) {
    let userId;
    if (t.login) {
      const user = await createLogin({ name: t.name, email: t.login.email, password: t.login.password, role: "teacher" });
      userId = user.id;
    }
    const { login, class: className, section, subject, ...data } = t;
    const classId = resolveClassId(className, section);
    const teacher = await prisma.teacher.upsert({
      where: { teacherId: t.teacherId },
      update: {},
      create: { ...data, dob: t.dob ? new Date(t.dob) : null, classId, userId },
    });

    const subjectRow = subjectByName.get(subject);
    if (subjectRow && classId) {
      await prisma.teacherSubject.upsert({
        where: { teacherId_classId_subjectId: { teacherId: teacher.id, classId, subjectId: subjectRow.id } },
        update: {},
        create: { teacherId: teacher.id, classId, subjectId: subjectRow.id },
      });
    }
  }

  for (const d of sampleDepartments) {
    await prisma.department.upsert({
      where: { departmentId: d.departmentId },
      update: {},
      create: { ...d, startDate: d.startDate ? new Date(d.startDate) : null },
    });
  }

  for (const f of sampleFees) {
    const { class: className, ...data } = f;
    await prisma.fee.upsert({
      where: { feesId: f.feesId },
      update: {},
      create: { ...data, classId: representativeClassId(className), startDate: f.startDate ? new Date(f.startDate) : null, endDate: f.endDate ? new Date(f.endDate) : null },
    });
  }

  for (const e of sampleExpenses) {
    const purchaseDate = monthsAgo(e.monthsAgoOffset);
    const existing = await prisma.expense.findUnique({ where: { expensesId: e.expensesId } });
    if (!existing) {
      await prisma.expense.create({
        data: {
          expensesId: e.expensesId,
          itemName: e.itemName,
          itemQuality: e.itemQuality,
          amount: e.amount,
          sourceOfPurchase: e.sourceOfPurchase,
          purchaseBy: e.purchaseBy,
          purchaseDate,
        },
      });
    }
  }

  for (const b of sampleBooks) {
    const { class: className, ...data } = b;
    await prisma.book.upsert({ where: { bookId: b.bookId }, update: {}, create: { ...data, classId: representativeClassId(className) } });
  }

  for (const r of sampleHostelRooms) {
    await prisma.hostelRoom.upsert({
      where: { block_roomNo: { block: r.block, roomNo: r.roomNo } },
      update: {},
      create: r,
    });
  }

  for (const t of sampleTransport) {
    await prisma.transport.upsert({ where: { vehicleNumber: t.vehicleNumber }, update: {}, create: t });
  }

  for (const s of sampleSports) {
    await prisma.sport.upsert({
      where: { sportsId: s.sportsId },
      update: {},
      create: { ...s, startedYear: s.startedYear ? new Date(s.startedYear) : null },
    });
  }

  for (const h of sampleHolidays) {
    await prisma.holiday.upsert({
      where: { holidayId: h.holidayId },
      update: {},
      create: { ...h, startDate: h.startDate ? new Date(h.startDate) : null, endDate: h.endDate ? new Date(h.endDate) : null },
    });
  }

  for (const ev of sampleEvents) {
    await prisma.event.upsert({
      where: { eventId: ev.eventId },
      update: {},
      create: { ...ev, eventDate: ev.eventDate ? new Date(ev.eventDate) : null },
    });
  }

  const examIdByName = {};
  for (const ex of sampleExams) {
    const examDate = monthsAgo(ex.monthsAgoOffset);
    const classId = representativeClassId(ex.class);
    const subjectRow = subjectByName.get(ex.subject);
    let exam = await prisma.exam.findFirst({ where: { examName: ex.examName, classId } });
    if (!exam) {
      exam = await prisma.exam.create({
        data: {
          examName: ex.examName,
          classId,
          subjectId: subjectRow ? subjectRow.id : null,
          fees: ex.fees,
          startTime: ex.startTime,
          endTime: ex.endTime,
          examDate,
        },
      });
    }
    examIdByName[ex.examName] = exam.id;
  }

  for (const r of sampleExamResults) {
    const examId = examIdByName[r.examName];
    const student = await prisma.student.findUnique({ where: { studentId: r.studentId } });
    if (!examId || !student) continue;
    const existing = await prisma.examResult.findFirst({ where: { examId, studentId: student.id } });
    if (!existing) {
      await prisma.examResult.create({
        data: {
          examId,
          studentId: student.id,
          marksObtained: r.marksObtained,
          maxMarks: r.maxMarks,
          passed: r.marksObtained / r.maxMarks >= 0.4,
        },
      });
    }
  }

  for (const fc of sampleFeesCollections) {
    const student = await prisma.student.findUnique({ where: { studentId: fc.studentId } });
    if (!student) continue;
    const paidDate = monthsAgo(fc.monthsAgoOffset);
    const existing = await prisma.feesCollection.findFirst({
      where: { studentId: student.id, feesType: fc.feesType, paidDate },
    });
    if (!existing) {
      await prisma.feesCollection.create({
        data: { feesType: fc.feesType, amount: fc.amount, paidDate, studentId: student.id },
      });
    }
  }

  for (const sal of sampleSalaries) {
    const teacher = await prisma.teacher.findUnique({ where: { teacherId: sal.teacherId } });
    if (!teacher) continue;
    const paymentDate = monthsAgo(sal.monthsAgoOffset);
    const existing = await prisma.salary.findFirst({ where: { teacherId: teacher.id, paymentDate } });
    if (!existing) {
      await prisma.salary.create({ data: { amount: sal.amount, paymentDate, teacherId: teacher.id } });
    }
  }

  for (const tt of sampleTimeTable) {
    const teacher = await prisma.teacher.findUnique({ where: { teacherId: tt.teacherId } });
    if (!teacher) continue;
    const date = daysFromNow(tt.dayOffset);
    const classId = resolveClassId(tt.class, tt.section);
    const subjectRow = subjectByName.get(tt.subject);
    const subjectId = subjectRow ? subjectRow.id : null;
    const existing = await prisma.timeTableEntry.findFirst({
      where: { teacherId: teacher.id, classId, subjectId, date },
    });
    if (!existing) {
      await prisma.timeTableEntry.create({
        data: {
          teacherId: teacher.id,
          classId,
          subjectId,
          date,
          startTime: tt.startTime,
          endTime: tt.endTime,
        },
      });
    }
  }

  const attendanceTeacher = await prisma.teacher.findUnique({ where: { teacherId: "TCH1001" } });
  const attendanceClassId = resolveClassId("10", "A");
  const attendanceStudents = await prisma.student.findMany({ where: { classId: attendanceClassId } });
  if (attendanceTeacher && attendanceStudents.length) {
    const statusCycle = ["Present", "Present", "Present", "Late", "Present", "Absent", "Present"];
    for (let dayOffset = -10; dayOffset <= -1; dayOffset++) {
      const date = daysFromNow(dayOffset);
      for (let i = 0; i < attendanceStudents.length; i++) {
        const student = attendanceStudents[i];
        const existing = await prisma.attendance.findUnique({
          where: { studentId_date: { studentId: student.id, date } },
        });
        if (!existing) {
          await prisma.attendance.create({
            data: {
              studentId: student.id,
              teacherId: attendanceTeacher.id,
              date,
              status: statusCycle[(dayOffset + i + 20) % statusCycle.length],
              classId: student.classId,
            },
          });
        }
      }
    }
  }

  console.log("Seed complete.");
  console.log("Admin login:   admin@school.local / admin123");
  console.log("Teacher logins:");
  for (const t of sampleTeachers) {
    if (t.login) console.log(`  ${t.name.padEnd(16)} ${t.login.email} / ${t.login.password}`);
  }
  console.log("Student logins:");
  for (const s of sampleStudents) {
    if (s.login) console.log(`  ${(s.firstName + " " + s.lastName).padEnd(16)} ${s.login.email} / ${s.login.password}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
