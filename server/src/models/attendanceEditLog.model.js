import mongoose from 'mongoose';

import { ATTENDANCE_STATUS } from '../config/constants.js';
import { ref } from './helpers/schemaTypes.js';

const STATUSES = Object.values(ATTENDANCE_STATUS);

// FR-TCH-05: immutable history of attendance corrections.
const attendanceEditLogSchema = new mongoose.Schema(
  {
    attendanceId: ref('Attendance'),
    // Denormalized so a student's correction history is queryable without a join.
    studentId: ref('User', { index: true }),
    oldStatus: { type: String, enum: STATUSES, required: true },
    newStatus: { type: String, enum: STATUSES, required: true },
    editedBy: ref('User'),
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    editedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

attendanceEditLogSchema.index({ attendanceId: 1, editedAt: -1 });

export const AttendanceEditLog = mongoose.model('AttendanceEditLog', attendanceEditLogSchema);
