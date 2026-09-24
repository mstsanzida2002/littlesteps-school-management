import { Router } from 'express';

import { ROLES } from '../config/constants.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { studentOwnsRecord, teacherOwnsAssignment } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import * as attendance from '../services/attendance.service.js';
import * as edits from '../services/attendanceEdit.service.js';
import * as summaries from '../services/attendanceSummary.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requestMeta } from '../utils/requestMeta.js';
import * as v from '../validators/attendance.validator.js';
import { idParams } from '../validators/common.validator.js';

const { ADMIN, TEACHER } = ROLES;
const handle = (fn) => asyncHandler(fn);

/** /api/attendance (FR-TCH-03…07, FR-ADM-09 attendance override). */
export function createAttendanceRouter() {
  const router = Router();
  router.use(authenticate);

  // Teacher: mark once per class-section per day.
  router.post(
    '/',
    authorize(TEACHER),
    validate({ body: v.markAttendanceSchema }),
    handle(async (req, res) => {
      const result = await attendance.markAttendance(req.user, req.body, requestMeta(req));
      sendCreated(res, {
        message: `Attendance saved for ${result.classSection} (${result.records} records)`,
        data: result,
      });
    }),
  );

  router.get(
    '/today',
    authorize(TEACHER),
    handle(async (req, res) => sendSuccess(res, { data: await attendance.todayStatus(req.user) })),
  );

  router.get(
    '/class-sections/:classId/:sectionId/sheet',
    authorize(ADMIN, TEACHER),
    validate({ params: v.classSectionParams, query: v.sheetQuery }),
    teacherOwnsAssignment(),
    handle(async (req, res) =>
      sendSuccess(res, {
        data: await attendance.attendanceSheet(req.user, {
          ...req.validated.params,
          ...req.validated.query,
        }),
      }),
    ),
  );

  router.get(
    '/class-sections/:classId/:sectionId/summary',
    authorize(ADMIN, TEACHER),
    validate({ params: v.classSectionParams, query: v.classSummaryQuery }),
    teacherOwnsAssignment((req) => ({ ...req.validated.params })),
    handle(async (req, res) =>
      sendSuccess(res, {
        data: await summaries.classSectionSummary({
          ...req.validated.params,
          ...req.validated.query,
        }),
      }),
    ),
  );

  // Student (own), assigned teachers, admins.
  router.get(
    '/student/:studentId/summary',
    validate({ params: v.studentParams, query: v.summaryQuery }),
    studentOwnsRecord(),
    handle(async (req, res) =>
      sendSuccess(res, {
        data: await summaries.studentSummary(req.validated.params.studentId, req.validated.query),
      }),
    ),
  );
  router.get(
    '/student/:studentId/history',
    validate({ params: v.studentParams, query: v.summaryQuery }),
    studentOwnsRecord(),
    handle(async (req, res) =>
      sendSuccess(res, {
        data: await summaries.studentHistory(req.validated.params.studentId, req.validated.query),
      }),
    ),
  );

  // Edits: teachers (own subjects, backdate limit) and admins (override, any record).
  router.patch(
    '/students/:studentId/days/:date',
    authorize(ADMIN, TEACHER),
    validate({ params: v.studentDayParams, body: v.editDaySchema }),
    handle(async (req, res) => {
      const { studentId, date } = req.validated.params;
      const result = await edits.editStudentDay(
        req.user,
        studentId,
        date,
        req.body,
        requestMeta(req),
      );
      sendSuccess(res, { message: `Updated ${result.updated} record(s)`, data: result });
    }),
  );
  router.patch(
    '/:id',
    authorize(ADMIN, TEACHER),
    validate({ params: idParams, body: v.editRecordSchema }),
    handle(async (req, res) => {
      const result = await edits.editRecord(
        req.user,
        req.validated.params.id,
        req.body,
        requestMeta(req),
      );
      sendSuccess(res, { message: 'Attendance updated', data: result });
    }),
  );

  return router;
}
