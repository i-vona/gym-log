import { db } from './db';

/** Plan id for each weekday, Monday first; null = rest / nothing planned. */
export type Schedule = (number | null)[];

export const EMPTY_SCHEDULE: Schedule = [null, null, null, null, null, null, null];

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (iso: string) => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;

export async function getSchedule(): Promise<Schedule> {
  const v = (await db.meta.get('schedule'))?.value;
  return Array.isArray(v) && v.length === 7 ? (v as Schedule) : EMPTY_SCHEDULE;
}

export async function setScheduleDay(day: number, planId: number | null) {
  const s = [...(await getSchedule())];
  s[day] = planId;
  await db.meta.put({ key: 'schedule', value: s });
}
