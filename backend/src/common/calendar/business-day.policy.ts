/** 영업일 판정 순수 함수 (C-2) */
import { addDays, dayOfWeek } from '../time.js';

export type HolidayLookup = (date: string) => boolean;

export function isWeekend(date: string): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

export function isBusinessDay(date: string, isHoliday: HolidayLookup): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/** date 직전 영업일 (date 자신은 제외) */
export function prevBusinessDay(date: string, isHoliday: HolidayLookup): string {
  let d = addDays(date, -1);
  // 연휴가 아무리 길어도 60일 안에는 영업일이 있다
  for (let i = 0; i < 60; i++) {
    if (isBusinessDay(d, isHoliday)) return d;
    d = addDays(d, -1);
  }
  throw new Error(`no business day before ${date}`);
}
