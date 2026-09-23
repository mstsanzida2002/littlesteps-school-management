/**
 * Reusable ownership guards for feature routes. Use after authenticate (+ authorize).
 * The same checks are available to services via services/access.service.js.
 *
 *   router.get(
 *     '/classes/:classId/sections/:sectionId/attendance',
 *     authenticate, authorize(ROLES.ADMIN, ROLES.TEACHER),
 *     teacherOwnsAssignment(), controller.list,
 *   );
 *   router.get(
 *     '/attendance/student/:studentId/summary',
 *     authenticate, studentOwnsRecord(), controller.summary,
 *   );
 */
import { canAccessClassSection, canAccessStudent } from '../services/access.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const fromRequest = (req) => ({ ...req.params, ...req.validated?.params, ...req.validated?.query });

/**
 * Admin: always. Teacher: only a class-section (+ subject if given) assigned to them in the
 * active session. Student: never.
 * @param getScope (req) => ({ classId, sectionId, subjectId? }); defaults to route params.
 */
export const teacherOwnsAssignment = (
  getScope = (req) => {
    const { classId, sectionId, subjectId } = fromRequest(req);
    return { classId, sectionId, subjectId };
  },
) =>
  asyncHandler(async (req, res, next) => {
    if (!(await canAccessClassSection(req.user, getScope(req)))) {
      throw ApiError.forbidden('You are not assigned to this class-section');
    }
    next();
  });

/**
 * Admin: always. Student: only their own records. Teacher: only students in a class-section
 * assigned to them in the active session.
 * @param getStudentId (req) => student's User id; defaults to :studentId (or :id).
 */
export const studentOwnsRecord = (
  getStudentId = (req) => {
    const params = fromRequest(req);
    return params.studentId ?? params.id;
  },
) =>
  asyncHandler(async (req, res, next) => {
    if (!(await canAccessStudent(req.user, getStudentId(req)))) {
      throw ApiError.forbidden("You do not have access to this student's records");
    }
    next();
  });
