// Admin module: TeacherAssignment gained `status` (active | ended). Rows created before that have
// no field, and access checks only match status 'active'.
export default {
  description: 'Set TeacherAssignment.status = "active" where missing',
  async up({ db, logger }) {
    const { modifiedCount } = await db
      .collection('teacherassignments')
      .updateMany({ status: { $exists: false } }, { $set: { status: 'active' } });
    logger.info(`  teacher assignments updated: ${modifiedCount}`);
  },
};
