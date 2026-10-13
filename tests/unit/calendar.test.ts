import { describe, expect, it } from 'vitest';
import { buildIcs, googleLink, reminderSpecs, fold, firstDay } from '../../src/calendar/calendar';

const now = new Date(2026, 9, 13, 12, 0); // 13 Oct 2026, 12:00 local

describe('calendar', () => {
  it('Google links carry the chosen times and a 30-day RRULE', () => {
    const [m, e] = reminderSpecs('07:45', '21:10', now);
    const lm = new URL(googleLink(m!, 'Asia/Jerusalem'));
    expect(lm.hostname).toBe('calendar.google.com');
    expect(lm.searchParams.get('dates')).toBe('20261014T074500/20261014T080000');
    expect(lm.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY;COUNT=30');
    expect(lm.searchParams.get('ctz')).toBe('Asia/Jerusalem');
    const le = new URL(googleLink(e!, 'Asia/Jerusalem'));
    expect(le.searchParams.get('dates')).toBe('20261013T211000/20261013T212500');
    expect(le.searchParams.get('text')).toContain('The Quest');
  });
  it('handles an evening reminder that ends after midnight', () => {
    const [, e] = reminderSpecs('07:00', '23:55', now);
    expect(new URL(googleLink(e!)).searchParams.get('dates')).toBe('20261013T235500/20261014T001000');
  });
  it('starts tomorrow when the time already passed', () => {
    expect(firstDay('11:59', now)).toBe('2026-10-14');
    expect(firstDay('12:01', now)).toBe('2026-10-13');
  });
  it('builds a valid .ics with alarms', () => {
    const ics = buildIcs(reminderSpecs('08:00', '20:30', now), now);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(2);
    expect(ics.match(/BEGIN:VALARM/g)!.length).toBe(2);
    expect(ics).toContain('DTSTART:20261014T080000');
    expect(ics).toContain('DTSTART:20261013T203000');
    expect(ics).toContain('RRULE:FREQ=DAILY;COUNT=30');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // unfolded text is intact Hebrew
    expect(ics.replace(/\r\n /g, '')).toContain('משימות הבוקר');
  });
  it('folds without breaking multibyte characters', () => {
    const s = 'DESCRIPTION:' + 'שלום '.repeat(40);
    const f = fold(s);
    expect(f.replace(/\r\n /g, '')).toBe(s);
  });
  it('reminder lines vary', () => {
    const a = reminderSpecs('08:00', '20:00', new Date(2026, 0, 1, 1));
    const b = reminderSpecs('08:00', '20:00', new Date(2026, 0, 2, 1));
    expect(a[0]!.details).not.toBe(b[0]!.details);
  });
});
