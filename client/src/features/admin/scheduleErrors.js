/** Timetable errors from the server, matched back to the slot being edited (ScheduleEditor). */
const sameSlot = (a, b) =>
  a?.day === b?.day && a?.startTime === b?.startTime && a?.endTime === b?.endTime;

/**
 * Server errors → { slotIndex: message }. 409 SCHEDULE_CLASH lists clashes with the slot they
 * came from; 422 errors carry paths like "schedule.2" or "schedule.2.endTime".
 */
export function clashErrorsBySlot(error, slots) {
  const out = {};
  const add = (i, message) => {
    if (i < 0) return;
    out[i] = out[i] ? `${out[i]} ${message}` : message;
  };
  for (const clash of error?.details?.clashes ?? []) {
    add(
      slots.findIndex((s) => sameSlot(s, clash.slot)),
      clash.message,
    );
  }
  for (const e of error?.errors ?? []) {
    const match = /^schedule\.(\d+)/.exec(e.field ?? '');
    if (match) add(Number(match[1]), e.message);
  }
  return out;
}

const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

/**
 * Slots grouped by time, days as ranges where consecutive:
 * [Sun–Thu 08:00–08:30, Sun 10:45–11:15] → ["Sun–Thu 08:00–08:30", "Sun 10:45–11:15"].
 */
export function summarizeSchedule(slots = []) {
  const byTime = new Map();
  for (const s of slots) {
    const time = `${s.startTime}–${s.endTime}`;
    if (!byTime.has(time)) byTime.set(time, new Set());
    byTime.get(time).add(DAY_ORDER.indexOf(s.day));
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, days]) => {
      const sorted = [...days].sort((a, b) => a - b);
      const runs = [];
      for (const d of sorted) {
        const last = runs.at(-1);
        if (last && d === last[1] + 1) last[1] = d;
        else runs.push([d, d]);
      }
      const label = runs
        .map(([a, b]) =>
          a === b
            ? SHORT[DAY_ORDER[a]]
            : `${SHORT[DAY_ORDER[a]]}${b === a + 1 ? ', ' : '–'}${SHORT[DAY_ORDER[b]]}`,
        )
        .join(', ');
      return `${label} ${time}`;
    });
}
