/** 신청 판정 순수 함수 (5.6) */
import { isIP } from 'node:net';
import {
  type HolidayLookup,
  isBusinessDay,
  prevBusinessDay,
} from '../../common/calendar/business-day.policy.js';
import { ErrorCode } from '../../common/errors.js';
import { POLICY } from '../../common/policy.config.js';
import { isValidDate, kstEpoch, toSec } from '../../common/time.js';
import type { RequestType } from '../request.entity.js';

/** R-3: 사용일 직전 영업일 17:00:00 */
export function requestDeadline(
  targetDate: string,
  isHoliday: HolidayLookup,
): { date: string; time: string; epochMs: number } {
  const date = prevBusinessDay(targetDate, isHoliday);
  return {
    date,
    time: POLICY.requestDeadline,
    epochMs: kstEpoch(date, POLICY.requestDeadline),
  };
}

/** 17:00:00.999 까지 허용, 17:00:01 부터 거부 (초 단위 비교) */
export function isBeforeDeadline(nowMs: number, deadlineMs: number): boolean {
  return Math.floor(nowMs / 1000) <= Math.floor(deadlineMs / 1000);
}

/** R-4 */
export function validateTargetDate(
  type: RequestType,
  date: string,
  isHoliday: HolidayLookup,
): ErrorCode | null {
  if (!isValidDate(date)) return ErrorCode.REQ_INVALID_DATE;
  const business = isBusinessDay(date, isHoliday);
  if (type === 'HOLIDAY_WORK') return business ? ErrorCode.REQ_NOT_HOLIDAY : null;
  return business ? null : ErrorCode.REQ_NOT_BUSINESS_DAY;
}

/**
 * R-5: 같은 날 근무 형태 신청은 하나만. 예외: REMOTE + OFF.
 * existing = 같은 날짜의 유효(PENDING/APPROVED) 신청 종류들
 */
export function hasDuplicateConflict(
  newType: RequestType,
  existing: RequestType[],
): boolean {
  return existing.some((t) => {
    if (t === newType) return true;
    const pair = new Set([t, newType]);
    if (pair.has('REMOTE') && pair.has('OFF') && pair.size === 2) return false;
    return true;
  });
}

/** R-2: REMOTE·HOLIDAY_WORK 시간대 검증 */
export function validateTimeRange(start: string, end: string): ErrorCode | null {
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!re.test(start) || !re.test(end)) return ErrorCode.REQ_INVALID_TIME_RANGE;
  if (toSec(start) >= toSec(end)) return ErrorCode.REQ_INVALID_TIME_RANGE;
  return null;
}

export function validateIp(ip: string): ErrorCode | null {
  return isIP(ip) ? null : ErrorCode.REQ_INVALID_IP;
}

export function needsIpAndWindow(type: RequestType): boolean {
  return type === 'REMOTE' || type === 'HOLIDAY_WORK';
}
