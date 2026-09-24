// Results, meetings, notices:
// - Assessment.mode (existing → 'marks'); Result.attendance (existing → 'present')
// - Notice.status (existing notices were live → 'published', publishedAt kept/filled)
// - New indexes for dashboards/listing queries.
export default {
  description: 'assessment mode, result attendance, notice status, dashboard indexes',
  async up({ db, logger }) {
    const assessments = await db
      .collection('assessments')
      .updateMany({ mode: { $exists: false } }, { $set: { mode: 'marks' } });
    const results = await db
      .collection('results')
      .updateMany({ attendance: { $exists: false } }, { $set: { attendance: 'present' } });
    const notices = await db
      .collection('notices')
      .updateMany({ status: { $exists: false } }, [
        { $set: { status: 'published', publishedAt: { $ifNull: ['$publishedAt', '$createdAt'] } } },
      ]);

    await db.collection('assessments').createIndex({
      classId: 1,
      sectionId: 1,
      subjectId: 1,
      sessionId: 1,
      status: 1,
      date: -1,
    });
    await db.collection('results').createIndex({ studentId: 1, updatedAt: -1 });
    await db.collection('notices').createIndex({ status: 1, audience: 1, publishedAt: -1 });
    await db.collection('meetings').createIndex({ organizerId: 1, dateTime: -1 });
    await db.collection('meetings').createIndex({ status: 1, dateTime: 1 });

    logger.info(
      `  assessments: ${assessments.modifiedCount}, results: ${results.modifiedCount}, ` +
        `notices: ${notices.modifiedCount}, indexes ensured`,
    );
  },
};
