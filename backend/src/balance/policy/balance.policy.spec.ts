import { kstEpoch } from '../../common/time.js';
import {
  annualAccrualDates,
  annualRemaining,
  type LedgerRow,
  offAvailable,
  offExpiresAtMs,
  offGrants,
  pickOffGrantFor,
  remoteRemaining,
} from './balance.policy.js';

describe('연차 적립 (L-1, L-2, L-3)', () => {
  it('입사 다음 달 같은 날 첫 적립', () => {
    expect(annualAccrualDates('2026-01-01', '2026-01-31')).toEqual([]);
    expect(annualAccrualDates('2026-01-01', '2026-02-01')).toEqual(['2026-02-01']);
    expect(annualAccrualDates('2026-01-15', '2026-02-14')).toEqual([]);
    expect(annualAccrualDates('2026-01-15', '2026-02-15')).toEqual(['2026-02-15']);
    expect(annualAccrualDates('2026-02-12', '2026-03-11')).toEqual([]);
    expect(annualAccrualDates('2026-02-12', '2026-03-12')).toEqual(['2026-03-12']);
  });
  it('말일 보정: 적립일이 없는 달은 말일', () => {
    expect(annualAccrualDates('2026-01-31', '2026-05-31')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });
  it('잔여 = 적립 − 사용·예약', () => {
    const rows: LedgerRow[] = [
      { id: 1, kind: 'ANNUAL', delta: -1, effectiveDate: '2026-04-01', grantLedgerId: null, expiresAt: null },
      { id: 2, kind: 'ANNUAL', delta: -1, effectiveDate: '2026-04-02', grantLedgerId: null, expiresAt: null },
      { id: 3, kind: 'ANNUAL', delta: 1, effectiveDate: '2026-04-02', grantLedgerId: null, expiresAt: null },
    ];
    expect(annualRemaining('2026-01-01', '2026-03-15', rows)).toEqual({ accrued: 2, used: 1, remaining: 1 });
  });
});

describe('재택 (L-5)', () => {
  it('사용일이 속한 달 기준 2회, 다른 달은 별도', () => {
    const rows: LedgerRow[] = [
      { id: 1, kind: 'REMOTE', delta: -1, effectiveDate: '2026-12-01', grantLedgerId: null, expiresAt: null },
      { id: 2, kind: 'REMOTE', delta: -1, effectiveDate: '2026-12-02', grantLedgerId: null, expiresAt: null },
      { id: 3, kind: 'REMOTE', delta: -1, effectiveDate: '2027-01-04', grantLedgerId: null, expiresAt: null },
    ];
    expect(remoteRemaining('2026-12', rows).remaining).toBe(0);
    expect(remoteRemaining('2027-01', rows).remaining).toBe(1);
    expect(remoteRemaining('2026-11', rows).remaining).toBe(2);
  });
});

describe('OFF 지급·만료·FIFO (L-6, L-7, L-8)', () => {
  const grant = (id: number, date: string): LedgerRow => ({
    id,
    kind: 'OFF',
    delta: 1,
    effectiveDate: date,
    grantLedgerId: null,
    expiresAt: new Date(offExpiresAtMs(date)).toISOString(),
  });

  it('만료 = 근무일 + 30일 23:59:59 (KST)', () => {
    expect(new Date(offExpiresAtMs('2026-11-21')).toISOString()).toBe('2026-12-21T14:59:59.000Z');
  });

  it('만료 직전까지 유효, 지나면 만료 표시', () => {
    const rows = [grant(1, '2026-11-21')];
    expect(offAvailable(offGrants(rows, kstEpoch('2026-12-21', '23:59:59')))).toBe(1);
    const after = offGrants(rows, kstEpoch('2026-12-22', '00:00:00'));
    expect(after[0].expired).toBe(true);
    expect(offAvailable(after)).toBe(0);
  });

  it('만료가 가장 빠른 OFF 부터 차감', () => {
    const rows = [grant(1, '2026-11-28'), grant(2, '2026-11-21')];
    const g = offGrants(rows, kstEpoch('2026-11-30'));
    expect(pickOffGrantFor(g, '2026-12-01')).toEqual({ grantId: 2 });
  });

  it('사용·반환은 지급 건에 연결되어 잔여 계산', () => {
    const rows: LedgerRow[] = [
      grant(1, '2026-11-21'),
      { id: 2, kind: 'OFF', delta: -1, effectiveDate: '2026-11-24', grantLedgerId: 1, expiresAt: null },
    ];
    const g = offGrants(rows, kstEpoch('2026-11-22'));
    expect(g[0].remaining).toBe(0);
    expect(pickOffGrantFor(g, '2026-11-25')).toEqual({ error: 'NONE' });
    rows.push({ id: 3, kind: 'OFF', delta: 1, effectiveDate: '2026-11-24', grantLedgerId: 1, expiresAt: null });
    expect(pickOffGrantFor(offGrants(rows, kstEpoch('2026-11-22')), '2026-11-25')).toEqual({ grantId: 1 });
  });

  it('사용일에 만료되는 OFF 만 있으면 EXPIRED', () => {
    const g = offGrants([grant(1, '2026-11-21')], kstEpoch('2026-12-22'));
    expect(pickOffGrantFor(g, '2026-12-22')).toEqual({ error: 'EXPIRED' });
    expect(pickOffGrantFor(offGrants([], 0), '2026-12-22')).toEqual({ error: 'NONE' });
  });
});
