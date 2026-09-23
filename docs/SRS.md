SRS for "LittleSteps" – A Nursery School Management System (MERN Stack)

Role: Act as a senior software requirements engineer. Write a complete, professional Software Requirements Specification (SRS) following the IEEE 830 / ISO/IEC/IEEE 29148 structure for the system described below. Use clear numbered requirement IDs, formal "The system shall…" language, and include tables and diagram descriptions where noted.

1. Project Overview

LittleSteps is a web-based school management system for a small nursery school (Playgroup, Nursery, KG-1, KG-2). It replaces paper registers and verbal notices with a centralized platform where the school administration, teachers, and students (accessed by parents/guardians, since students are young children) can manage and view attendance, results, meetings, and notifications.

The system is built on the MERN stack: MongoDB (database), Express.js (REST API), React.js (frontend), and Node.js (runtime).

Goals:

Digitize attendance tracking with automatic absence notifications.
Give teachers full control over attendance and grading for their assigned classes.
Give students/guardians a clear view of attendance percentage, results, and meeting invitations.
Give the admin full control over users, classes, sections, subjects, and approvals.
Provide role-specific interactive dashboards for every user type.
2. User Roles

Admin has full system authority: creates and authorizes all accounts, manages academic structure, assigns teachers, and oversees everything.

Teacher manages attendance and results for the classes, sections, and subjects assigned to them, and can view their teaching schedule.

Student (Guardian-accessed) has a read-focused account for viewing attendance, absence alerts, results, meeting invitations, and notices. The account belongs to the student but is expected to be used by a parent or guardian.

No user can access the system until the admin has created or approved their account.

3. Functional Requirements
3.1 Authentication & Authorization
FR-AUTH-01: Users log in with email/username and password.
FR-AUTH-02: Passwords are hashed with bcrypt; sessions use JWT (access + refresh tokens).
FR-AUTH-03: Role-based access control (RBAC) restricts every route and API endpoint by role.
FR-AUTH-04: Accounts have statuses: Pending, Active, Suspended. Only Active accounts can log in.
FR-AUTH-05: Users can change their password; admin can reset any user's password.
FR-AUTH-06: Self-registration (optional) creates a Pending account requiring admin approval.
3.2 Admin Module
FR-ADM-01: Create, view, edit, suspend, and delete teacher and student accounts.
FR-ADM-02: Approve or reject pending registrations.
FR-ADM-03: Manage academic structure: classes (e.g., Nursery), sections (e.g., A, B), subjects (e.g., English, Math, Drawing, Rhymes), and academic sessions/years.
FR-ADM-04: Assign teachers to a specific class + section + subject combination (a teacher can have many assignments).
FR-ADM-05: Enroll students into a class and section with a unique roll number.
FR-ADM-06: Store guardian details for each student (name, relation, phone, email).
FR-ADM-07: Create meetings (parent-teacher meetings, orientation, events) and invite individual students, whole sections, whole classes, or all students.
FR-ADM-08: Publish school-wide notices.
FR-ADM-09: View and override any attendance or result record, with every change logged.
FR-ADM-10: Configure system settings, such as the grading scale and the low-attendance warning threshold (default 75%).
FR-ADM-11: View audit logs of critical actions (user creation, attendance edits, result changes).
3.3 Teacher Module
FR-TCH-01: View all assigned classes, sections, and subjects in a clear list/timetable view.
FR-TCH-02: View the student list for each assigned class-section.
Attendance management:
FR-TCH-03: Take attendance for an assigned class-section-subject on a given date, marking each student Present, Absent, or Late. A "Mark all present" shortcut is provided.
FR-TCH-04: Only one attendance record exists per student per class session (no duplicates).
FR-TCH-05: Edit previously submitted attendance (e.g., change Absent → Present) with a mandatory reason. The system stores the old value, new value, editor, timestamp, and reason.
FR-TCH-06: If a correction changes Absent to Present, the related absence notification is marked as corrected and the student receives an update.
FR-TCH-07: View attendance history and summaries per student and per class.
Result management:
FR-TCH-08: Create assessments (e.g., Class Test, Mid-Term, Final) for an assigned subject with a total mark.
FR-TCH-09: Enter marks and/or grades for each student individually, plus optional teacher remarks (important for nursery-level feedback such as "Needs improvement in fine motor skills").
FR-TCH-10: Grades are auto-calculated from marks using the admin-configured grading scale, with manual override allowed.
FR-TCH-11: Results stay in Draft until the teacher publishes them; only published results are visible to students.
FR-TCH-12: Edit published results, with changes logged and the student notified.
FR-TCH-13: Create meetings for their own class-sections and invite students.
FR-TCH-14: View meeting invitations sent to them by the admin.
3.4 Student (Guardian) Module
FR-STU-01: View profile, class, section, roll number, and assigned teachers.
FR-STU-02: View attendance history in a calendar view (color-coded: present, absent, late).
FR-STU-03: See total classes held, days present, days absent, and attendance percentage, overall and per subject.
FR-STU-04: Receive a warning when attendance falls below the configured threshold.
FR-STU-05: View published results per assessment and subject, with grades and teacher remarks.
FR-STU-06: View meetings they are invited to (title, date, time, venue/online link, agenda, organizer).
FR-STU-07: Respond to meeting invitations (Will Attend / Cannot Attend) — optional feature.
FR-STU-08: View school notices.
3.5 Notification System
FR-NOT-01: When a student is marked Absent, the system automatically creates a notification in their profile stating the date, subject, and teacher.
FR-NOT-02: Notifications are also generated for: result publication, result changes, meeting invitations, meeting updates/cancellations, attendance corrections, low-attendance warnings, and school notices.
FR-NOT-03: Each notification has read/unread status; a bell icon shows the unread count.
FR-NOT-04: Users can mark notifications as read individually or all at once.
FR-NOT-05 (optional): Real-time delivery using Socket.io; optional email alerts to guardians via Nodemailer.
3.6 Attendance Calculation Rules
Attendance % = (Present + Late) ÷ Total classes held × 100 (the SRS should state whether "Late" counts as present; configurable by admin).
Calculations are available overall, per subject, and per month.
Only classes that were actually recorded count toward the total.
4. Interactive Dashboards

Admin Dashboard: total students, teachers, classes, and sections; pending approvals; today's school-wide attendance rate; a chart of attendance trends over the last 30 days; class-wise attendance comparison (bar chart); a list of students below the attendance threshold; upcoming meetings; recent activity/audit feed.

Teacher Dashboard: today's assigned classes; classes where attendance is still pending today; attendance summary per assigned section (charts); students with frequent absences; results in draft awaiting publication; upcoming meetings.

Student Dashboard: attendance percentage shown as a progress ring; present/absent/late counts; a monthly attendance chart; latest absence alerts; recent published results with grades; upcoming meeting invitations; unread notifications and notices.

Charts should use Recharts or Chart.js, with filters by date range, class, section, and subject where relevant.

5. Data Model (MongoDB Collections)

Describe each collection with fields, types, relationships, and indexes:

User: name, email, passwordHash, role (admin/teacher/student), status, phone, profilePhoto, createdBy, timestamps.
StudentProfile: userId, rollNo, classId, sectionId, dateOfBirth, guardian {name, relation, phone, email}, admissionDate.
TeacherProfile: userId, employeeId, qualification, joiningDate.
Class, Section, Subject, AcademicSession.
TeacherAssignment: teacherId, classId, sectionId, subjectId, sessionId.
Attendance: studentId, classId, sectionId, subjectId, teacherId, date, status, markedAt; unique compound index on (studentId, subjectId, date).
AttendanceEditLog: attendanceId, oldStatus, newStatus, editedBy, reason, editedAt.
Assessment: name, type, subjectId, classId, sectionId, totalMarks, date, status (draft/published).
Result: assessmentId, studentId, marksObtained, grade, remarks, updatedBy.
Meeting: title, agenda, type, dateTime, venue/link, organizerId, invitees (students, sections, classes, or all), responses.
Notification: recipientId, type, title, message, relatedEntity, isRead, createdAt.
Notice, AuditLog, Settings (grading scale, attendance threshold).

Include an ER diagram description in the SRS.

6. API Design (Express REST)

List endpoints grouped by module with method, route, allowed roles, and purpose, for example:

POST /api/auth/login, POST /api/auth/refresh
GET/POST/PATCH/DELETE /api/users (admin)
PATCH /api/users/:id/approve (admin)
GET /api/teacher/assignments (teacher)
POST /api/attendance, PATCH /api/attendance/:id (teacher, admin)
GET /api/attendance/student/:id/summary (student-own, teacher, admin)
POST /api/assessments, PUT /api/results/:assessmentId (teacher)
PATCH /api/assessments/:id/publish (teacher)
GET/POST /api/meetings, PATCH /api/meetings/:id/respond
GET /api/notifications, PATCH /api/notifications/:id/read
GET /api/dashboard/{admin|teacher|student}

Teachers must only be able to access data for their own assignments, and students only their own records; enforce this at the API level, not just in the UI.

7. Non-Functional Requirements
Security: bcrypt hashing, JWT with expiry, HTTP-only cookies or secure token storage, input validation (Joi/Zod or express-validator), rate limiting on login, Helmet, CORS configuration, protection against NoSQL injection and XSS.
Performance: dashboard load under 2 seconds for up to 500 students; paginated lists; indexed queries.
Usability: simple, friendly, mobile-responsive UI (Tailwind CSS or Material UI), since guardians will mostly use phones; large readable text; color-coded statuses.
Reliability: daily database backups; graceful error handling with clear messages.
Maintainability: MVC-style backend folder structure, reusable React components, environment variables for configuration.
Privacy: children's data is sensitive; only authorized roles can view student information.
Scalability: architecture should allow adding a separate Parent role, fee management, or a timetable module later.
8. Constraints & Assumptions
Single-school deployment; one academic session active at a time.
Students do not log in independently; guardians use the student account.
Internet access is required; no offline mode in version 1.
Deployment target: frontend on Vercel/Netlify, backend on Render/Railway, database on MongoDB Atlas.
9. Required SRS Output Structure

Produce the SRS with these sections:

Introduction (Purpose, Scope, Definitions/Acronyms, References, Overview)
Overall Description (Product Perspective, Product Functions, User Classes & Characteristics, Operating Environment, Design Constraints, Assumptions & Dependencies)
System Features (each feature with description, priority, stimulus/response sequences, and numbered functional requirements)
External Interface Requirements (User Interfaces, Software Interfaces, Communication Interfaces)
Non-Functional Requirements
Data Requirements (collection schemas and ER diagram description)
Use Case section: a use case diagram description plus detailed use cases (actor, preconditions, main flow, alternate flows, postconditions) for at least: Login, Approve User, Assign Teacher, Take Attendance, Edit Attendance, Publish Result, Create Meeting, View Attendance Summary
Activity/sequence diagram descriptions for Take Attendance → Absence Notification and Publish Result → Student Notification
Requirements Traceability Matrix (requirement ID → feature → use case)
Appendix (grading scale example, sample dashboard wireframe descriptions, future enhancements)

