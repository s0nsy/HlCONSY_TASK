/**
 * 날짜/시각 유틸. "현재 시각"은 절대 여기서 만들지 않는다 (ClockService.now() 사용).
 *
 * 표현 규칙
 *  - 날짜:  'YYYY-MM-DD' (Asia/Seoul 달력 기준)
 *  - 시각:  'HH:mm:ss'   (Asia/Seoul)
 *  - 순간:  ISO-8601 UTC 문자열 (DB 저장용, 사전순 = 시간순)
 */
import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { POLICY } from './policy.config.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TZ = POLICY.timezone;
export { dayjs, type Dayjs };

/** epoch ms → Asia/Seoul Dayjs */
export function fromEpoch(ms: number): Dayjs {
  return dayjs(ms).tz(TZ);
}

/** ISO 문자열 → Asia/Seoul Dayjs */
export function fromIso(iso: string): Dayjs {
  return dayjs(iso).tz(TZ);
}

/** 서울 날짜 + 시각 → 순간. (Asia/Seoul 은 1988년 이후 DST가 없어 +09:00 고정) */
export function kstInstant(date: string, time = '00:00:00'): Dayjs {
  return dayjs(`${date}T${normalizeTime(time)}+09:00`).tz(TZ);
}

export function kstEpoch(date: string, time = '00:00:00'): number {
  return kstInstant(date, time).valueOf();
}

export function dateOf(d: Dayjs): string {
  return d.tz(TZ).format('YYYY-MM-DD');
}

export function timeOf(d: Dayjs): string {
  return d.tz(TZ).format('HH:mm:ss');
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** 'HH:mm' 또는 'HH:mm:ss' → 'HH:mm:ss' */
export function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

/** 'HH:mm[:ss]' → 자정부터 초 */
export function toSec(t: string): number {
  const [h, m, s = '0'] = t.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function secOfDay(d: Dayjs): number {
  return toSec(timeOf(d));
}

/** 순수 달력 연산 (타임존 무관) */
export function addDays(date: string, n: number): string {
  return dayjs.utc(date).add(n, 'day').format('YYYY-MM-DD');
}

export function addMonthsClamped(date: string, n: number): string {
  // dayjs 는 말일을 넘기면 그 달 말일로 맞춘다 (1/31 + 1개월 = 2/28) → L-2
  return dayjs.utc(date).add(n, 'month').format('YYYY-MM-DD');
}

/** 0=일 … 6=토 */
export function dayOfWeek(date: string): number {
  return dayjs.utc(date).day();
}

export function isValidDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    dayjs.utc(date).format('YYYY-MM-DD') === date
  );
}

export function daysInMonth(month: string): string[] {
  const first = dayjs.utc(`${month}-01`);
  const n = first.daysInMonth();
  return Array.from({ length: n }, (_, i) => first.add(i, 'day').format('YYYY-MM-DD'));
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** '11/20(금) 17:00' */
export function labelDateTime(d: Dayjs): string {
  const k = d.tz(TZ);
  return `${k.format('M/D')}(${WEEK[k.day()]}) ${k.format('HH:mm')}`;
}
export function labelDate(date: string): string {
  return `${dayjs.utc(date).format('M/D')}(${WEEK[dayOfWeek(date)]})`;
}
