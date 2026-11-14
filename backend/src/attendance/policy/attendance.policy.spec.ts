import { ErrorCode } from '../../common/errors.js';
import { toSec } from '../../common/time.js';
import {
  type DayContext,
  calcWorkMinutes,
  evaluateCheckIn,
  evaluateCheckOut,
  lunchOverlapSec,
} from './attendance.policy.js';

const WEEKDAY: DayContext = { dayType: 'WEEKDAY', halfOff: false };
const HALF_OFF: DayContext = { dayType: 'WEEKDAY', halfOff: true };
const HOLIDAY: DayContext = { dayType: 'HOLIDAY_WORK', halfOff: false, window: { start: '10:00', end: '15:00' } };
const s = toSec;

describe('출근 판정 (A-1, A-2, A-5, W-2)', () => {
  it('06:59:59 는 거부 ATT_TOO_EARLY', () => {
    expect(evaluateCheckIn(s('06:59:59'), WEEKDAY)).toEqual({ ok: false, code: ErrorCode.ATT_TOO_EARLY });
  });
  it('07:00:00 부터 가능', () => {
    expect(evaluateCheckIn(s('07:00:00'), WEEKDAY)).toEqual({ ok: true, isLate: false });
  });
  it('10:00:00 은 정상, 10:00:01 부터 지각', () => {
    expect(evaluateCheckIn(s('10:00:00'), WEEKDAY)).toEqual({ ok: true, isLate: false });
    expect(evaluateCheckIn(s('10:00:01'), WEEKDAY)).toEqual({ ok: true, isLate: true });
  });
  it('재택일도 같은 규칙', () => {
    expect(evaluateCheckIn(s('10:30:00'), { dayType: 'REMOTE', halfOff: false })).toEqual({ ok: true, isLate: true });
  });
  it('반일 OFF 사용일은 지각 판정 없음', () => {
    expect(evaluateCheckIn(s('13:00:00'), HALF_OFF)).toEqual({ ok: true, isLate: false });
  });
  it('주말 근무: 07:00 제한 없이 신청 시간대 안에서만', () => {
    expect(evaluateCheckIn(s('09:59:59'), HOLIDAY)).toEqual({ ok: false, code: ErrorCode.ATT_OUTSIDE_WINDOW });
    expect(evaluateCheckIn(s('10:00:00'), HOLIDAY)).toEqual({ ok: true, isLate: false });
    expect(evaluateCheckIn(s('15:00:00'), HOLIDAY)).toEqual({ ok: true, isLate: false });
    expect(evaluateCheckIn(s('15:00:01'), HOLIDAY).ok).toBe(false);
  });
});

describe('점심 차감 (B-3)', () => {
  it('점심 구간 전체 포함 → 60분', () => {
    expect(lunchOverlapSec(s('09:00'), s('18:00'))).toBe(3600);
  });
  it('일부 겹침 → 겹친 만큼', () => {
    expect(lunchOverlapSec(s('12:00'), s('20:00'))).toBe(1800);
    expect(lunchOverlapSec(s('09:00'), s('11:45'))).toBe(900);
  });
  it('안 겹치면 0', () => {
    expect(lunchOverlapSec(s('13:00'), s('21:00'))).toBe(0);
    expect(lunchOverlapSec(s('07:00'), s('11:30'))).toBe(0);
  });
  it('근무시간은 분 단위, 초 버림 (C-3)', () => {
    expect(calcWorkMinutes(s('09:00:00'), s('18:00:59'))).toEqual({ workMinutes: 480, lunchMinutes: 60 });
    expect(calcWorkMinutes(s('12:00:30'), s('20:00:00'))).toEqual({ workMinutes: 450, lunchMinutes: 29 });
  });
});

describe('퇴근 판정 (B-1 ~ B-6)', () => {
  const inAt = s('09:00:00');
  it('15:59 퇴근 거부', () => {
    expect(evaluateCheckOut(inAt, s('15:59:00'), WEEKDAY)).toEqual({ ok: false, code: ErrorCode.ATT_CHECKOUT_TOO_EARLY });
  });
  it('09:00 → 18:00 = 480분 정상', () => {
    expect(evaluateCheckOut(inAt, s('18:00:00'), WEEKDAY)).toMatchObject({ ok: true, workMinutes: 480, isEarlyLeave: false });
  });
  it('09:00 → 17:59 = 479분 조퇴', () => {
    expect(evaluateCheckOut(inAt, s('17:59:00'), WEEKDAY)).toMatchObject({ ok: true, workMinutes: 479, isEarlyLeave: true });
  });
  it('10:00 → 16:00 = 5시간 조퇴 (B-2 예시)', () => {
    expect(evaluateCheckOut(s('10:00'), s('16:00'), WEEKDAY)).toMatchObject({ ok: true, workMinutes: 300, isEarlyLeave: true });
  });
  it('12:00 → 20:00 = 450분 조퇴', () => {
    expect(evaluateCheckOut(s('12:00'), s('20:00'), WEEKDAY)).toMatchObject({ workMinutes: 450, lunchMinutes: 30, isEarlyLeave: true });
  });
  it('13:00 → 21:00 = 480분 정상', () => {
    expect(evaluateCheckOut(s('13:00'), s('21:00'), WEEKDAY)).toMatchObject({ workMinutes: 480, lunchMinutes: 0, isEarlyLeave: false });
  });
  it('반일 OFF: 16:00 제한 없음, 240분 이상 정상', () => {
    expect(evaluateCheckOut(s('13:00'), s('17:00'), HALF_OFF)).toMatchObject({ ok: true, workMinutes: 240, isEarlyLeave: false });
    expect(evaluateCheckOut(s('09:00'), s('12:59'), HALF_OFF)).toMatchObject({ ok: true, isEarlyLeave: true });
  });
  it('주말 근무: 시간대 안에서만, 조퇴 판정 없음', () => {
    expect(evaluateCheckOut(s('10:00'), s('14:00'), HOLIDAY)).toMatchObject({ ok: true, workMinutes: 180, lunchMinutes: 60, isEarlyLeave: false });
    expect(evaluateCheckOut(s('10:00'), s('15:00:01'), HOLIDAY)).toEqual({ ok: false, code: ErrorCode.ATT_OUTSIDE_WINDOW });
  });
  it('퇴근이 출근보다 빠르면 거부', () => {
    expect(evaluateCheckOut(s('17:00'), s('16:30'), WEEKDAY)).toEqual({ ok: false, code: ErrorCode.ATT_CHECKOUT_BEFORE_CHECKIN });
  });
});
