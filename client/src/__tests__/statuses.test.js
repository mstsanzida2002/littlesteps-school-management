import { describe, expect, it } from 'vitest';

import { getStatus, STATUS_GROUPS, TONES } from '../config/statuses.js';

// Every value the API can return for these fields (server/src/config/constants.js and models).
const SERVER_VALUES = {
  attendance: ['present', 'absent', 'late', 'excused'],
  publication: ['draft', 'published'],
  account: ['pending', 'active', 'suspended', 'rejected'],
  rsvp: ['will_attend', 'cannot_attend'],
};

describe('status mapping', () => {
  it.each(Object.entries(SERVER_VALUES))(
    '%s: every server value has an icon, a label and a tone',
    (group, values) => {
      for (const value of values) {
        const status = getStatus(group, value);
        expect(status.label).toMatch(/\S/);
        expect(status.icon).toBeTruthy();
        expect(TONES).toContain(status.tone);
        expect(status).toBe(STATUS_GROUPS[group][value]);
      }
    },
  );

  it('never tells two statuses of a group apart by colour alone', () => {
    for (const statuses of Object.values(STATUS_GROUPS)) {
      const labels = Object.values(statuses).map((s) => s.label);
      const icons = Object.values(statuses).map((s) => s.icon);
      expect(new Set(labels).size).toBe(labels.length);
      expect(new Set(icons).size).toBe(icons.length);
    }
  });

  it('shows a missing RSVP as "No response"', () => {
    expect(getStatus('rsvp', null).label).toBe('No response');
    expect(getStatus('rsvp', undefined).label).toBe('No response');
  });

  it('renders unknown values neutrally instead of crashing', () => {
    expect(getStatus('account', 'on_leave')).toMatchObject({ label: 'On leave', tone: 'neutral' });
    expect(getStatus('attendance', null)).toMatchObject({ label: 'Not set', tone: 'neutral' });
    expect(() => getStatus('nope', 'x')).toThrow(/Unknown status group/);
  });

  it('never gives a positive status the cerise (absent) tone', () => {
    const positive = [
      ['attendance', 'present'],
      ['account', 'active'],
      ['rsvp', 'will_attend'],
      ['publication', 'published'],
    ];
    for (const [group, value] of positive) expect(getStatus(group, value).tone).not.toBe('absent');
  });
});
