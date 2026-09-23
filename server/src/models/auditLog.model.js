import mongoose from 'mongoose';

import { ref } from './helpers/schemaTypes.js';

// FR-ADM-09/11: append-only record of critical actions.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: ref('User', { index: true }),
    // Dotted verb, e.g. 'user.create', 'attendance.update', 'result.update'.
    action: { type: String, required: true, trim: true, maxlength: 60 },
    entityType: { type: String, required: true, trim: true, maxlength: 60 },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },
    ip: String,
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

function rejectMutation() {
  throw new Error('AuditLog is append-only');
}

auditLogSchema.pre('save', function blockUpdates() {
  if (!this.isNew) rejectMutation();
});
auditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'],
  rejectMutation,
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
