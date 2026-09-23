import mongoose from 'mongoose';

import { baseSchemaOptions, schoolDate } from './helpers/schemaTypes.js';

const academicSessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 20 },
    startDate: schoolDate(),
    endDate: {
      ...schoolDate(),
      validate: [
        schoolDate().validate,
        {
          validator(value) {
            return !this.startDate || !value || value > this.startDate;
          },
          message: 'endDate must be after startDate',
        },
      ],
    },
    isActive: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

academicSessionSchema.index({ name: 1 }, { unique: true });
// Only one session may be active: the index only contains active sessions.
academicSessionSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export const AcademicSession = mongoose.model('AcademicSession', academicSessionSchema);
