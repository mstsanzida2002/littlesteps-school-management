import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, adminKeys } from '../api/adminApi.js';

const FIVE_MINUTES = 5 * 60 * 1000;

/** After a write: its root and every dashboard (the admin dashboard counts everything). */
function mutationHook(mutationFn, roots) {
  return function useAdminMutation() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn,
      onSuccess: () =>
        Promise.all(
          [...roots, ['dashboard']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        ),
    });
  };
}

// --- Users & registrations ---------------------------------------------------------

export function useUsers(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: adminKeys.userList(params),
    queryFn: () => adminApi.users(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUser(id) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => adminApi.user(id),
    enabled: Boolean(id),
  });
}

/** Suggested roll and the numbers already taken, for a class-section. */
export function useNextRoll({ classId, sectionId }) {
  return useQuery({
    queryKey: adminKeys.nextRoll({ classId, sectionId }),
    queryFn: () => adminApi.nextRoll({ classId, sectionId }),
    enabled: Boolean(classId && sectionId),
  });
}

const USERS = [adminKeys.users, ['attendance'], ['meetings']];
export const useCreateUser = mutationHook(adminApi.createUser, USERS);
export const useUpdateUser = mutationHook(adminApi.updateUser, USERS);
export const useSuspendUser = mutationHook(adminApi.suspendUser, USERS);
export const useReactivateUser = mutationHook(adminApi.reactivateUser, USERS);
export const useResetPassword = mutationHook(adminApi.resetPassword, USERS);
export const useDeleteUser = mutationHook(adminApi.deleteUser, USERS);
export const useApproveRegistration = mutationHook(adminApi.approve, USERS);
export const useRejectRegistration = mutationHook(adminApi.reject, USERS);

// --- Academic structure --------------------------------------------------------------

export const useClasses = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: adminKeys.classes,
    queryFn: adminApi.classes,
    staleTime: FIVE_MINUTES,
    enabled,
  });
export const useSections = (classId, { enabled = true } = {}) =>
  useQuery({
    queryKey: adminKeys.sections(classId),
    queryFn: () => adminApi.sections(classId),
    staleTime: FIVE_MINUTES,
    enabled,
  });
export const useSubjects = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: adminKeys.subjects,
    queryFn: adminApi.subjects,
    staleTime: FIVE_MINUTES,
    enabled,
  });
export const useSessions = () =>
  useQuery({ queryKey: adminKeys.sessions, queryFn: adminApi.sessions });

// Classes and school years change what every screen shows (school settings, today's classes).
const STRUCTURE = [adminKeys.structure, ['school']];
export const useCreateClass = mutationHook(adminApi.createClass, STRUCTURE);
export const useUpdateClass = mutationHook(adminApi.updateClass, STRUCTURE);
export const useDeleteClass = mutationHook(adminApi.deleteClass, STRUCTURE);
export const useCreateSection = mutationHook(adminApi.createSection, STRUCTURE);
export const useUpdateSection = mutationHook(adminApi.updateSection, STRUCTURE);
export const useDeleteSection = mutationHook(adminApi.deleteSection, STRUCTURE);
export const useCreateSubject = mutationHook(adminApi.createSubject, STRUCTURE);
export const useUpdateSubject = mutationHook(adminApi.updateSubject, STRUCTURE);
export const useDeleteSubject = mutationHook(adminApi.deleteSubject, STRUCTURE);
export const useCreateSession = mutationHook(adminApi.createSession, STRUCTURE);
export const useUpdateSession = mutationHook(adminApi.updateSession, STRUCTURE);
export const useDeleteSession = mutationHook(adminApi.deleteSession, STRUCTURE);
// Switching the school year changes everything.
export function useActivateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.activateSession,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// --- Teacher assignments -------------------------------------------------------------

export function useAssignments(params = {}) {
  return useQuery({
    queryKey: adminKeys.assignmentList(params),
    queryFn: () => adminApi.assignments(params),
    placeholderData: keepPreviousData,
  });
}

const ASSIGNMENTS = [adminKeys.assignments, ['school']];
export const useCreateAssignment = mutationHook(adminApi.createAssignment, ASSIGNMENTS);
export const useUpdateSchedule = mutationHook(adminApi.updateSchedule, ASSIGNMENTS);
export const useRemoveAssignment = mutationHook(adminApi.removeAssignment, ASSIGNMENTS);

// --- Settings & audit ------------------------------------------------------------------

export const useAdminSettings = () =>
  useQuery({ queryKey: adminKeys.settings, queryFn: adminApi.settings });
export const useUpdateSettings = mutationHook(adminApi.updateSettings, [
  adminKeys.settings,
  ['school'],
]);

export function useAuditLog(params) {
  return useQuery({
    queryKey: adminKeys.audit(params),
    queryFn: () => adminApi.audit(params),
    placeholderData: keepPreviousData,
  });
}
