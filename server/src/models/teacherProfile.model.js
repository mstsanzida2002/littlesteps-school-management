import mongoose from 'mongoose';

import { baseSchemaOptions, ref, schoolDate } from './helpers/schemaTypes.js';

const teacherProfileSchema = new mongoose.Schema(
  {
    userId: ref('User'),
    employeeId: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    qualification: { type: String, trim: true, maxlength: 200 },
    joiningDate: schoolDate({ required: false }),
  },
  baseSchemaOptions,
);

teacherProfileSchema.index({ userId: 1 }, { unique: true });
teacherProfileSchema.index({ employeeId: 1 }, { unique: true });

export const TeacherProfile = mongoose.model('TeacherProfile', teacherProfileSchema);
