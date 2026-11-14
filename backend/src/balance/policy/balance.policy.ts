/** 잔여 계산 순수 함수 (5.7) */
import { POLICY } from '../../common/policy.config.js';
import { addDays, addMonthsClamped, kstEpoch, monthOf } from '../../common/time.js';

/**
 * L-1, L-2: 입사일로부터 1개월이 지날 때마다 +1일.
 * 적립 순간 = 적립일 00:00 (Asia/Seoul). today 이하인 적립일 목록.
 */
export function annualAccrualDates(joinDate: string, today: string): string[] {
  const out: string[] = [];
  for (let k = 1; k < 1200; k++) {
    // 매번 입사일 기준으로 더해야 말일 보정이 누적되지 않는다 (1/31 → 2/28 → 3/31)
    const d = addMonthsClamped(joinDate, k);
    if (d > today) break;
    out.push(d);
  }
  return out;
}

export interface LedgerRow {
  id: number;
  kind: 'ANNUAL' | 'REMOTE' | 'OFF';
  delta: number;
  effectiveDate: string;
  grantLedgerId: number | null;
  expiresAt: string | null;
}

/** L-3: 적립 누계 − 사용·예약 (원장 delta 합) */
export function annualRemaining(
  joinDate: string,
  today: string,
  rows: LedgerRow[],
): { accrued: number; used: number; remaining: number } {
  const accrued = annualAccrualDates(joinDate, today).length;
  const net = rows
    .filter((r) => r.kind === 'ANNUAL')
    .reduce((s, r) => s + r.delta, 0);
  return { accrued, used: -net, remaining: accrued + net };
}

/** L-5: 사용일이 속한 달 기준 2회, 이월 없음 */
export function remoteRemaining(
  month: string,
  rows: LedgerRow[],
): { limit: number; used: number; remaining: number } {
  const net = rows
    .filter((r) => r.kind === 'REMOTE' && monthOf(r.effectiveDate) === month)
    .reduce((s, r) => s + r.delta, 0);
  return {
    limit: POLICY.remotePerMonth,
    used: -net,
    remaining: POLICY.remotePerMonth + net,
  };
}

/** L-6: 만료 = 근무일 + 30일의 23:59:59 */
export function offExpiresAtMs(workDate: string): number {
  return kstEpoch(addDays(workDate, POLICY.offValidDays), '23:59:59');
}
export function offExpireDate(workDate: string): string {
  return addDays(workDate, POLICY.offValidDays);
}

export interface OffGrantView {
  grantId: number;
  grantDate: string;
  expiresAt: string;
  /** 만료 날짜 (그날 23:59:59 까지 유효) */
  expireDate: string;
  remaining: number;
  /** L-8: 조회 시점 기준 만료 & 미사용 */
  expired: boolean;
}

/** 지급 행별 잔여 (지급 1 + 연결된 사용/반환 delta) */
export function offGrants(rows: LedgerRow[], nowMs: number): OffGrantView[] {
  const offRows = rows.filter((r) => r.kind === 'OFF');
  const grants = offRows.filter((r) => r.grantLedgerId === null && r.delta > 0);
  return grants
    .map((g) => {
      const linked = offRows
        .filter((r) => r.grantLedgerId === g.id)
        .reduce((s, r) => s + r.delta, 0);
      const remaining = g.delta + linked;
      const expiresMs = Date.parse(g.expiresAt ?? '');
      return {
        grantId: g.id,
        grantDate: g.effectiveDate,
        expiresAt: g.expiresAt ?? '',
        expireDate: offExpireDate(g.effectiveDate),
        remaining,
        expired: remaining > 0 && expiresMs < nowMs,
      };
    })
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

/** 현재 쓸 수 있는(미만료) OFF 개수 */
export function offAvailable(grants: OffGrantView[]): number {
  return grants.filter((g) => !g.expired).reduce((s, g) => s + g.remaining, 0);
}

/**
 * L-7: 사용일 기준 유효한 OFF 중 만료가 가장 빠른 것 (FIFO).
 * 없으면 이유를 돌려준다: 잔여는 있지만 사용일에 만료 → EXPIRED, 아예 없음 → NONE
 */
export function pickOffGrantFor(
  grants: OffGrantView[],
  targetDate: string,
): { grantId: number } | { error: 'EXPIRED' | 'NONE' } {
  const withRemaining = grants.filter((g) => g.remaining > 0);
  const usable = withRemaining
    .filter((g) => targetDate <= g.expireDate && g.grantDate <= targetDate)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  if (usable.length > 0) return { grantId: usable[0].grantId };
  return { error: withRemaining.length > 0 ? 'EXPIRED' : 'NONE' };
}
