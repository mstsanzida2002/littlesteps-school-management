/**
 * Admin-only resources (FR-ADM-03/04/10/11): classes, sections, subjects, sessions,
 * teacher assignments, settings, audit logs. Each router requires the admin role.
 */
import { Router } from 'express';

import { ROLES } from '../config/constants.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as academic from '../services/academic.service.js';
import * as assignments from '../services/teacherAssignment.service.js';
import * as audit from '../services/audit.service.js';
import * as settings from '../services/settings.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requestMeta } from '../utils/requestMeta.js';
import * as v from '../validators/academic.validator.js';
import { listAuditLogsQuery } from '../validators/audit.validator.js';
import { idParams } from '../validators/common.validator.js';
import { updateSettingsSchema } from '../validators/settings.validator.js';
import {
  createAssignmentSchema,
  listAssignmentsQuery,
  updateAssignmentSchema,
} from '../validators/teacherAssignment.validator.js';

const adminRouter = () => {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  return router;
};

const toJSON = (doc) => (typeof doc?.toJSON === 'function' ? doc.toJSON() : doc);

/** Standard list/get/create/update/delete routes over a service's functions. */
function crudRouter({ label, list, get, create, update, remove, schemas }) {
  const router = adminRouter();
  const id = (req) => req.validated.params.id;

  router.get(
    '/',
    validate({ query: schemas.list }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await list(req.validated.query);
      sendSuccess(res, { data: items, meta });
    }),
  );
  router.get(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => sendSuccess(res, { data: await get(id(req)) })),
  );
  router.post(
    '/',
    validate({ body: schemas.create }),
    asyncHandler(async (req, res) => {
      const doc = await create(req.user, req.body, requestMeta(req));
      sendCreated(res, { message: `${label} created`, data: toJSON(doc) });
    }),
  );
  router.patch(
    '/:id',
    validate({ params: idParams, body: schemas.update }),
    asyncHandler(async (req, res) => {
      const doc = await update(req.user, id(req), req.body, requestMeta(req));
      sendSuccess(res, { message: `${label} updated`, data: toJSON(doc) });
    }),
  );
  router.delete(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      await remove(req.user, id(req), requestMeta(req));
      sendSuccess(res, { message: `${label} deleted` });
    }),
  );
  return router;
}

export const createClassRouter = () =>
  crudRouter({
    label: 'Class',
    list: academic.listClasses,
    get: academic.getClass,
    create: academic.createClass,
    update: academic.updateClass,
    remove: academic.deleteClass,
    schemas: { list: v.listClassesQuery, create: v.createClassSchema, update: v.updateClassSchema },
  });

export const createSectionRouter = () =>
  crudRouter({
    label: 'Section',
    list: academic.listSections,
    get: academic.getSection,
    create: academic.createSection,
    update: academic.updateSection,
    remove: academic.deleteSection,
    schemas: {
      list: v.listSectionsQuery,
      create: v.createSectionSchema,
      update: v.updateSectionSchema,
    },
  });

export const createSubjectRouter = () =>
  crudRouter({
    label: 'Subject',
    list: academic.listSubjects,
    get: academic.getSubject,
    create: academic.createSubject,
    update: academic.updateSubject,
    remove: academic.deleteSubject,
    schemas: {
      list: v.listSubjectsQuery,
      create: v.createSubjectSchema,
      update: v.updateSubjectSchema,
    },
  });

export function createSessionRouter() {
  const router = crudRouter({
    label: 'Session',
    list: academic.listSessions,
    get: academic.getSession,
    create: academic.createSession,
    update: academic.updateSession,
    remove: academic.deleteSession,
    schemas: {
      list: v.listSessionsQuery,
      create: v.createSessionSchema,
      update: v.updateSessionSchema,
    },
  });
  router.post(
    '/:id/activate',
    validate({ params: idParams, body: v.activateSessionSchema }),
    asyncHandler(async (req, res) => {
      const session = await academic.activateSession(
        req.user,
        req.validated.params.id,
        req.body,
        requestMeta(req),
      );
      sendSuccess(res, { message: `${session.name} is now the active session`, data: session });
    }),
  );
  return router;
}

export function createTeacherAssignmentRouter() {
  const router = adminRouter();
  router.get(
    '/',
    validate({ query: listAssignmentsQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await assignments.listAssignments(req.validated.query);
      sendSuccess(res, { data: items, meta });
    }),
  );
  router.post(
    '/',
    validate({ body: createAssignmentSchema }),
    asyncHandler(async (req, res) => {
      const assignment = await assignments.createAssignment(req.user, req.body, requestMeta(req));
      sendCreated(res, { message: 'Teacher assigned', data: assignment });
    }),
  );
  router.patch(
    '/:id',
    validate({ params: idParams, body: updateAssignmentSchema }),
    asyncHandler(async (req, res) => {
      const assignment = await assignments.updateAssignmentSchedule(
        req.user,
        req.validated.params.id,
        req.body,
        requestMeta(req),
      );
      sendSuccess(res, { message: 'Schedule updated', data: assignment });
    }),
  );
  router.delete(
    '/:id',
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      const { message, ...data } = await assignments.removeAssignment(
        req.user,
        req.validated.params.id,
        requestMeta(req),
      );
      sendSuccess(res, { message, data });
    }),
  );
  return router;
}

export function createSettingsRouter() {
  const router = adminRouter();
  router.get(
    '/',
    asyncHandler(async (req, res) => sendSuccess(res, { data: await settings.getSettings() })),
  );
  router.patch(
    '/',
    validate({ body: updateSettingsSchema }),
    asyncHandler(async (req, res) => {
      const data = await settings.updateSettings(req.user, req.body, requestMeta(req));
      sendSuccess(res, { message: 'Settings updated', data });
    }),
  );
  return router;
}

export function createAuditLogRouter() {
  const router = adminRouter();
  router.get(
    '/',
    validate({ query: listAuditLogsQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await audit.listAuditLogs(req.validated.query);
      sendSuccess(res, { data: items, meta });
    }),
  );
  return router;
}
