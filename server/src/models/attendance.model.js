import mongoose from 'mongoose';

import { ATTENDANCE_STATUS } from '../config/constants.js';
import { baseSchemaOptions, ref, schoolDate } from './helpers/schemaTypes.js';

const attendanceSchema = new mongoose.Schema(
  {
    studentId: ref('User'),
    classId: ref('Class'),
    sectionId: ref('Section'),
    subjectId: ref('Subject'),
    // Deviation from SRS: records are scoped to an academic session.
    sessionId: ref('AcademicSession'),
    teacherId: ref('User'),
    // Asia/Dhaka calendar date, normalized to UTC midnight by utils/date.js (via setter).
    date: schoolDate(),
    status: { type: String, enum: Object.values(ATTENDANCE_STATUS), required: true },
    markedAt: { type: Date, default: Date.now },
  },
  baseSchemaOptions,
);

// FR-TCH-04: one record per student per subject per day.
attendanceSchema.index({ studentId: 1, subjectId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ classId: 1, sectionId: 1, subjectId: 1, date: 1 });
attendanceSchema.index({ studentId: 1, sessionId: 1, date: 1 });
attendanceSchema.index({ sessionId: 1, date: 1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
