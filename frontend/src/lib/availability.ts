import type { AvailabilityRule, AvailabilityException, Booking } from '../types/lms';

export interface TimeRange {
  start: string; // "HH:MM" or "HH:MM:SS"
  end: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Clamp a target day-of-month (1-31) to the last real day of the given year/month,
// so a "31st of every month" rule still fires in February.
function clampDayOfMonth(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function ruleAppliesToDate(rule: AvailabilityRule, date: Date): boolean {
  const startsOn = new Date(rule.starts_on + 'T00:00:00');
  if (date < startsOn) return false;
  if (rule.ends_on) {
    const endsOn = new Date(rule.ends_on + 'T00:00:00');
    if (date > endsOn) return false;
  }

  switch (rule.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return (rule.days_of_week ?? []).includes(date.getDay());
    case 'monthly': {
      if (rule.day_of_month == null) return false;
      const target = clampDayOfMonth(date.getFullYear(), date.getMonth(), rule.day_of_month);
      return date.getDate() === target;
    }
    case 'quarterly': {
      if (rule.day_of_month == null) return false;
      const target = clampDayOfMonth(date.getFullYear(), date.getMonth(), rule.day_of_month);
      if (date.getDate() !== target) return false;
      return monthsBetween(startsOn, date) % 3 === 0;
    }
    case 'yearly': {
      if (rule.day_of_month == null || rule.month_of_year == null) return false;
      if (date.getMonth() + 1 !== rule.month_of_year) return false;
      const target = clampDayOfMonth(date.getFullYear(), date.getMonth(), rule.day_of_month);
      return date.getDate() === target;
    }
    default:
      return false;
  }
}

// Subtracts a blackout range from a list of ranges (splitting a range in two if the
// blackout falls in the middle of it).
function subtractRange(ranges: TimeRange[], blackoutStart: number, blackoutEnd: number): TimeRange[] {
  const result: TimeRange[] = [];
  for (const r of ranges) {
    const rStart = toMinutes(r.start);
    const rEnd = toMinutes(r.end);
    if (blackoutEnd <= rStart || blackoutStart >= rEnd) {
      result.push(r);
      continue;
    }
    if (blackoutStart > rStart) result.push({ start: r.start, end: fromMinutes(blackoutStart) });
    if (blackoutEnd < rEnd) result.push({ start: fromMinutes(blackoutEnd), end: r.end });
  }
  return result;
}

function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const merged: TimeRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (toMinutes(current.start) <= toMinutes(last.end)) {
      if (toMinutes(current.end) > toMinutes(last.end)) last.end = current.end;
    } else {
      merged.push(current);
    }
  }
  return merged;
}

// Expands recurring rules + one-off exceptions into concrete per-date time ranges across
// [rangeStart, rangeEnd] inclusive. This is the single source of truth used by both the
// provider-facing calendar and the student-facing booking modal.
export function expandAvailability(
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[],
  rangeStart: Date,
  rangeEnd: Date
): Map<string, TimeRange[]> {
  const result = new Map<string, TimeRange[]>();

  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = toDateKey(cursor);
    let ranges: TimeRange[] = [];

    for (const rule of rules) {
      if (ruleAppliesToDate(rule, cursor)) {
        ranges.push({ start: rule.start_time, end: rule.end_time });
      }
    }

    const dayExceptions = exceptions.filter((e) => e.specific_date === key);
    for (const exc of dayExceptions) {
      if (exc.is_available) {
        if (exc.start_time && exc.end_time) {
          ranges.push({ start: exc.start_time, end: exc.end_time });
        }
      } else if (exc.start_time && exc.end_time) {
        ranges = subtractRange(ranges, toMinutes(exc.start_time), toMinutes(exc.end_time));
      } else {
        ranges = []; // full-day blackout
      }
    }

    ranges = mergeRanges(ranges);
    if (ranges.length > 0) result.set(key, ranges);

    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

// Splits a day's available ranges into bookable slots of durationMinutes, on a 30-minute
// grid, excluding times that overlap an existing booking or that have already passed today.
export function getAvailableSlotsForDate(
  date: Date,
  ranges: TimeRange[],
  existingBookings: Booking[],
  durationMinutes: number
): string[] {
  const slots: string[] = [];
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  for (const range of ranges) {
    const startMins = toMinutes(range.start);
    const endMins = toMinutes(range.end);

    for (let currentMins = startMins; currentMins + durationMinutes <= endMins; currentMins += 30) {
      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(currentMins / 60), currentMins % 60, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

      if (isToday && slotStart.getTime() <= now.getTime()) continue;

      const isOverlapping = existingBookings.some((booking) => {
        const bStart = new Date(booking.session_date).getTime();
        const bEnd = bStart + booking.duration_minutes * 60000;
        return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
      });

      if (!isOverlapping) slots.push(fromMinutes(currentMins));
    }
  }

  return Array.from(new Set(slots)).sort();
}
