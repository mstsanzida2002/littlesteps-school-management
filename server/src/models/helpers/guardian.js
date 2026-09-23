import mongoose from 'mongoose';

import { optionalEmail, phone } from './schemaTypes.js';

export const GUARDIAN_RELATIONS = Object.freeze([
  'father',
  'mother',
  'grandfather',
  'grandmother',
  'uncle',
  'aunt',
  'sibling',
  'other',
]);

/** Guardian contact, used by StudentProfile and by pending self-registrations on User. */
export const guardianSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    relation: { type: String, enum: GUARDIAN_RELATIONS, required: true },
    phone: phone({ required: true }),
    email: optionalEmail(),
    address: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);
