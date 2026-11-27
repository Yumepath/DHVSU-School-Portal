import type { CalendarEvent, GradeScale, Schedule, Semester, Year } from '../core/database';

export function campusDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts();
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return [value('year'), value('month'), value('day')].join('-');
}

export function defaultSemester(semesters: Semester[], preferredIds: string[]): string {
  const today = campusDate();
  const ordered = [...semesters].sort((a, b) => b.start_on.localeCompare(a.start_on));
  const current = ordered.find(term => term.start_on <= today && today <= term.end_on);
  return current?.id ?? ordered.find(term => preferredIds.includes(term.id))?.id ?? ordered[0]?.id ?? '';
}

export function termName(semester: Semester | undefined, years: Year[]): string {
  if (!semester) return 'No semester';
  return [years.find(year => year.id === semester.year_id)?.label, semester.name].filter(Boolean).join(' · ');
}

export function weightedAverage(rows: { scale: GradeScale | undefined; units: number }[]): number | null {
  const counted = rows.filter(row => row.scale && row.units > 0);
  const total = counted.reduce((sum, row) => sum + row.units, 0);
  return total ? counted.reduce((sum, row) => sum + (row.scale?.grade ?? 0) * row.units, 0) / total : null;
}

export function sortSchedule(schedules: Schedule[]): Schedule[] {
  return [...schedules].sort((a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at));
}

export function upcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(event => event.ends_on >= campusDate()).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}

export function dateInTerm(term: Semester | undefined): string {
  const today = campusDate();
  if (!term) return today;
  return today < term.start_on ? term.start_on : today > term.end_on ? term.end_on : today;
}
