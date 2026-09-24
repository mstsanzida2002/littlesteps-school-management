import { useQuery } from '@tanstack/react-query';

import { schoolApi, schoolKeys } from '../api/schoolApi.js';

const FIVE_MINUTES = 5 * 60 * 1000;

/** School rules, today's Dhaka date and the active session. Rarely changes. */
export function useSchoolSettings() {
  return useQuery({
    queryKey: schoolKeys.settings,
    queryFn: schoolApi.settings,
    staleTime: FIVE_MINUTES,
  });
}

/** The teacher's own class-sections and subjects (with the timetable). */
export function useMyAssignments({ enabled = true } = {}) {
  return useQuery({
    queryKey: schoolKeys.myAssignments,
    queryFn: schoolApi.myAssignments,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

/** Find one of the teacher's class-sections by ids. */
export const findClassSection = (assignments, classId, sectionId) =>
  assignments?.classSections.find(
    (cs) => String(cs.classId) === String(classId) && String(cs.sectionId) === String(sectionId),
  );
