import { isBusinessDay, prevBusinessDay } from '../../common/calendar/business-day.policy.js';
import { ErrorCode } from '../../common/errors.js';
import { kstEpoch } from '../../common/time.js';
import {
  hasDuplicateConflict,
  isBeforeDeadline,
  requestDeadline,
  validateIp,
  validateTargetDate,
  validateTimeRange,
} from './request.policy.js';

const holidays = new Set(['2026-11-27', '2026-12-25', '2026-10-09']);
const isHoliday = (d: string) => holidays.has(d);

describe('영업일 (C-2)', () => {
  it('토·일·공휴일은 영업일이 아니다', () => {
    expect(isBusinessDay('2026-11-16', isHoliday)).toBe(true); // 월
    expect(isBusinessDay('2026-11-21', isHoliday)).toBe(false); // 토
    expect(isBusinessDay('2026-11-22', isHoliday)).toBe(false); // 일
    expect(isBusinessDay('2026-12-25', isHoliday)).toBe(false); // 성탄절
  });
  it('직전 영업일', () => {
    expect(prevBusinessDay('2026-11-23', isHoliday)).toBe('2026-11-20'); // 월 → 금
    expect(prevBusinessDay('2026-11-17', isHoliday)).toBe('2026-11-16');
    // 금요일이 공휴일이면 목요일
    expect(prevBusinessDay('2026-11-28', isHoliday)).toBe('2026-11-26');
    expect(prevBusinessDay('2026-11-30', isHoliday)).toBe('2026-11-26');
  });
});

describe('신청 기한 (R-3)', () => {
  it('월요일 연차 → 직전 금요일 17:00:00 까지', () => {
    const d = requestDeadline('2026-11-23', isHoliday);
    expect(d.date).toBe('2026-11-20');
    expect(isBeforeDeadline(kstEpoch('2026-11-20', '17:00:00'), d.epochMs)).toBe(true);
    expect(isBeforeDeadline(kstEpoch('2026-11-20', '17:00:00') + 999, d.epochMs)).toBe(true);
    expect(isBeforeDeadline(kstEpoch('2026-11-20', '17:00:01'), d.epochMs)).toBe(false);
  });
  it('토요일 근무 → 금요일 17:00, 금요일이 공휴일이면 목요일', () => {
    expect(requestDeadline('2026-11-21', isHoliday).date).toBe('2026-11-20');
    expect(requestDeadline('2026-11-28', isHoliday).date).toBe('2026-11-26');
  });
});

describe('날짜 유효성 (R-4)', () => {
  it('연차·재택·OFF 는 영업일만', () => {
    expect(validateTargetDate('ANNUAL', '2026-11-16', isHoliday)).toBeNull();
    expect(validateTargetDate('REMOTE', '2026-11-21', isHoliday)).toBe(ErrorCode.REQ_NOT_BUSINESS_DAY);
    expect(validateTargetDate('OFF', '2026-12-25', isHoliday)).toBe(ErrorCode.REQ_NOT_BUSINESS_DAY);
  });
  it('주말/공휴일 근무는 주말·공휴일만', () => {
    expect(validateTargetDate('HOLIDAY_WORK', '2026-11-21', isHoliday)).toBeNull();
    expect(validateTargetDate('HOLIDAY_WORK', '2026-12-25', isHoliday)).toBeNull();
    expect(validateTargetDate('HOLIDAY_WORK', '2026-11-16', isHoliday)).toBe(ErrorCode.REQ_NOT_HOLIDAY);
  });
  it('잘못된 날짜', () => {
    expect(validateTargetDate('ANNUAL', '2026-02-30', isHoliday)).toBe(ErrorCode.REQ_INVALID_DATE);
  });
});

describe('같은 날 중복 (R-5)', () => {
  it('ANNUAL/REMOTE/OFF 중 하나만, 단 REMOTE+OFF 는 허용', () => {
    expect(hasDuplicateConflict('ANNUAL', [])).toBe(false);
    expect(hasDuplicateConflict('ANNUAL', ['REMOTE'])).toBe(true);
    expect(hasDuplicateConflict('OFF', ['ANNUAL'])).toBe(true);
    expect(hasDuplicateConflict('REMOTE', ['REMOTE'])).toBe(true);
    expect(hasDuplicateConflict('OFF', ['REMOTE'])).toBe(false);
    expect(hasDuplicateConflict('REMOTE', ['OFF'])).toBe(false);
    expect(hasDuplicateConflict('OFF', ['REMOTE', 'OFF'])).toBe(true);
    expect(hasDuplicateConflict('HOLIDAY_WORK', ['HOLIDAY_WORK'])).toBe(true);
  });
});

describe('입력 검증 (R-2)', () => {
  it('시간대', () => {
    expect(validateTimeRange('10:00', '15:00')).toBeNull();
    expect(validateTimeRange('15:00', '10:00')).toBe(ErrorCode.REQ_INVALID_TIME_RANGE);
    expect(validateTimeRange('10:00', '10:00')).toBe(ErrorCode.REQ_INVALID_TIME_RANGE);
    expect(validateTimeRange('25:00', '26:00')).toBe(ErrorCode.REQ_INVALID_TIME_RANGE);
  });
  it('IP', () => {
    expect(validateIp('10.0.0.5')).toBeNull();
    expect(validateIp('::1')).toBeNull();
    expect(validateIp('10.0.0')).toBe(ErrorCode.REQ_INVALID_IP);
  });
});
