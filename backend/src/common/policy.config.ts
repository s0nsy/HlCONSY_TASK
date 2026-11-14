/**
 * 근태 제도의 모든 규칙 상수. (request.md 2장 / 5장)
 * 시각은 모두 Asia/Seoul 기준 'HH:mm:ss'.
 */
export const POLICY = {
  timezone: 'Asia/Seoul',

  /** 출근 등록 가능 시작 (A-1) */
  checkInOpen: '07:00:00',
  /** 이 시각까지는 정상, 1초라도 넘기면 지각 (A-2) */
  lateAfter: '10:00:00',
  /** 퇴근 등록 가능 시작 (B-1) */
  checkOutOpen: '16:00:00',
  /** 퇴근 등록 마감 = 근무일 끝 (C-4) */
  dayEnd: '23:59:59',

  /** 점심 구간 (B-3) — 근무 구간과 겹치는 만큼 차감 */
  lunchStart: '11:30:00',
  lunchEnd: '12:30:00',

  /** 이 분 미만이면 조퇴 (B-4) */
  fullDayMinutes: 480,
  /** 반일 OFF 사용일 기준 (B-5) */
  halfOffMinutes: 240,

  /** 재택 월 한도, 이월 없음 (L-5) */
  remotePerMonth: 2,
  /** OFF 유효기간: 근무일 + N일의 23:59:59 (L-6) */
  offValidDays: 30,

  /** 신청 기한: 사용일 직전 영업일의 이 시각까지 (R-3) */
  requestDeadline: '17:00:00',
} as const;
