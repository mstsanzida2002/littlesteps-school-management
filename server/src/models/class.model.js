import mongoose from 'mongoose';

import { baseSchemaOptions } from './helpers/schemaTypes.js';

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    // Display/sort order: Playgroup = 1 … KG-2 = 4.
    order: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, maxlength: 300 },
  },
  baseSchemaOptions,
);

classSchema.index({ name: 1 }, { unique: true });

export const Class = mongoose.model('Class', classSchema);
