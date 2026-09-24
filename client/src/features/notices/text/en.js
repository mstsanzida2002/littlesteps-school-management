/** Notices text; guardians get their own wording. */
export default {
  title: 'Notices',
  description: 'News and reminders from the school.',
  guardianDescription: 'News and reminders from LittleSteps for your family.',
  loading: 'Loading notices',
  pinned: 'Pinned',
  audience: { all: 'everyone', teachers: 'teachers', students: 'guardians' },
  meta: (date, audience) => `${date} · For ${audience}`,
  empty: 'No notices right now',
  emptyHint: 'New notices from the school will show here.',
};
