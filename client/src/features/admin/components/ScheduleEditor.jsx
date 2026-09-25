import { Plus, Trash2 } from 'lucide-react';

import { Button, IconButton } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { cn } from '../../../utils/cn.js';
import { text } from '../text/index.js';

/**
 * Weekly slots [{ day, startTime, endTime }] with a row per slot. `errors[i]` (a message) is
 * shown under that slot: overlap checks from the server (422 schedule.i) and timetable clashes
 * (409 SCHEDULE_CLASH, matched back to the slot in clashErrorsBySlot()).
 */
export function ScheduleEditor({ value, onChange, days, errors = {} }) {
  const set = (i, patch) =>
    onChange(value.map((slot, j) => (j === i ? { ...slot, ...patch } : slot)));
  const add = () => {
    const last = value.at(-1);
    onChange([
      ...value,
      last
        ? { ...last, day: days[(days.indexOf(last.day) + 1) % days.length] }
        : { day: days[0], startTime: '08:00', endTime: '08:30' },
    ]);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Timetable</legend>
      {value.length === 0 && (
        <p className="text-sm text-muted">
          No slots: this assignment won&apos;t appear in the teacher&apos;s &quot;today&apos;s
          classes&quot;.
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {value.map((slot, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div
              className={cn(
                'grid grid-cols-[1fr_auto] items-center gap-2 rounded-control p-2 sm:grid-cols-[10rem_1fr_auto]',
                errors[i] ? 'bg-absent-soft' : 'bg-blush-50',
              )}
            >
              <div className="col-start-1 row-start-1">
                <Select
                  aria-label={`Slot ${i + 1} day`}
                  value={slot.day}
                  onChange={(e) => set(i, { day: e.target.value })}
                  options={days.map((d) => ({ value: d, label: text.weekdays[d] }))}
                />
              </div>
              <div className="col-span-2 col-start-1 row-start-2 flex items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <Input
                  type="time"
                  className="min-w-0 flex-1"
                  aria-label={`Slot ${i + 1} starts`}
                  value={slot.startTime}
                  onChange={(e) => set(i, { startTime: e.target.value })}
                />
                <span aria-hidden="true" className="text-muted">
                  –
                </span>
                <Input
                  type="time"
                  className="min-w-0 flex-1"
                  aria-label={`Slot ${i + 1} ends`}
                  value={slot.endTime}
                  onChange={(e) => set(i, { endTime: e.target.value })}
                />
              </div>
              <IconButton
                icon={Trash2}
                label={`Remove slot ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="col-start-2 row-start-1 sm:col-start-3"
              />
            </div>
            {errors[i] && (
              <p role="alert" className="px-2 text-sm font-semibold text-absent-ink">
                {errors[i]}
              </p>
            )}
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" icon={Plus} onClick={add} className="self-start">
        Add a slot
      </Button>
    </fieldset>
  );
}
