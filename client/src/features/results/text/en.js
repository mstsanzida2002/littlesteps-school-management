/** Guardian-facing results text. Parents read "test", never "assessment". */
export default {
  title: 'Results',
  description: (name) => `${name}'s published tests this school year.`,
  loading: 'Loading results',
  views: { label: 'Show results', subject: 'By subject', test: 'By test' },
  empty: {
    title: 'No results yet',
    description: (name) =>
      `When a teacher publishes a test, ${name}'s result will appear here. You will get a notification too.`,
  },
  // Assessment.type (server ASSESSMENT_TYPES)
  testTypes: {
    class_test: 'Class test',
    mid_term: 'Mid-term test',
    final: 'Final test',
    other: 'Test',
  },
  marks: (marks, total) => `${marks} out of ${total}`,
  percent: (percent) => `${percent}`,
  grade: 'Grade',
  absent: 'Absent',
  excused: 'Excused',
  absentNote: (name) => `${name} was absent for this test.`,
  excusedNote: (name) => `${name} was excused from this test.`,
  remarksLabel: "Teacher's remarks",
  noRemarks: 'No remarks for this test.',
  seeTest: 'See this test',
  testsInSubject: (count) => (count === 1 ? '1 test' : `${count} tests`),
  back: 'All results',
  publishedOn: (date) => `Published ${date}`,
  heldOn: (date) => `Held on ${date}`,
  scale: {
    open: 'What do the grades mean?',
    title: 'What the grades mean',
    intro:
      "Grades for this test come from the percentage of marks. This is the school's scale saved when the test was published.",
    gradeOnly: "The teacher gave a grade for this test. This is the school's scale for it.",
    columns: { grade: 'Grade', range: 'Percentage' },
    range: (min, max) => (max == null ? `${min}% and above` : `${min}% up to ${max}%`),
    thisTest: 'This test',
    close: 'Close',
  },
};
