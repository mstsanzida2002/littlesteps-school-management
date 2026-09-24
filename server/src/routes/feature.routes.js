/**
 * Results (/api/assessments, /api/results), meetings (/api/meetings), notices (/api/notices) and
 * dashboards (/api/dashboard). Every route authenticates; roles and ownership are checked here
 * (authorize / studentOwnsRecord) and again in the services.
 */
import { Router } from 'express';

import { ROLES } from '../config/constants.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { studentOwnsRecord } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import * as dashboards from '../services/dashboard.service.js';
import * as meetings from '../services/meeting.service.js';
import * as notices from '../services/notice.service.js';
import * as results from '../services/results.service.js';
import * as settings from '../services/settings.service.js';
import * as assignments from '../services/teacherAssignment.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requestMeta } from '../utils/requestMeta.js';
import { idParams } from '../validators/common.validator.js';
import * as mv from '../validators/meeting.validator.js';
import * as nv from '../validators/notice.validator.js';
import * as rv from '../validators/results.validator.js';
import { studentParams } from '../validators/attendance.validator.js';

const { ADMIN, TEACHER, STUDENT } = ROLES;
const h = asyncHandler;
const id = (req) => req.validated.params.id;

export function createAssessmentRouter() {
  const router = Router();
  router.use(authenticate, authorize(ADMIN, TEACHER));

  router.post(
    '/',
    validate({ body: rv.createAssessmentSchema }),
    h(async (req, res) =>
      sendCreated(res, {
        message: 'Assessment created',
        data: await results.createAssessment(req.user, req.body, requestMeta(req)),
      }),
    ),
  );
  router.get(
    '/',
    validate({ query: rv.listAssessmentsQuery }),
    h(async (req, res) => {
      const { items, meta } = await results.listAssessments(req.user, req.validated.query);
      sendSuccess(res, { data: items, meta });
    }),
  );
  router.get(
    '/:id',
    validate({ params: idParams }),
    h(async (req, res) =>
      sendSuccess(res, { data: await results.getAssessment(req.user, id(req)) }),
    ),
  );
  router.patch(
    '/:id',
    validate({ params: idParams, body: rv.updateAssessmentSchema }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Assessment updated',
        data: await results.updateAssessment(req.user, id(req), req.body, requestMeta(req)),
      }),
    ),
  );
  router.delete(
    '/:id',
    validate({ params: idParams }),
    h(async (req, res) => {
      await results.deleteAssessment(req.user, id(req), requestMeta(req));
      sendSuccess(res, { message: 'Assessment deleted' });
    }),
  );
  router.patch(
    '/:id/publish',
    validate({ params: idParams }),
    h(async (req, res) => {
      const data = await results.publishAssessment(req.user, id(req), requestMeta(req));
      sendSuccess(res, { message: `Published to ${data.students} students`, data });
    }),
  );
  return router;
}

export function createResultRouter() {
  const router = Router();
  router.use(authenticate);

  // Published results of a student: the student themselves, assigned teachers, admins.
  router.get(
    '/student/:studentId',
    validate({ params: studentParams, query: rv.studentResultsQuery }),
    studentOwnsRecord(),
    h(async (req, res) =>
      sendSuccess(res, {
        data: await results.studentResults(req.validated.params.studentId, req.validated.query),
      }),
    ),
  );
  router.put(
    '/:assessmentId',
    authorize(ADMIN, TEACHER),
    validate({ params: rv.assessmentIdParams, body: rv.saveResultsSchema }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Draft results saved',
        data: await results.saveDraftResults(
          req.user,
          req.validated.params.assessmentId,
          req.body.entries,
          requestMeta(req),
        ),
      }),
    ),
  );
  router.patch(
    '/:id',
    authorize(ADMIN, TEACHER),
    validate({ params: idParams, body: rv.editResultSchema }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Result updated and the student notified',
        data: await results.editPublishedResult(req.user, id(req), req.body, requestMeta(req)),
      }),
    ),
  );
  return router;
}

export function createMeetingRouter() {
  const router = Router();
  router.use(authenticate);

  router.post(
    '/',
    authorize(ADMIN, TEACHER),
    validate({ body: mv.createMeetingSchema }),
    h(async (req, res) =>
      sendCreated(res, {
        message: 'Meeting created and invitations sent',
        data: await meetings.createMeeting(req.user, req.body, requestMeta(req)),
      }),
    ),
  );
  router.get(
    '/',
    validate({ query: mv.listMeetingsQuery }),
    h(async (req, res) => {
      const { items, meta } = await meetings.listMeetings(req.user, req.validated.query);
      sendSuccess(res, { data: items, meta });
    }),
  );
  router.get(
    '/:id',
    validate({ params: idParams }),
    h(async (req, res) => sendSuccess(res, { data: await meetings.getMeeting(req.user, id(req)) })),
  );
  router.get(
    '/:id/responses',
    authorize(ADMIN, TEACHER),
    validate({ params: idParams }),
    h(async (req, res) =>
      sendSuccess(res, { data: await meetings.meetingResponses(req.user, id(req)) }),
    ),
  );
  router.patch(
    '/:id/respond',
    authorize(STUDENT),
    validate({ params: idParams, body: mv.respondSchema }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Response saved',
        data: await meetings.respondToMeeting(req.user, id(req), req.body),
      }),
    ),
  );
  router.patch(
    '/:id',
    authorize(ADMIN, TEACHER),
    validate({ params: idParams, body: mv.updateMeetingSchema }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Meeting updated',
        data: await meetings.updateMeeting(req.user, id(req), req.body, requestMeta(req)),
      }),
    ),
  );
  router.post(
    '/:id/cancel',
    authorize(ADMIN, TEACHER),
    validate({ params: idParams, body: mv.cancelMeetingSchema }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Meeting cancelled and invitees notified',
        data: await meetings.cancelMeeting(req.user, id(req), req.body, requestMeta(req)),
      }),
    ),
  );
  return router;
}

export function createNoticeRouter() {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    validate({ query: nv.listNoticesQuery }),
    h(async (req, res) => {
      const { items, meta } = await notices.listNotices(req.user, req.validated.query);
      sendSuccess(res, { data: items, meta });
    }),
  );
  router.get(
    '/:id',
    validate({ params: idParams }),
    h(async (req, res) => sendSuccess(res, { data: await notices.getNotice(req.user, id(req)) })),
  );

  const admin = [authorize(ADMIN)];
  router.post(
    '/',
    ...admin,
    validate({ body: nv.createNoticeSchema }),
    h(async (req, res) => {
      const data = await notices.createNotice(req.user, req.body, requestMeta(req));
      sendCreated(res, {
        message: data.recipients
          ? `Notice published to ${data.recipients} users`
          : 'Notice saved as draft',
        data,
      });
    }),
  );
  router.post(
    '/:id/publish',
    ...admin,
    validate({ params: idParams }),
    h(async (req, res) => {
      const data = await notices.publishNotice(req.user, id(req), requestMeta(req));
      sendSuccess(res, { message: `Notice published to ${data.recipients} users`, data });
    }),
  );
  router.patch(
    '/:id/expire',
    ...admin,
    validate({ params: idParams }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Notice expired',
        data: await notices.expireNotice(req.user, id(req), requestMeta(req)),
      }),
    ),
  );
  router.patch(
    '/:id',
    ...admin,
    validate({ params: idParams, body: nv.updateNoticeSchema }),
    h(async (req, res) =>
      sendSuccess(res, {
        message: 'Notice updated',
        data: await notices.updateNotice(req.user, id(req), req.body, requestMeta(req)),
      }),
    ),
  );
  router.delete(
    '/:id',
    ...admin,
    validate({ params: idParams }),
    h(async (req, res) => {
      await notices.deleteNotice(req.user, id(req), requestMeta(req));
      sendSuccess(res, { message: 'Notice deleted' });
    }),
  );
  return router;
}

export function createDashboardRouter() {
  const router = Router();
  router.use(authenticate);
  router.get(
    '/admin',
    authorize(ADMIN),
    h(async (req, res) => sendSuccess(res, { data: await dashboards.adminDashboard(req.user) })),
  );
  router.get(
    '/teacher',
    authorize(TEACHER),
    h(async (req, res) => sendSuccess(res, { data: await dashboards.teacherDashboard(req.user) })),
  );
  router.get(
    '/student',
    authorize(STUDENT),
    h(async (req, res) => sendSuccess(res, { data: await dashboards.studentDashboard(req.user) })),
  );
  return router;
}

/**
 * Read-only lookups for non-admins. Mounted before the admin-only /settings and
 * /teacher-assignments routers (routes/index.js), which would otherwise answer 403.
 */
export function createSchoolSettingsRouter() {
  const router = Router();
  router.get(
    '/',
    authenticate,
    asyncHandler(async (req, res) => sendSuccess(res, { data: await settings.schoolSettings() })),
  );
  return router;
}

export function createMyAssignmentsRouter() {
  const router = Router();
  router.get(
    '/',
    authenticate,
    authorize(ROLES.TEACHER),
    asyncHandler(async (req, res) =>
      sendSuccess(res, { data: await assignments.myAssignments(req.user) }),
    ),
  );
  return router;
}
