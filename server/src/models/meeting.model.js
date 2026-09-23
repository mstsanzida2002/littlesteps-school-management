import mongoose from 'mongoose';

import { baseSchemaOptions, ref } from './helpers/schemaTypes.js';

const { ObjectId } = mongoose.Schema.Types;

export const MEETING_TYPES = Object.freeze(['parent_teacher', 'orientation', 'event', 'other']);
export const MEETING_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
});
export const INVITE_TARGETS = Object.freeze(['students', 'sections', 'classes', 'all']);
export const MEETING_RESPONSES = Object.freeze(['will_attend', 'cannot_attend']);

// What the organizer selected. Kept for display/editing; the resolved lists below are
// what queries and notifications use.
const inviteSchema = new mongoose.Schema(
  {
    target: { type: String, enum: INVITE_TARGETS, required: true },
    studentIds: [{ type: ObjectId, ref: 'User' }],
    sectionIds: [{ type: ObjectId, ref: 'Section' }],
    classIds: [{ type: ObjectId, ref: 'Class' }],
  },
  { _id: false },
);

const responseSchema = new mongoose.Schema(
  {
    studentId: ref('User'),
    response: { type: String, enum: MEETING_RESPONSES, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    respondedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    agenda: { type: String, trim: true, maxlength: 2000 },
    type: { type: String, enum: MEETING_TYPES, required: true },
    // A real instant (not a calendar date); display in Asia/Dhaka.
    dateTime: { type: Date, required: true },
    durationMinutes: { type: Number, min: 5, max: 600 },
    venue: { type: String, trim: true, maxlength: 200 },
    onlineLink: { type: String, trim: true, maxlength: 500 },
    organizerId: ref('User', { index: true }),
    sessionId: ref('AcademicSession'),
    status: {
      type: String,
      enum: Object.values(MEETING_STATUS),
      default: MEETING_STATUS.SCHEDULED,
    },
    invite: { type: inviteSchema, required: true },
    // Resolved from `invite` by the meeting service when the meeting is created/updated.
    inviteeStudentIds: [{ type: ObjectId, ref: 'User' }],
    // Teachers invited by the admin (FR-TCH-14).
    inviteeTeacherIds: [{ type: ObjectId, ref: 'User' }],
    responses: { type: [responseSchema], default: [] },
  },
  baseSchemaOptions,
);

const TARGET_LIST = { students: 'studentIds', sections: 'sectionIds', classes: 'classIds' };

meetingSchema.pre('validate', function validateMeeting() {
  if (!this.venue && !this.onlineLink) {
    this.invalidate('venue', 'Provide a venue or an online link');
  }
  const listField = TARGET_LIST[this.invite?.target];
  if (listField && !this.invite[listField]?.length) {
    this.invalidate(
      `invite.${listField}`,
      `Select at least one for target "${this.invite.target}"`,
    );
  }
});

meetingSchema.index({ inviteeStudentIds: 1, dateTime: -1 });
meetingSchema.index({ inviteeTeacherIds: 1, dateTime: -1 });
meetingSchema.index({ dateTime: -1 });

export const Meeting = mongoose.model('Meeting', meetingSchema);
