/**
 * Guardian-facing text for the student area: home, profile, switching child, not found.
 * Plain, warm words for parents: "test" (not assessment), "school year" (not session), and the
 * child by name. Functions take already-formatted values (dates, percentages).
 */
export default {
  dashboard: {
    title: (name) => `${name} at a glance`,
    description: 'Attendance, results, meetings and news from LittleSteps.',
    loading: 'Loading the home page',
    attendanceTitle: 'Attendance',
    seeCalendar: 'See the calendar',
    monthlyTitle: 'Month by month',
    alertsTitle: 'Absence alerts',
    // Alerts are absence notifications, which older records may not have: never claim "no absences".
    alertsEmpty: () => 'No absence alerts right now.',
    resultsTitle: 'Latest results',
    resultsEmpty: (name) => `No results yet. ${name}'s tests will show here once published.`,
    allResults: 'All results',
    meetingsTitle: 'Meeting invitations',
    meetingsEmpty: 'No upcoming meetings.',
    allMeetings: 'All meetings',
    noticesTitle: 'Pinned notices',
    allNotices: 'All notices',
    notificationsTitle: 'New for you',
    notificationsEmpty: 'You are all caught up.',
    allNotifications: 'All notifications',
    unreadCount: (count) => (count === 1 ? '1 unread' : `${count} unread`),
  },
  profile: {
    title: 'Profile',
    description: (name) => `${name}'s details at LittleSteps.`,
    childTitle: 'Child',
    fields: {
      name: 'Full name',
      nickname: 'Called at home',
      classSection: 'Class',
      rollNo: 'Roll number',
      dateOfBirth: 'Date of birth',
      admissionDate: 'Joined LittleSteps',
      schoolYear: 'School year',
      username: 'Username',
    },
    teachersTitle: 'Teachers',
    teachersDescription: (name) => `Who teaches ${name} each subject this school year.`,
    teachersEmpty: 'Teachers have not been assigned yet.',
    guardianTitle: 'Guardian on file',
    guardianFields: {
      name: 'Name',
      relation: 'Relation',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
    },
    // StudentProfile.guardian.relation (server GUARDIAN_RELATIONS)
    relations: {
      father: 'Father',
      mother: 'Mother',
      grandfather: 'Grandfather',
      grandmother: 'Grandmother',
      uncle: 'Uncle',
      aunt: 'Aunt',
      sibling: 'Brother or sister',
      guardian: 'Guardian',
      other: 'Other',
    },
    notGiven: 'Not given',
    updateNote: 'To change these details, please contact the school office.',
    accountTitle: 'This account',
    changePassword: 'Change password',
    switchChild: 'Switch child',
    switchChildHint: 'Log out and choose another child on this phone.',
  },
  switchChild: {
    action: 'Switch child',
    choose: 'Choose a child',
    chooseHint: 'Tap a name, then enter the password.',
    chip: (name, username) => (name ? `${name} (${username})` : username),
    remove: (label) => `Remove ${label} from this device`,
    removed: (label) => `${label} removed from this device`,
  },
  notFound: {
    title: "We couldn't find that page",
    description:
      'The link may be old, or the page may belong to another child. Nothing else has been shown.',
    home: 'Go to the home page',
  },
};
