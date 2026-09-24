/**
 * Static demo data for the development seed. Names are fictional.
 */

export const PASSWORDS = Object.freeze({
  admin: 'Admin@1234',
  teacher: 'Teacher@1234',
  student: 'Student@1234',
});

export const ADMIN = {
  name: 'Mohammad Kamal Hossain',
  username: 'admin',
  email: 'admin@littlesteps.test',
  phone: '01711000001',
};

export const CLASSES = [
  { name: 'Playgroup', code: 'pg', order: 1, age: 3 },
  { name: 'Nursery', code: 'nur', order: 2, age: 4 },
  { name: 'KG-1', code: 'kg1', order: 3, age: 5 },
  { name: 'KG-2', code: 'kg2', order: 4, age: 6 },
];

export const SECTION_NAMES = ['A', 'B'];

// Morning shift (A) and day shift (B), so one class teacher can take both sections.
export const SHIFT_START = { A: '08:00', B: '10:45' };
export const PERIOD_MINUTES = 30;
export const SCHOOL_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

export const SUBJECTS = [
  { name: 'English', code: 'ENG' },
  { name: 'Bangla', code: 'BAN' },
  { name: 'Math', code: 'MATH' },
  { name: 'Drawing', code: 'DRW' },
  { name: 'Rhymes', code: 'RHY' },
];

// One class teacher per class (index matches CLASSES).
export const TEACHERS = [
  {
    name: 'Farhana Akter',
    username: 'farhana.akter',
    phone: '01712000101',
    qualification: 'B.Ed (Early Childhood Education)',
  },
  {
    name: 'Nasrin Sultana',
    username: 'nasrin.sultana',
    phone: '01819000102',
    qualification: 'M.A. in Bangla, B.Ed',
  },
  {
    name: 'Tahmina Rahman',
    username: 'tahmina.rahman',
    phone: '01913000103',
    qualification: 'B.A. (Hons) in English',
  },
  {
    name: 'Shirin Akhter',
    username: 'shirin.akhter',
    phone: '01556000104',
    qualification: 'M.Sc. in Mathematics, B.Ed',
  },
];

/**
 * 40 students = 4 classes × 2 sections × 5. Order: Playgroup A (5), Playgroup B (5), Nursery A…
 * `father`/`mother` are the guardians; `guardian` says who is the primary contact.
 */
export const STUDENTS = [
  // Playgroup A
  {
    name: 'Ayaan Rahman',
    gender: 'male',
    father: 'Md. Mizanur Rahman',
    mother: 'Sharmin Akter',
    guardian: 'mother',
  },
  {
    name: 'Nusrat Jahan Mim',
    gender: 'female',
    father: 'Md. Jahangir Alam',
    mother: 'Rokeya Begum',
    guardian: 'father',
  },
  {
    name: 'Arham Hossain',
    gender: 'male',
    father: 'Md. Delwar Hossain',
    mother: 'Nazma Khatun',
    guardian: 'mother',
  },
  {
    name: 'Raisa Islam',
    gender: 'female',
    father: 'Md. Rafiqul Islam',
    mother: 'Salma Islam',
    guardian: 'mother',
  },
  {
    name: 'Zayan Chowdhury',
    gender: 'male',
    father: 'Imran Chowdhury',
    mother: 'Farzana Chowdhury',
    guardian: 'father',
  },
  // Playgroup B
  {
    name: 'Anaya Karim',
    gender: 'female',
    father: 'Md. Abdul Karim',
    mother: 'Parvin Akter',
    guardian: 'mother',
  },
  {
    name: 'Rayan Ahmed',
    gender: 'male',
    father: 'Sohel Ahmed',
    mother: 'Tania Ahmed',
    guardian: 'father',
  },
  {
    name: 'Aroshi Das',
    gender: 'female',
    father: 'Sujit Kumar Das',
    mother: 'Mitali Das',
    guardian: 'mother',
  },
  {
    name: 'Ibrahim Sarkar',
    gender: 'male',
    father: 'Md. Habibur Sarkar',
    mother: 'Laily Begum',
    guardian: 'father',
  },
  {
    name: 'Mahira Haque',
    gender: 'female',
    father: 'Md. Enamul Haque',
    mother: 'Sabina Yasmin',
    guardian: 'mother',
  },
  // Nursery A
  {
    name: 'Aariz Mahmud',
    gender: 'male',
    father: 'Khaled Mahmud',
    mother: 'Nasima Akter',
    guardian: 'mother',
  },
  {
    name: 'Tasnim Ara Oishi',
    gender: 'female',
    father: 'Md. Shahidul Islam',
    mother: 'Kohinoor Begum',
    guardian: 'mother',
  },
  {
    name: 'Rafsan Kabir',
    gender: 'male',
    father: 'Humayun Kabir',
    mother: 'Shirin Sultana',
    guardian: 'father',
  },
  {
    name: 'Sadia Afrin',
    gender: 'female',
    father: 'Md. Anwar Hossain',
    mother: 'Monira Begum',
    guardian: 'mother',
  },
  {
    name: 'Ahnaf Tahmid',
    gender: 'male',
    father: 'Md. Tofazzal Hossain',
    mother: 'Rehana Parvin',
    guardian: 'mother',
  },
  // Nursery B
  {
    name: 'Anika Tabassum',
    gender: 'female',
    father: 'Md. Mahbubur Rahman',
    mother: 'Jesmin Akter',
    guardian: 'mother',
  },
  {
    name: 'Ishraq Hasan',
    gender: 'male',
    father: 'Kamrul Hasan',
    mother: 'Sumaiya Hasan',
    guardian: 'father',
  },
  {
    name: 'Prapti Saha',
    gender: 'female',
    father: 'Pradip Saha',
    mother: 'Rina Saha',
    guardian: 'mother',
  },
  {
    name: 'Samin Yasar',
    gender: 'male',
    father: 'Md. Yasin Ali',
    mother: 'Fatema Khatun',
    guardian: 'father',
  },
  {
    name: 'Lamia Siddiqua',
    gender: 'female',
    father: 'Abu Bakar Siddique',
    mother: 'Hosne Ara',
    guardian: 'mother',
  },
  // KG-1 A
  {
    name: 'Arian Mridha',
    gender: 'male',
    father: 'Md. Babul Mridha',
    mother: 'Asma Begum',
    guardian: 'mother',
  },
  {
    name: 'Maliha Tasnim',
    gender: 'female',
    father: 'Md. Nurul Amin',
    mother: 'Shahnaz Parvin',
    guardian: 'mother',
  },
  {
    name: 'Nafis Iqbal',
    gender: 'male',
    father: 'Javed Iqbal',
    mother: 'Nusrat Iqbal',
    guardian: 'father',
  },
  {
    name: 'Ridita Barua',
    gender: 'female',
    father: 'Sanjoy Barua',
    mother: 'Priya Barua',
    guardian: 'mother',
  },
  {
    name: 'Tanvir Hossain Rafi',
    gender: 'male',
    father: 'Md. Mizanur Rahman',
    mother: 'Sharmin Akter',
    guardian: 'mother',
  },
  // KG-1 B
  {
    name: 'Faiza Noor',
    gender: 'female',
    father: 'Md. Nurul Islam',
    mother: 'Kulsum Begum',
    guardian: 'mother',
  },
  {
    name: 'Mahin Alam',
    gender: 'male',
    father: 'Shafiqul Alam',
    mother: 'Rumana Alam',
    guardian: 'father',
  },
  {
    name: 'Sumaiya Akter',
    gender: 'female',
    father: 'Md. Abul Kalam',
    mother: 'Hasina Begum',
    guardian: 'mother',
  },
  {
    name: 'Yeamin Sheikh',
    gender: 'male',
    father: 'Md. Liton Sheikh',
    mother: 'Morium Begum',
    guardian: 'father',
  },
  {
    name: 'Nabiha Rahman',
    gender: 'female',
    father: 'Ziaur Rahman',
    mother: 'Nadia Rahman',
    guardian: 'mother',
  },
  // KG-2 A
  {
    name: 'Saad Bin Hasan',
    gender: 'male',
    father: 'Md. Mehedi Hasan',
    mother: 'Afroza Begum',
    guardian: 'mother',
  },
  {
    name: 'Tahsin Jahan',
    gender: 'female',
    father: 'Md. Shah Jahan',
    mother: 'Rabeya Khatun',
    guardian: 'mother',
  },
  {
    name: 'Abrar Faiyaz',
    gender: 'male',
    father: 'Faisal Ahmed',
    mother: 'Munira Ahmed',
    guardian: 'father',
  },
  {
    name: 'Orpita Roy',
    gender: 'female',
    father: 'Bishwajit Roy',
    mother: 'Shampa Roy',
    guardian: 'mother',
  },
  {
    name: 'Mushfiq Uddin',
    gender: 'male',
    father: 'Md. Kamal Uddin',
    mother: 'Jharna Begum',
    guardian: 'father',
  },
  // KG-2 B
  {
    name: 'Ramisa Anjum',
    gender: 'female',
    father: 'Md. Anisur Rahman',
    mother: 'Dilruba Yasmin',
    guardian: 'mother',
  },
  {
    name: 'Wasif Rahman',
    gender: 'male',
    father: 'Md. Wahidur Rahman',
    mother: 'Selina Akter',
    guardian: 'father',
  },
  {
    name: 'Afia Ibnat',
    gender: 'female',
    father: 'Md. Ibne Sina',
    mother: 'Nargis Akter',
    guardian: 'mother',
  },
  {
    name: 'Shoaib Akhtar',
    gender: 'male',
    father: 'Md. Akhtaruzzaman',
    mother: 'Rozina Begum',
    guardian: 'mother',
  },
  {
    name: 'Ehsan Mahmud',
    gender: 'male',
    father: 'Md. Mahmudul Hasan',
    mother: 'Tanjila Akter',
    guardian: 'father',
  },
];

// Siblings share guardians (and so a guardian phone/email): Ayaan (PG-A #1) and Tanvir (KG-1 A #5).
export const SIBLING_OF = { 24: 0 };

// Deliberately below the 75% threshold: target attendance ratio per student index.
export const LOW_ATTENDANCE = { 3: 0.62, 17: 0.68, 22: 0.58, 36: 0.66 };

export const AREAS = [
  'Mirpur 10, Dhaka',
  'Dhanmondi 27, Dhaka',
  'Mohammadpur, Dhaka',
  'Uttara Sector 7, Dhaka',
  'Bashundhara R/A, Dhaka',
  'Shyamoli, Dhaka',
  'Banasree, Rampura, Dhaka',
  'Lalmatia, Dhaka',
];

// --- Large seed (--large): name pools for ~500 synthetic students ------------------------
export const LARGE_STUDENTS_PER_SECTION = 63;
export const BOY_NAMES = [
  'Ayaan',
  'Arham',
  'Zayan',
  'Rayan',
  'Ibrahim',
  'Aariz',
  'Rafsan',
  'Ahnaf',
  'Ishraq',
  'Samin',
  'Arian',
  'Nafis',
  'Mahin',
  'Yeamin',
  'Saad',
  'Abrar',
  'Mushfiq',
  'Wasif',
  'Shoaib',
  'Ehsan',
  'Tahmid',
  'Fahim',
  'Rifat',
  'Sakib',
  'Tanvir',
  'Imtiaz',
  'Rahat',
  'Sabbir',
  'Nabil',
  'Farhan',
];
export const GIRL_NAMES = [
  'Nusrat',
  'Raisa',
  'Anaya',
  'Aroshi',
  'Mahira',
  'Tasnim',
  'Sadia',
  'Anika',
  'Prapti',
  'Lamia',
  'Maliha',
  'Ridita',
  'Faiza',
  'Sumaiya',
  'Nabiha',
  'Tahsin',
  'Orpita',
  'Ramisa',
  'Afia',
  'Mim',
  'Samiha',
  'Tanha',
  'Nuha',
  'Jannat',
  'Adiba',
  'Ayesha',
  'Fariha',
  'Labiba',
  'Mehjabin',
  'Zarin',
];
export const SURNAMES = [
  'Rahman',
  'Hossain',
  'Islam',
  'Chowdhury',
  'Karim',
  'Ahmed',
  'Das',
  'Sarkar',
  'Haque',
  'Mahmud',
  'Kabir',
  'Hasan',
  'Alam',
  'Sheikh',
  'Roy',
  'Saha',
  'Barua',
  'Iqbal',
  'Uddin',
  'Mridha',
  'Akter',
  'Siddique',
  'Talukder',
  'Bhuiyan',
  'Khan',
];
export const FATHER_NAMES = [
  'Md. Mizanur',
  'Md. Jahangir',
  'Md. Delwar',
  'Md. Rafiqul',
  'Imran',
  'Md. Abdul',
  'Sohel',
  'Sujit',
  'Md. Habibur',
  'Md. Enamul',
  'Khaled',
  'Humayun',
  'Md. Anwar',
  'Kamrul',
  'Pradip',
  'Md. Yasin',
];
export const MOTHER_NAMES = [
  'Sharmin Akter',
  'Rokeya Begum',
  'Nazma Khatun',
  'Salma Islam',
  'Farzana Chowdhury',
  'Parvin Akter',
  'Tania Ahmed',
  'Mitali Das',
  'Laily Begum',
  'Sabina Yasmin',
  'Nasima Akter',
  'Kohinoor Begum',
  'Shirin Sultana',
  'Monira Begum',
  'Rehana Parvin',
  'Jesmin Akter',
];
