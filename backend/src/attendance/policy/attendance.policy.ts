/**
 * 출퇴근 판정 순수 함수. DB·현재 시각에 의존하지 않는다.
 * 모든 시각은 근무일 자정부터의 초(secOfDay, Asia/Seoul)로 받는다.
 */
import { ErrorCode } from '../../common/errors.js';
import { POLICY } from '../../common/policy.config.js';
import { toSec } from '../../common/time.js';
import type { DayType } from '../attendance.entity.js';

export interface TimeWindow {
  /** 'HH:mm' 또는 'HH:mm:ss' */
  start: string;
  end: string;
}

export interface DayContext {
  dayType: DayType;
  /** 반일 OFF 사용일 */
  halfOff: boolean;
  /** HOLIDAY_WORK 일 때 신청 시간대 */
  window?: TimeWindow | null;
}

export type Verdict<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: ErrorCode };

/** 신청 시간대 [start, end] 안인지 (양 끝 포함) */
export function inWindow(sec: number, w: TimeWindow): boolean {
  return sec >= toSec(w.start) && sec <= toSec(w.end);
}

/** 출근 판정 (A-1, A-2, A-5, W-2) */
export function evaluateCheckIn(
  sec: number,
  ctx: DayContext,
): Verdict<{ isLate: boolean }> {
  if (ctx.dayType === 'HOLIDAY_WORK') {
    // W-2: 07:00 제한 없음, 신청 시간대 안이어야. B-6: 지각 판정 없음
    if (!ctx.window || !inWindow(sec, ctx.window)) {
      return { ok: false, code: ErrorCode.ATT_OUTSIDE_WINDOW };
    }
    return { ok: true, isLate: false };
  }
  if (sec < toSec(POLICY.checkInOpen)) {
    return { ok: false, code: ErrorCode.ATT_TOO_EARLY };
  }
  // A-5: 반일 OFF 사용일은 지각 판정을 하지 않는다
  const isLate = !ctx.halfOff && sec > toSec(POLICY.lateAfter);
  return { ok: true, isLate };
}

/**
 * 점심 차감 (B-3): 근무 구간 [in, out] 과 [11:30, 12:30] 이 겹치는 초.
 */
export function lunchOverlapSec(inSec: number, outSec: number): number {
  const ls = toSec(POLICY.lunchStart);
  const le = toSec(POLICY.lunchEnd);
  return Math.max(0, Math.min(outSec, le) - Math.max(inSec, ls));
}

/**
 * 근무시간 (C-3): (퇴근 − 출근 − 점심 겹침) 을 분 단위로, 초는 버림.
 * lunchMinutes 는 표시용으로 겹친 초를 분으로 버림한 값.
 */
export function calcWorkMinutes(
  inSec: number,
  outSec: number,
): { workMinutes: number; lunchMinutes: number } {
  const lunch = lunchOverlapSec(inSec, outSec);
  const net = Math.max(0, outSec - inSec - lunch);
  return {
    workMinutes: Math.floor(net / 60),
    lunchMinutes: Math.floor(lunch / 60),
  };
}

/** 조퇴 판정 (B-4, B-5, B-6) */
export function isEarlyLeave(workMinutes: number, ctx: DayContext): boolean {
  if (ctx.dayType === 'HOLIDAY_WORK') return false;
  const required = ctx.halfOff ? POLICY.halfOffMinutes : POLICY.fullDayMinutes;
  return workMinutes < required;
}

/**
 * 퇴근 판정 (B-1, B-2, W-2). 버튼 퇴근과 직접 입력(M-3)이 같은 함수를 쓴다.
 */
export function evaluateCheckOut(
  inSec: number,
  outSec: number,
  ctx: DayContext,
): Verdict<{ workMinutes: number; lunchMinutes: number; isEarlyLeave: boolean }> {
  if (outSec > toSec(POLICY.dayEnd)) {
    return { ok: false, code: ErrorCode.ATT_MANUAL_INVALID };
  }
  if (outSec < inSec) {
    return { ok: false, code: ErrorCode.ATT_CHECKOUT_BEFORE_CHECKIN };
  }
  if (ctx.dayType === 'HOLIDAY_WORK') {
    if (!ctx.window || !inWindow(outSec, ctx.window)) {
      return { ok: false, code: ErrorCode.ATT_OUTSIDE_WINDOW };
    }
  } else if (!ctx.halfOff && outSec < toSec(POLICY.checkOutOpen)) {
    return { ok: false, code: ErrorCode.ATT_CHECKOUT_TOO_EARLY };
  }
  const { workMinutes, lunchMinutes } = calcWorkMinutes(inSec, outSec);
  return {
    ok: true,
    workMinutes,
    lunchMinutes,
    isEarlyLeave: isEarlyLeave(workMinutes, ctx),
  };
}
