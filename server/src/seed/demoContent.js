/**
 * Demo results, meetings and notices for the seed, so the screens have data.
 * Written directly with the models (no services), but following the same rules: published
 * assessments carry a grading-scale snapshot, invitations/notices create notifications.
 */
import { MEETING_STATUS } from '../models/meeting.model.js';
import { Assessment, Meeting, Notice, Notification, Result } from '../models/index.js';
import { gradeFor, percentOf, snapshotScale } from '../services/grading.js';
import { addDays, atSchoolTime, formatSchoolDateTime, todaySchoolDate } from '../utils/date.js';

const BATCH = 5_000;

/** insertMany in sequential batches (the free Atlas tier throttles big bursts). */
export async function insertInBatches(Model, docs) {
  for (let i = 0; i < docs.length; i += BATCH) {
    await Model.insertMany(docs.slice(i, i + BATCH), { ordered: false });
  }
}

/**
 * @param ctx { admin, teachers, classes, sections, subjects, session, settings, students,
 *   schoolDays, random, large }  — students: [{ user, classIdx, sectionId, guardianEmail }]
 */
export async function seedDemoContent(ctx) {
  const {
    admin,
    teachers,
    classes,
    sections,
    subjects,
    session,
    settings,
    students,
    schoolDays,
    random,
    large,
  } = ctx;
  const subject = (name) => subjects.find((s) => s.name === name);
  const scale = snapshotScale(settings.gradingScale);
  const now = new Date();
  const counts = { assessments: 0, results: 0, meetings: 0, notices: 0, notifications: 0 };
  const notifications = [];

  // --- Assessments: per class-section, English published (marks), Drawing published (remarks),
  // Math draft (half entered).
  const results = [];
  const assessments = [];
  const REMARKS = [
    'Holds the crayon well; colours inside the lines.',
    'Needs practice with fine motor skills.',
    'Very creative use of colours!',
    'Enjoys drawing animals; keep encouraging.',
  ];
  for (const section of sections) {
    const classIdx = classes.findIndex((c) => c._id.equals(section.classId));
    const teacher = teachers[classIdx];
    const roster = students.filter((s) => s.sectionId.equals(section._id));
    const base = {
      classId: section.classId,
      sectionId: section._id,
      sessionId: session._id,
      createdBy: teacher._id,
    };

    const english = new Assessment({
      ...base,
      name: 'Class Test 1',
      type: 'class_test',
      mode: 'marks',
      subjectId: subject('English')._id,
      totalMarks: 20,
      date: schoolDays.at(-5),
      status: 'published',
      publishedAt: now,
      publishedBy: teacher._id,
      gradingScale: scale,
    });
    const drawing = new Assessment({
      ...base,
      name: 'Drawing portfolio',
      type: 'other',
      mode: 'remarks',
      subjectId: subject('Drawing')._id,
      date: schoolDays.at(-10),
      status: 'published',
      publishedAt: now,
      publishedBy: teacher._id,
      gradingScale: scale,
    });
    const math = new Assessment({
      ...base,
      name: 'Class Test 2',
      type: 'class_test',
      mode: 'marks',
      subjectId: subject('Math')._id,
      totalMarks: 25,
      date: schoolDays.at(-1),
    });
    assessments.push(english, drawing, math);

    roster.forEach((s, i) => {
      const absent = random() < 0.08;
      const marks = Math.round((10 + random() * 10) * 2) / 2; // 10–20, halves
      const percent = percentOf(marks, 20);
      const en = absent
        ? { attendance: 'absent' }
        : { attendance: 'present', marksObtained: marks, percent, grade: gradeFor(percent, scale) };
      results.push({
        assessmentId: english._id,
        studentId: s.user._id,
        updatedBy: teacher._id,
        gradeOverridden: false,
        ...en,
      });
      notifications.push({
        recipientId: s.user._id,
        type: 'result_published',
        title: 'Result published: Class Test 1',
        message: absent
          ? 'Class Test 1 (English): marked absent.'
          : `Class Test 1 (English): ${marks}/20, grade ${en.grade}.`,
        relatedEntity: { kind: 'Assessment', id: english._id },
      });
      const remark = REMARKS[i % REMARKS.length];
      results.push({
        assessmentId: drawing._id,
        studentId: s.user._id,
        updatedBy: teacher._id,
        attendance: 'present',
        remarks: remark,
      });
      notifications.push({
        recipientId: s.user._id,
        type: 'result_published',
        title: 'Result published: Drawing portfolio',
        message: `Drawing portfolio (Drawing): "${remark}".`,
        relatedEntity: { kind: 'Assessment', id: drawing._id },
      });
      if (i % 2 === 0) {
        const m = Math.round(12 + random() * 13);
        const p = percentOf(m, 25);
        results.push({
          assessmentId: math._id,
          studentId: s.user._id,
          updatedBy: teacher._id,
          attendance: 'present',
          marksObtained: m,
          percent: p,
          grade: gradeFor(p, settings.gradingScale),
        });
      }
    });
  }
  await insertInBatches(
    Assessment,
    assessments.map((a) => a.toObject()),
  );
  await insertInBatches(Result, results);
  counts.assessments = assessments.length;
  counts.results = results.length;

  // --- Meetings
  const today = todaySchoolDate();
  const at = (days, time) => atSchoolTime(addDays(today, days), time);
  const allStudentIds = students.map((s) => s.user._id);
  const inSection = (sectionId) =>
    students.filter((s) => s.sectionId.equals(sectionId)).map((s) => s.user._id);
  const inClass = (classId) =>
    students.filter((s) => s.classId.equals(classId)).map((s) => s.user._id);
  const sectionOf = (classIdx, name) =>
    sections.find((s) => s.classId.equals(classes[classIdx]._id) && s.name === name);

  const meetingDocs = [
    {
      title: 'Parent-teacher meeting (all classes)',
      agenda: 'Mid-year progress, attendance and upcoming events.',
      type: 'parent_teacher',
      dateTime: at(7, '10:00'),
      durationMinutes: 90,
      venue: 'School hall',
      organizerId: admin._id,
      invite: { target: 'all' },
      inviteeStudentIds: allStudentIds,
      inviteeTeacherIds: teachers.map((t) => t._id),
    },
    {
      title: 'Playgroup-A guardians: settling-in chat',
      agenda: 'How the children are settling in; routines at home.',
      type: 'parent_teacher',
      dateTime: at(3, '11:00'),
      durationMinutes: 30,
      onlineLink: 'https://meet.google.com/abc-defg-hij',
      organizerId: teachers[0]._id,
      invite: { target: 'sections', sectionIds: [sectionOf(0, 'A')._id] },
      inviteeStudentIds: inSection(sectionOf(0, 'A')._id),
    },
    {
      title: 'KG-2 orientation for next year',
      type: 'orientation',
      dateTime: at(10, '09:30'),
      durationMinutes: 60,
      venue: 'KG-2 classroom',
      organizerId: admin._id,
      invite: { target: 'classes', classIds: [classes[3]._id] },
      inviteeStudentIds: inClass(classes[3]._id),
      status: MEETING_STATUS.CANCELLED,
      cancelledAt: now,
      cancelledBy: admin._id,
      cancelReason: 'Rescheduled after the exams',
    },
  ];
  if (large) {
    classes.forEach((cls, i) => {
      meetingDocs.push({
        title: `${cls.name} class meeting`,
        type: 'parent_teacher',
        dateTime: at(4 + i, '12:00'),
        durationMinutes: 45,
        venue: `${cls.name} classroom`,
        organizerId: teachers[i]._id,
        invite: { target: 'classes', classIds: [cls._id] },
        inviteeStudentIds: inClass(cls._id),
      });
    });
    for (const name of ['B']) {
      classes.slice(0, 3).forEach((cls, i) => {
        const sec = sectionOf(i, name);
        meetingDocs.push({
          title: `${cls.name}-${name} art day`,
          type: 'event',
          dateTime: at(12 + i, '10:30'),
          venue: 'Art room',
          organizerId: teachers[i]._id,
          invite: { target: 'sections', sectionIds: [sec._id] },
          inviteeStudentIds: inSection(sec._id),
        });
      });
    }
  }
  const meetings = meetingDocs.map((m) => {
    const responses =
      m.status === MEETING_STATUS.CANCELLED
        ? []
        : m.inviteeStudentIds
            .filter(() => random() < 0.35)
            .map((studentId) => ({
              studentId,
              response: random() < 0.8 ? 'will_attend' : 'cannot_attend',
              respondedAt: now,
            }));
    return new Meeting({ sessionId: session._id, responses, ...m });
  });
  await Meeting.insertMany(meetings.map((m) => m.toObject()));
  counts.meetings = meetings.length;
  for (const m of meetings) {
    const when = formatSchoolDateTime(m.dateTime);
    for (const recipientId of [...m.inviteeStudentIds, ...(m.inviteeTeacherIds ?? [])]) {
      notifications.push({
        recipientId,
        type: 'meeting_invite',
        title: `Meeting invitation: ${m.title}`,
        message: `You are invited to "${m.title}" on ${when} (${m.venue ?? 'online'}).`,
        relatedEntity: { kind: 'Meeting', id: m._id },
      });
      if (m.status === MEETING_STATUS.CANCELLED) {
        notifications.push({
          recipientId,
          type: 'meeting_cancelled',
          title: `Meeting cancelled: ${m.title}`,
          message: `"${m.title}" on ${when} was cancelled. Reason: ${m.cancelReason}`,
          relatedEntity: { kind: 'Meeting', id: m._id },
        });
      }
    }
  }

  // --- Notices
  const everyone = [admin, ...teachers].map((u) => u._id).concat(allStudentIds);
  const noticeDocs = [
    {
      title: 'Winter vacation schedule',
      body: 'School will be closed from 20 December to 1 January. Classes resume on 2 January.',
      audience: 'all',
      isPinned: true,
      recipients: everyone,
    },
    {
      title: 'Staff meeting notes',
      body: 'Please update the timetable for any unscheduled subjects before Sunday.',
      audience: 'teachers',
      recipients: teachers.map((t) => t._id),
    },
    {
      title: 'Sports day registration (closed)',
      body: 'Registration for sports day has closed. Thank you!',
      audience: 'all',
      expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      recipients: everyone,
    },
  ];
  if (large) {
    noticeDocs.push(
      {
        title: 'Uniform reminder',
        body: 'White uniforms on Sundays and Tuesdays.',
        audience: 'students',
        recipients: allStudentIds,
      },
      {
        title: 'Draft: picnic plan',
        body: 'Details to follow.',
        audience: 'all',
        draft: true,
        recipients: [],
      },
    );
  }
  for (const { recipients, draft, ...n } of noticeDocs) {
    const [notice] = await Notice.insertMany([
      {
        ...n,
        status: draft ? 'draft' : 'published',
        createdBy: admin._id,
        ...(!draft && { publishedBy: admin._id, publishedAt: now }),
      },
    ]);
    for (const recipientId of recipients) {
      notifications.push({
        recipientId,
        type: 'notice',
        title: `Notice: ${notice.title}`,
        message: notice.body,
        relatedEntity: { kind: 'Notice', id: notice._id },
      });
    }
  }
  counts.notices = noticeDocs.length;

  await insertInBatches(Notification, notifications);
  counts.notifications = notifications.length;
  return counts;
}
