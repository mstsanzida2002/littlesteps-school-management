// Attendance & notifications:
// - StudentProfile.attendanceAlert { belowThreshold } — low-attendance crossing state.
//   Starts false, so students already below the threshold are warned on their next change.
// - Settings.attendanceBackdateDays (default 7).
// - Notification.dedupeKey partial unique index (one grouped absence notification per day).
export default {
  description:
    'attendanceAlert on profiles, Settings.attendanceBackdateDays, notification dedupe index',
  async up({ db, logger }) {
    const profiles = await db
      .collection('studentprofiles')
      .updateMany(
        { attendanceAlert: { $exists: false } },
        { $set: { attendanceAlert: { belowThreshold: false } } },
      );
    const settings = await db
      .collection('settings')
      .updateMany(
        { attendanceBackdateDays: { $exists: false } },
        { $set: { attendanceBackdateDays: 7 } },
      );
    await db
      .collection('notifications')
      .createIndex(
        { dedupeKey: 1 },
        { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
      );
    logger.info(
      `  profiles: ${profiles.modifiedCount}, settings: ${settings.modifiedCount}, dedupe index ensured`,
    );
  },
};
