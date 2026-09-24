/**
 * An iCalendar (.ics, RFC 5545) file for one meeting, so guardians can add it to their phone's
 * calendar. Times are written in UTC ("…Z"): the meeting's instant is exact, and calendar apps
 * show it in the phone's own timezone (Dhaka for our guardians), so no VTIMEZONE is needed.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Date → 20260924T103000Z */
export function icsUtc(date) {
  const d = new Date(date);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape a TEXT value: backslash, semicolon, comma and newlines. */
export function icsEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Fold a content line at 75 octets (UTF-8), never splitting a character. */
export function icsFold(line) {
  if (encoder.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // The first line holds 75 octets; continuation lines start with a space, so 74 more.
    const limit = parts.length ? 74 : 75;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * The file's text (CRLF line endings).
 * @param event { uid, title, start, durationMinutes = 60, location, description, url, now }
 */
export function buildIcs({
  uid,
  title,
  start,
  durationMinutes = 60,
  location,
  description,
  url,
  cancelled = false,
  now = new Date(),
}) {
  const startAt = new Date(start);
  const endAt = new Date(startAt.getTime() + (durationMinutes || 60) * 60_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LittleSteps//Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsUtc(startAt)}`,
    `DTEND:${icsUtc(endAt)}`,
    `SUMMARY:${icsEscape(title)}`,
    location && `LOCATION:${icsEscape(location)}`,
    description && `DESCRIPTION:${icsEscape(description)}`,
    url && `URL:${url}`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.map(icsFold).join('\r\n')}\r\n`;
}

/** A safe file name: "ptm-september.ics". */
export function icsFileName(title) {
  const slug = String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'meeting'}.ics`;
}

/** Start a download of the file in the browser. */
export function downloadIcs(event) {
  const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = icsFileName(event.title);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
