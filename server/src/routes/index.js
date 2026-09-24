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
import { requireDatabase } from '../middleware/requireDatabase.js';
import { createAttendanceRouter } from './attendance.routes.js';
import { createAuthRouter } from './auth.routes.js';
import {
  createAssessmentRouter,
  createDashboardRouter,
  createMeetingRouter,
  createNoticeRouter,
  createResultRouter,
} from './feature.routes.js';
import healthRoutes from './health.routes.js';
import { createNotificationRouter } from './notification.routes.js';
import { createUserRouter } from './user.routes.js';

/**
 * Builds the /api router. A factory (not a module singleton) so each app instance gets fresh
 * rate-limit counters and options (e.g. tests toggling self-registration).
 */
export function createApiRouter({ selfRegistrationEnabled, testRouter } = {}) {
  const router = Router();

  router.use('/health', healthRoutes);
  // Everything below needs MongoDB: 503 DATABASE_UNAVAILABLE while it is down.
  router.use(requireDatabase);
  router.use('/auth', createAuthRouter({ selfRegistrationEnabled }));

  // Admin module (all admin-only)
  router.use('/users', createUserRouter());
  router.use('/classes', createClassRouter());
  router.use('/sections', createSectionRouter());
  router.use('/subjects', createSubjectRouter());
  router.use('/sessions', createSessionRouter());
  router.use('/teacher-assignments', createTeacherAssignmentRouter());
  router.use('/settings', createSettingsRouter());
  router.use('/audit-logs', createAuditLogRouter());

  // Attendance & notifications
  router.use('/attendance', createAttendanceRouter());
  router.use('/notifications', createNotificationRouter());

  // Results, meetings, notices, dashboards
  router.use('/assessments', createAssessmentRouter());
  router.use('/results', createResultRouter());
  router.use('/meetings', createMeetingRouter());
  router.use('/notices', createNoticeRouter());
  router.use('/dashboard', createDashboardRouter());

  // Test-only routes (never passed in production code).
  if (testRouter) router.use('/test', testRouter);

  return router;
}
