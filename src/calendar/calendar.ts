import { MORN, EVE } from '../content/messages';
import { addDays, dayKey } from '../game/dates';
import type { DayKey } from '../game/types';

export const REMINDER_COUNT = 30;
export const RRULE = `RRULE:FREQ=DAILY;COUNT=${REMINDER_COUNT}`;

export interface ReminderSpec {
  kind: 'morning' | 'evening';
  time: string; // HH:MM
  title: string;
  details: string;
  start: DayKey;
}

const compact = (k: DayKey, hhmm: string) => `${k.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const t = (h * 60 + m + mins) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** First day to start: today if the time is still ahead, otherwise tomorrow. */
export function firstDay(hhmm: string, now = new Date()): DayKey {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const today = dayKey(now);
  return now.getHours() * 60 + now.getMinutes() < h * 60 + m ? today : addDays(today, 1);
}

/** Varied lines for the reminder text, picked deterministically per day. */
export function reminderSpecs(morning: string, evening: string, now = new Date()): ReminderSpec[] {
  const seed = now.getDate();
  const lines = (arr: string[]) => Array.from({ length: 5 }, (_, i) => arr[(seed + i * 3) % arr.length]!);
  const link = typeof location !== 'undefined' ? location.origin : '';
  return [
    {
      kind: 'morning',
      time: morning,
      title: '⚔️ The Quest: משימות הבוקר',
      details: [...lines(MORN), '', link].join('\n').trim(),
      start: firstDay(morning, now),
    },
    {
      kind: 'evening',
      time: evening,
      title: '🌙 The Quest: סיכום הערב',
      details: [...lines(EVE), '', link].join('\n').trim(),
      start: firstDay(evening, now),
    },
  ];
}

export function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
  } catch {
    return 'Asia/Jerusalem';
  }
}

/** A link that opens Google Calendar with a ready, repeating event. No account access. */
export function googleLink(r: ReminderSpec, tz = timeZone()): string {
  const end = addMinutes(r.time, 15);
  const endDay = end < r.time ? addDays(r.start, 1) : r.start;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: r.title,
    details: r.details,
    dates: `${compact(r.start, r.time)}/${compact(endDay, end)}`,
    ctz: tz,
    recur: RRULE,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines at 75 octets (RFC 5545), never splitting a UTF-8 character. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length ? 74 : 75;
    if (len + n > limit) {
      out.push(cur);
      cur = ch;
      len = n;
    } else {
      cur += ch;
      len += n;
    }
  }
  out.push(cur);
  return out.join('\r\n ');
}

function utcStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** A real .ics file: two daily repeating events with an alarm. Floating local time. */
export function buildIcs(specs: ReminderSpec[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Quest//Reminders//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const r of specs) {
    const end = addMinutes(r.time, 15);
    const endDay = end < r.time ? addDays(r.start, 1) : r.start;
    lines.push(
      'BEGIN:VEVENT',
      `UID:the-quest-${r.kind}@the-quest.app`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${compact(r.start, r.time)}`,
      `DTEND:${compact(endDay, end)}`,
      RRULE,
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(r.details)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
