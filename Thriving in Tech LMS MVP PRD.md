# Thriving in Tech LMS MVP Product Requirements

Version 0.1  |  12 October 2026  |  Platform Web application

The MVP will let Thriving in Tech deliver a course from enrolment through lessons, live classes, assignment submission, and lecturer feedback. It will give administrators the controls needed to run a pilot cohort and give students one place to find their learning activities.

This PRD defines the proposed first release for product, design, and engineering review. The first release should prove that the core learning workflow works reliably before expanding into mentorship, career development, community, or certification.

## 1 Product goals and scope

### Problem and intended outcome

The program needs a web platform that connects students, lecturers, and administrators around course delivery. The MVP should make published materials, class schedules, assignment deadlines, and feedback accessible within each enrolled course. It should also make outstanding work visible to lecturers.

### Goals

- Students can access enrolled courses, continue learning, and submit work with a clear confirmation.

- Lecturers can publish content, schedule live sessions, review submissions, and return grades and feedback.

- Administrators can manage users, enrol students, create courses, assign lecturers, and monitor basic progress.

### Included in the first release

Email authentication and recovery; three permission roles; course enrolment and publishing; modules and lessons; downloadable resources and hosted video links; lesson completion; course dashboards; live class schedules with Zoom links; recording links; assignments and project submissions; grading; announcements; essential in-app and email notifications; basic administrative reporting.

### Deferred until after the pilot

Mentorship booking; course discussion forums; portfolio builder; job portal and application tracking; certificate applications and generation; Google sign-in; automatic lesson releases; scheduled announcements; recurring meeting schedules; detailed analytics; automatic Zoom meeting creation and recording import; native video hosting; native mobile apps.

Scope proposal: lecturers will add existing Zoom meeting links and recording links for the MVP. Automatic Zoom scheduling remains part of the broader product vision, but is deferred to reduce integration work for the pilot.

## 2 Users permissions and core journeys

### User access

| Role | MVP permissions |
| --- | --- |
| Student | Access enrolled published courses; view lessons and classes; mark lessons complete; submit work; view own grades and feedback; receive course notices. |
| Lecturer | Manage assigned courses and own basic profile; publish lessons; schedule classes; create assignments; view course submissions; grade and provide feedback; publish announcements. |
| Administrator | Manage accounts and roles; approve lecturer access; create and archive courses; assign lecturers; enrol or remove students; view progress and submission reports. |

Permission rules: access must be enforced on the server. Students cannot view another student's submissions or grades. Lecturers cannot manage unassigned courses or grant roles. Only administrators can approve lecturer privileges. Archived courses remain readable to existing members, but accept no new activity.

### Student journey

Register and verify email → administrator enrols student → sign in → open an enrolled course → read a lesson or watch a video → mark it complete → join a scheduled class → submit an assignment → view grade and written feedback.

### Lecturer journey

Receive approved access → open assigned course → create modules and lessons → publish content → schedule a class and attach its Zoom link → create an assignment → review submitted work → save and publish a grade with feedback.

### Administrator journey

Create a course → assign an approved lecturer → enrol pilot students → confirm course content is ready → publish the course → monitor lesson completion and assignment statuses → resolve access issues.

### FR01 Account access

Support student registration, email verification, login, logout, forgotten passwords, and password reset. Lecturer registration creates a pending account until an administrator approves it. Seed the first administrator through a controlled setup process.

Acceptance criteria: An unverified student cannot enter protected learning pages. Reset links expire and cannot be reused. Duplicate email registration is handled clearly. Login errors do not disclose whether an account exists. Pending lecturers cannot access lecturer tools.

### FR02 User and enrolment administration

Administrators can approve lecturers, assign roles, deactivate users, and add or remove course enrolments.

Acceptance criteria: Deactivation revokes access. Removing an enrolment immediately blocks course access. A duplicate enrolment does not create a second record. Role changes are recorded in the audit log.

## 3 Course delivery and live learning

### FR03 Course and lesson management

Administrators create course shells and assign lecturers. Assigned lecturers organise lessons in ordered modules or weeks and publish text, resource files, and hosted video links. Courses and lessons support draft and published states.

Acceptance criteria: Students see only published lessons in published enrolled courses. Draft content is hidden even through direct URLs. Lesson order is retained after editing. Resource upload failures show a recoverable error. Unpublishing removes student access without deleting saved progress.

### FR04 Learning progress and dashboards

Students can mark lessons complete and reopen them. The dashboard shows enrolled courses, the next incomplete lesson, upcoming classes, assignment deadlines, and recent course announcements. Lecturers see assigned courses and submissions awaiting grading.

Acceptance criteria: Progress persists across sessions. Course progress equals completed published lessons divided by all published lessons; an empty course shows zero. New published lessons update the denominator. Repeated completion requests do not duplicate records. Empty dashboard sections show a useful empty state.

### FR05 Live class scheduling

Lecturers add a title, course, start time, time zone, duration, and valid Zoom meeting link. They can edit or cancel a scheduled class. Students view the timetable and open the meeting link in Zoom or a browser.

Acceptance criteria: Only enrolled students and assigned staff can see joining links. Cancelled sessions are labelled and their join action is disabled. Times display in the user's chosen time zone. Rescheduling updates the dashboard and creates a notification. The system stores the instant consistently across time zones.

### FR06 Class recordings

Lecturers attach a hosted recording link to a lesson or class after the session. The platform displays the recording for enrolled students.

Acceptance criteria: A recording is visible only after publication. Students can open it from the associated lesson or class. Invalid URLs are rejected. External access or playback failures show guidance to contact the lecturer. The recording host must also be configured to restrict access where required.

### Content boundaries

The LMS stores course metadata and resource files. Video streaming and live meetings run through external hosts in the MVP. Recording downloads and automatic imports are deferred. Lessons support PDF, PPTX, and DOCX resources; assignment submissions support PDF, DOCX, and ZIP files plus an optional repository or project URL.

Proposed upload policy: maximum 25 MB per file, one submission file per assignment, and file type validation on both client and server. Keep storage private and authorise downloads before issuing short-lived links. Confirm these limits with the pilot instructors.

## 4 Assignments feedback and notifications

### FR07 Assignments and project submissions

Lecturers create and publish assignments with instructions, an optional rubric file, a deadline, and a maximum score. Projects use the same workflow and may include a repository or demo URL. Students submit or replace their work until grading is published.

Acceptance criteria: A submission records the student, assignment, timestamp, file or URL, and status. Successful submission shows a receipt. Failed uploads do not create a submitted status. Late work is accepted and labelled late. The lecturer sees the latest submitted version. Published grading locks replacement; a lecturer can explicitly reopen the submission.

### FR08 Grading and feedback

Lecturers review submissions, enter a score within the assignment's range, add written feedback, and publish the result. They can save a draft grade before publishing.

Acceptance criteria: Students see only published grades for their own work. Draft grading is hidden. Publishing creates a feedback notification. Grade changes record the actor and time. A score outside the allowed range cannot be saved. Reopening retains the prior submission and grade history.

### FR09 Course announcements

Lecturers publish announcements for assigned courses and may pin one important announcement. Enrolled students see announcements on the course page and dashboard.

Acceptance criteria: Announcements are restricted to the course audience. Unpublishing removes them from the student view. A new announcement creates one in-app item and queues one email per eligible recipient. Pinning affects display order without resending notifications.

### FR10 Essential notifications

Provide in-app notifications for announcements, class scheduling or changes, and published feedback. Send email for those events and one assignment reminder 24 hours before a deadline. Verification and recovery emails remain transactional account messages.

Acceptance criteria: Notifications link to the relevant protected item. Students can mark an item read. Duplicate jobs do not create duplicate deliveries. Email failures are retried and visible to administrators without blocking the user action. Cancelled or changed assignments invalidate outdated reminders; assignments published within 24 hours of their deadline send no separate reminder.

### FR11 Basic administrative reports

Administrators can view course enrolment counts, student lesson completion, and assignment status with submitted, late, missing, and graded indicators. Provide a CSV export for these records.

Acceptance criteria: Reports use the same records as the learner and lecturer views. Only administrators can export across courses. Exported grades and submissions remain private. Missing work is determined only after the deadline; graded is a separate status from whether the submission was late.

## 5 Quality requirements and success measures

### Release quality requirements

The following are proposed implementation targets. Validate them against the pilot size, budget, and hosting choices before committing to a release date.

| Area | MVP requirement and verification |
| --- | --- |
| Security | Use HTTPS, secure password hashing, expiring sessions and reset tokens, request validation, login rate limits, and server-side role and course access checks. Verify access denial through direct API requests for each role. |
| Files and privacy | Keep files private; validate size and type; scan uploaded files before download. Collect only necessary profile information. Audit role, enrolment, course publication, and grade changes. Confirm retention and deletion policy before launch. |
| Accessibility | Target WCAG 2.1 AA for core flows. Verify keyboard operation, visible focus, labelled controls, readable contrast, and accessible error messages. Instructors provide captions or transcripts for required video lessons. |
| Responsive experience | Core journeys work at 360 px mobile width and on desktop browsers. Validate current Chrome, Edge, Firefox, and Safari versions available for the pilot. Download and upload states must be clear on slow connections. |
| Performance | Proposed pilot load is 100 enrolled users with 30 concurrent users. At this load, 95% of core API requests complete within 1 second excluding file transfers and external services; key learning screens become usable within 3 seconds on a defined representative mobile connection. |
| Recovery and operations | Daily database backups; proposed maximum data loss of 24 hours and recovery within 8 hours. Protect file storage with versioning or equivalent recovery. Complete a restore drill, monitor application errors, and provide a support contact. |

### Pilot success measures

Evaluate the first four weeks of a pilot cohort. Targets below are proposed decision criteria, not existing program results.

- Activation: at least 80% of enrolled students verify their email and open a course within seven days of enrolment. Denominator is all enrolled pilot students.

- Learning use: at least 70% of activated students open a lesson or submit work in three of the four pilot weeks.

- Submission reliability: at least 95% of valid submission attempts complete successfully, excluding user cancellations. Instrument upload starts, failures, and confirmed submissions.

- Teaching completion: every pilot course completes one published lesson, scheduled class, assignment submission, and published feedback cycle; no unresolved critical access or data-loss incident occurs.

## 6 Delivery plan and decisions to confirm

### Suggested implementation sequence

| Stage | Deliverable and completion condition |
| --- | --- |
| 1 Access and structure | Accounts, roles, course shells, lecturer assignment, enrolment, and private file storage. Verify each role can access only its permitted records. |
| 2 Learning delivery | Modules, lessons, resources, progress, dashboards, Zoom links, and recording links. Demonstrate an enrolled student consuming published content. |
| 3 Work and communication | Assignments, submission receipts, grading, feedback, announcements, notifications, and reports. Demonstrate the complete teaching cycle. |
| 4 Pilot readiness | Permission checks, accessibility review, upload and email failure testing, performance checks, backup restore, documentation, and deployment. Release to the agreed pilot cohort. |

The source positions the LMS as a six-month capstone. These stages define an MVP build order within that program; duration and staffing must be agreed separately. A production date should follow confirmed scope, provider choices, and team capacity.

### Launch acceptance

- All FR01 to FR11 acceptance criteria pass, including unauthorised access, failed uploads, late submissions, rescheduling, and notification retries.

- An administrator, lecturer, and student complete the full core journey using pilot-like data in the deployed environment.

- No unresolved issue allows unauthorised access, loses a confirmed submission, exposes private grades, or blocks the core teaching cycle.

- Backups and recovery are verified. User guidance, API documentation, deployment instructions, and a support process are available.

### Decisions required before implementation

Product decisions: confirm the first pilot cohort and course count; approve deferred certificate and mentorship workflows; confirm manual Zoom links; decide who controls enrolment and course publication; approve late work, resubmission, and grade reopening rules; agree pilot metrics and a review owner.

Operational decisions: confirm permitted resource and submission types and size limits; approve recording access settings; choose email and storage providers; agree privacy notice, file retention, account deletion, support ownership, and backup targets. Confirm the event time zone and instructor responsibility for accessible materials.

### Technical direction

Use the source's proposed stack as a starting point: React or Next.js with Tailwind CSS; Node.js, Express, and TypeScript; PostgreSQL; private S3 or Cloudinary storage; SendGrid or Resend for email. Keep course, submission, notification, and audit records in PostgreSQL for the MVP. Select one hosting approach before implementation. Google OAuth and an additional MongoDB database are deferred.

### Source reference

Thriving in Tech Learning Management System Product Requirements Document, version 1.0. Core course delivery, roles, live classes, assignments, announcements, and non-functional requirements are retained. The narrower scope, workflow rules, file limits, pilot targets, and release criteria in this MVP PRD are proposals for review.
