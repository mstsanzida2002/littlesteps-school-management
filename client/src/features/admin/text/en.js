/**
 * Admin screens' shared wording, and the guardian login slip, which is printed in English AND
 * Bangla (`slip.en`, `slip.bn`). Staff wording may say "session"/"assessment"; anything a
 * guardian reads (the slip) stays plain.
 */
export default {
  roles: { admin: 'Administrator', teacher: 'Teacher', student: 'Student (guardian)' },
  roleShort: { admin: 'Admin', teacher: 'Teacher', student: 'Student' },
  genders: { male: 'Boy', female: 'Girl', other: 'Other' },
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
  weekdays: {
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
  },
  weekdaysShort: {
    sunday: 'Sun',
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
  },
  tempPassword: {
    label: 'Temporary password',
    generate: 'Generate',
    copy: 'Copy',
    copied: 'Copied',
    shownOnce:
      'Shown only now. Give it to the user (or print the login slip); they must change it at first login.',
  },

  /**
   * The guardian login slip. Printed on paper and handed to the guardian, so each instruction is
   * given in English and Bangla. `{name}` etc. are filled by the component.
   */
  slip: {
    title: 'Login slip',
    print: 'Print login slip',
    printHint: 'Only the slip is printed. The password is not saved anywhere after you close this.',
    close: 'Close',
    en: {
      heading: 'Your child’s LittleSteps account',
      child: 'Child',
      class: 'Class',
      username: 'Username',
      password: 'Temporary password',
      steps: [
        'Open the LittleSteps website on your phone and tap Log in.',
        'Enter the username and the temporary password printed on this slip.',
        'You will be asked to choose a new password straight away. Keep it private.',
      ],
      help: 'Need help? Please contact the school office.',
    },
    bn: {
      heading: 'লিটলস্টেপসে আপনার সন্তানের অ্যাকাউন্ট',
      child: 'শিশু',
      class: 'শ্রেণি',
      username: 'ইউজারনেম',
      password: 'অস্থায়ী পাসওয়ার্ড',
      steps: [
        'আপনার ফোনে লিটলস্টেপস ওয়েবসাইট খুলুন এবং লগ ইন-এ চাপুন।',
        'এই স্লিপে ছাপা ইউজারনেম ও অস্থায়ী পাসওয়ার্ড দিন।',
        'প্রথমবার লগ ইন করার সাথে সাথে একটি নতুন পাসওয়ার্ড বেছে নিতে বলা হবে। পাসওয়ার্ডটি গোপন রাখুন।',
      ],
      help: 'সাহায্য প্রয়োজন হলে অনুগ্রহ করে স্কুল অফিসে যোগাযোগ করুন।',
    },
    note: 'Keep this slip safe until you have changed the password. · পাসওয়ার্ড পরিবর্তন না করা পর্যন্ত এই স্লিপটি নিরাপদে রাখুন।',
  },
};
