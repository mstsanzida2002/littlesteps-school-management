/**
 * One page, two roles: teachers see their own class-sections (their assignments); admins see
 * every class-section with every subject. Shared screens (records, results, meetings) use these
 * instead of useMyAssignments / teacherPaths directly.
 */
import { ROLES } from '../../../config/constants.js';
import { adminPaths, teacherPaths } from '../../../config/paths.js';
import { useClasses, useSections, useSubjects } from '../../admin/hooks/useAdmin.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { useMyAssignments } from './useSchool.js';

export function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === ROLES.ADMIN;
}

/** URL builders for the signed-in role (adminPaths mirrors teacherPaths' keys). */
export function useRolePaths() {
  return useIsAdmin() ? adminPaths : teacherPaths;
}

/**
 * { isAdmin, isPending, isError, error, refetch, isFetching, data: { classSections,
 * wholeClasses } } — the same shape as GET /teacher-assignments/mine, so QueryState works.
 */
export function useClassSectionScope() {
  const isAdmin = useIsAdmin();
  const mine = useMyAssignments({ enabled: !isAdmin });
  const classes = useClasses({ enabled: isAdmin });
  const sections = useSections(undefined, { enabled: isAdmin });
  const subjects = useSubjects({ enabled: isAdmin });
  if (!isAdmin) return { ...mine, isAdmin };

  const queries = [classes, sections, subjects];
  const failed = queries.find((q) => q.isError);
  const pending = queries.some((q) => q.isPending);
  let data;
  if (!failed && !pending) {
    const order = new Map(classes.data.map((c) => [String(c._id), c.order ?? 0]));
    const allSubjects = [...subjects.data]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ _id: s._id, name: s.name, code: s.code, schedule: [] }));
    const classSections = sections.data
      .filter((s) => s.classId)
      .map((s) => ({
        classId: s.classId._id,
        className: s.classId.name,
        sectionId: s._id,
        sectionName: s.name,
        label: `${s.classId.name}-${s.name}`,
        subjects: allSubjects,
      }))
      .sort(
        (a, b) =>
          order.get(String(a.classId)) - order.get(String(b.classId)) ||
          a.sectionName.localeCompare(b.sectionName),
      );
    const wholeClasses = [...classes.data]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((c) => ({ classId: c._id, name: c.name }));
    data = { classSections, wholeClasses };
  }
  return {
    isAdmin,
    data,
    isPending: !failed && pending,
    isError: Boolean(failed),
    error: failed?.error,
    isFetching: queries.some((q) => q.isFetching),
    refetch: () => Promise.all(queries.map((q) => q.refetch())),
  };
}
