import { Router } from 'express';

import {
  createAuditLogRouter,
  createClassRouter,
  createSectionRouter,
  createSessionRouter,
  createSettingsRouter,
  createSubjectRouter,
  createTeacherAssignmentRouter,
} from './admin.routes.js';
import { signalsDataChange } from '../middleware/dataChanged.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { createAttendanceRouter } from './attendance.routes.js';
import { createAuthRouter } from './auth.routes.js';
import {
  createAssessmentRouter,
  createDashboardRouter,
  createMeetingRouter,
  createMyAssignmentsRouter,
  createSchoolSettingsRouter,
  createNoticeRouter,
  createResultRouter,
  createStudentRouter,
} from './feature.routes.js';
import healthRoutes from './health.routes.js';
import { createNotificationRouter } from './notification.routes.js';
import { createUserRouter } from './user.routes.js';

/**
 * Builds the /api router. A factory (not a module singleton) so each app instance gets fresh
 * rate-limit counters and options (e.g. tests toggling self-registration).
 */
export function createApiRouter({ selfRegistrationEnabled, rateLimits, testRouter } = {}) {
  const router = Router();

  router.use('/health', healthRoutes);
  // Everything below needs MongoDB: 503 DATABASE_UNAVAILABLE while it is down.
  router.use(requireDatabase);
  router.use('/auth', createAuthRouter({ selfRegistrationEnabled, rateLimits }));

  // Admin module (all admin-only)
  // Non-admin lookups first: the admin routers below reject everyone else with 403.
  router.use('/settings/school', createSchoolSettingsRouter());
  router.use('/teacher-assignments/mine', createMyAssignmentsRouter());

  // Successful writes send "data:changed" (open admin screens and affected teachers refresh).
  router.use('/users', signalsDataChange('users'), createUserRouter());
  router.use('/classes', signalsDataChange('structure'), createClassRouter());
  router.use('/sections', signalsDataChange('structure'), createSectionRouter());
  router.use('/subjects', signalsDataChange('structure'), createSubjectRouter());
  router.use('/sessions', signalsDataChange('structure'), createSessionRouter());
  router.use(
    '/teacher-assignments',
    signalsDataChange('assignments'),
    createTeacherAssignmentRouter(),
  );
  router.use('/settings', signalsDataChange('settings'), createSettingsRouter());
  router.use('/audit-logs', createAuditLogRouter());

  // Attendance & notifications
  router.use('/attendance', createAttendanceRouter());
  router.use('/notifications', createNotificationRouter());

  // Results, meetings, notices, dashboards
  router.use('/assessments', createAssessmentRouter());
  router.use('/results', createResultRouter());
  router.use('/meetings', createMeetingRouter());
  router.use('/notices', signalsDataChange('notices'), createNoticeRouter());
  router.use('/dashboard', createDashboardRouter());
  router.use('/students', createStudentRouter());

  // Test-only routes (never passed in production code).
  if (testRouter) router.use('/test', testRouter);

  return router;
}
