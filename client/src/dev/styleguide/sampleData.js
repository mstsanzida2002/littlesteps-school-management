/** Deterministic sample data for the styleguide (stable screenshots). */
import { addDaysToKey, weekdayOfKey } from '../../utils/date.js';

const END = '2026-09-24';
const OFF = [5, 6];

// A small fixed sequence instead of Math.random, so every render is identical.
const noise = (i) => ((i * 37) % 11) - 5;

export const trendData = Array.from({ length: 30 }, (_, i) => addDaysToKey(END, i - 29))
  .filter((date) => !OFF.includes(weekdayOfKey(date)))
  .map((date, i) => ({
    date,
    value: i === 9 ? null : Math.min(100, 90 + noise(i) + (i === 13 ? -17 : 0)),
  }));

export const classComparison = [
  { label: 'Playgroup-A', value: 94.2 },
  { label: 'Playgroup-B', value: 71.5 },
  { label: 'Nursery-A', value: 91 },
  { label: 'Nursery-B', value: 88.4 },
  { label: 'KG-1-A', value: 96.1 },
  { label: 'KG-1-B', value: 83 },
  { label: 'KG-2-A', value: 90.5 },
  { label: 'KG-2-B', value: 74.9 },
];

const STATUS_CYCLE = [
  'present',
  'present',
  'present',
  'late',
  'present',
  'present',
  'absent',
  'present',
  'present',
  'excused',
];

export const calendarDays = Array.from({ length: 44 }, (_, i) => addDaysToKey(END, i - 43))
  .filter((date) => !OFF.includes(weekdayOfKey(date)))
  .map((date, i) => ({
    date,
    status: date === END ? undefined : STATUS_CYCLE[i % STATUS_CYCLE.length],
  }));

export const students = [
  {
    _id: '1',
    rollNo: 1,
    name: 'Ayaan Rahman',
    section: 'Playgroup-A',
    attendance: 95.5,
    status: 'active',
  },
  {
    _id: '2',
    rollNo: 2,
    name: 'নুসরাত জাহান',
    section: 'Playgroup-A',
    attendance: 88,
    status: 'active',
  },
  {
    _id: '3',
    rollNo: 3,
    name: 'Rafi Chowdhury',
    section: 'Playgroup-A',
    attendance: 71.4,
    status: 'active',
  },
  {
    _id: '4',
    rollNo: 4,
    name: 'Tahmid Hasan',
    section: 'Playgroup-B',
    attendance: null,
    status: 'pending',
  },
  {
    _id: '5',
    rollNo: 5,
    name: 'সাদিয়া ইসলাম',
    section: 'Playgroup-B',
    attendance: 100,
    status: 'active',
  },
  {
    _id: '6',
    rollNo: 6,
    name: 'Mahir Ahmed',
    section: 'Nursery-A',
    attendance: 64.3,
    status: 'suspended',
  },
];

export const CLASS_OPTIONS = [
  { value: 'pg', label: 'Playgroup' },
  { value: 'nursery', label: 'Nursery' },
  { value: 'kg1', label: 'KG-1' },
  { value: 'kg2', label: 'KG-2' },
];
