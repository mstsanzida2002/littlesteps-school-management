import mongoose from 'mongoose';

import { ASSIGNMENT_STATUS, WEEKDAYS } from '../config/constants.js';
import { baseSchemaOptions, ref, TIME_HHMM_RE } from './helpers/schemaTypes.js';

const scheduleSlotSchema = new mongoose.Schema(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    startTime: { type: String, required: true, match: [TIME_HHMM_RE, 'Use HH:mm'] },
    endTime: {
      type: String,
      required: true,
      match: [TIME_HHMM_RE, 'Use HH:mm'],
      validate: {
        // 'HH:mm' strings compare correctly as text.
        validator(value) {
          return !this.startTime || value > this.startTime;
        },
        message: 'endTime must be after startTime',
      },
    },
  },
  { _id: false },
);

const teacherAssignmentSchema = new mongoose.Schema(
  {
    teacherId: ref('User'),
    classId: ref('Class'),
    sectionId: ref('Section'),
    subjectId: ref('Subject'),
    sessionId: ref('AcademicSession'),
    // Weekly timetable for this class-section-subject (FR-TCH-01, "today's classes").
    schedule: { type: [scheduleSlotSchema], default: [] },
    // Removing an assignment that already has attendance/assessments ends it instead of deleting
    // it. Only active assignments grant access (services/access.service.js).
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.ACTIVE,
    },
    endedAt: Date,
    endedBy: ref('User', { required: false }),
  },
  baseSchemaOptions,
);

teacherAssignmentSchema.index(
  { teacherId: 1, classId: 1, sectionId: 1, subjectId: 1, sessionId: 1 },
  { unique: true },
);
teacherAssignmentSchema.index({ sessionId: 1, classId: 1, sectionId: 1 });
teacherAssignmentSchema.index({ sessionId: 1, teacherId: 1, status: 1 });

export const TeacherAssignment = mongoose.model('TeacherAssignment', teacherAssignmentSchema);
