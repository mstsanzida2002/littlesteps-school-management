// StudentProfile.nickname (optional, no default): nothing to backfill. Normalises any empty
// strings written before the setter existed, so "no nickname" is always a missing field.
export default {
  description: 'student nickname',
  async up({ db, logger }) {
    const cleared = await db
      .collection('studentprofiles')
      .updateMany({ nickname: { $in: ['', null] } }, { $unset: { nickname: '' } });
    logger.info(`  studentprofiles: ${cleared.modifiedCount} empty nicknames removed`);
  },
};
