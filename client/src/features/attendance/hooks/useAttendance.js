import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attendanceApi, attendanceKeys } from '../api/attendanceApi.js';

/** After any attendance change: attendance screens and dashboards are stale. */
function useInvalidateAttendance() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useAttendanceToday() {
  return useQuery({ queryKey: attendanceKeys.today, queryFn: attendanceApi.today });
}

export function useAttendanceSheet({ classId, sectionId, date }) {
  return useQuery({
    queryKey: attendanceKeys.sheet(classId, sectionId, date),
    queryFn: () => attendanceApi.sheet({ classId, sectionId, date }),
    enabled: Boolean(classId && sectionId && date),
  });
}

export function useMarkAttendance() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: attendanceApi.mark, onSuccess: invalidate });
}

export function useEditAttendanceRecord() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: attendanceApi.editRecord, onSuccess: invalidate });
}

export function useEditAttendanceDay() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: attendanceApi.editDay, onSuccess: invalidate });
}

export function useClassAttendanceSummary({ classId, sectionId, from, to, subjectId }) {
  const params = { from, to, subjectId };
  return useQuery({
    queryKey: attendanceKeys.classSummary(classId, sectionId, params),
    queryFn: () => attendanceApi.classSummary({ classId, sectionId, ...params }),
    enabled: Boolean(classId && sectionId),
  });
}

export function useStudentAttendanceSummary(studentId, params = {}) {
  return useQuery({
    queryKey: attendanceKeys.studentSummary(studentId, params),
    queryFn: () => attendanceApi.studentSummary(studentId, params),
    enabled: Boolean(studentId),
  });
}

export function useStudentAttendanceHistory(studentId, params = {}) {
  return useQuery({
    queryKey: attendanceKeys.studentHistory(studentId, params),
    queryFn: () => attendanceApi.studentHistory(studentId, params),
    enabled: Boolean(studentId),
    // Moving between months keeps the last month on screen until the next one arrives.
    placeholderData: keepPreviousData,
  });
}
