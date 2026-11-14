import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { Attendance } from '../attendance/attendance.entity.js';
import { ClockService } from '../common/clock/clock.service.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { addMonthsClamped, dateOf, monthOf } from '../common/time.js';
import type { WorkRequest } from '../requests/request.entity.js';
import { User } from '../users/user.entity.js';
import { BalanceLedger } from './balance-ledger.entity.js';
import {
  annualAccrualDates,
  annualRemaining,
  type LedgerRow,
  offAvailable,
  offExpiresAtMs,
  offGrants,
  pickOffGrantFor,
  remoteRemaining,
} from './policy/balance.policy.js';

const TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차',
  REMOTE: '재택',
  OFF: '반일 OFF',
};

@Injectable()
export class BalanceService {
  constructor(
    private readonly clock: ClockService,
    @InjectRepository(BalanceLedger) private readonly ledger: Repository<BalanceLedger>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private repo(manager?: EntityManager): Repository<BalanceLedger> {
    return manager ? manager.getRepository(BalanceLedger) : this.ledger;
  }

  async rows(userId: number, manager?: EntityManager): Promise<BalanceLedger[]> {
    return this.repo(manager).find({ where: { userId }, order: { id: 'ASC' } });
  }

  /** FN-BAL-01 잔여 요약. 모든 값은 원장에서 매번 계산 (L-9) */
  async summary(userId: number, manager?: EntityManager) {
    const user = await this.users.findOneByOrFail({ id: userId });
    const rows = await this.rows(userId, manager);
    const now = this.clock.now();
    const today = dateOf(now);
    const month = monthOf(today);
    const nextMonth = monthOf(addMonthsClamped(`${month}-01`, 1));
    const annual = annualRemaining(user.joinDate, today, rows);
    const accruals = annualAccrualDates(user.joinDate, today);
    const grants = offGrants(rows, now.valueOf());
    return {
      userId,
      asOf: now.toISOString(),
      annual: {
        ...annual,
        nextAccrualDate: addMonthsClamped(user.joinDate, accruals.length + 1),
      },
      remote: {
        thisMonth: { month, ...remoteRemaining(month, rows) },
        nextMonth: { month: nextMonth, ...remoteRemaining(nextMonth, rows) },
      },
      off: {
        available: offAvailable(grants),
        grants,
      },
    };
  }

  /** 원장 내역 + 연차 적립(계산값)을 합친 화면용 목록 */
  async history(userId: number) {
    const user = await this.users.findOneByOrFail({ id: userId });
    const rows = await this.rows(userId);
    const today = dateOf(this.clock.now());
    const accrualRows = annualAccrualDates(user.joinDate, today).map((d, i) => ({
      id: null as number | null,
      kind: 'ANNUAL',
      delta: 1,
      reason: `연차 적립 (${i + 1}개월차, 계산값)`,
      requestId: null as number | null,
      attendanceId: null as number | null,
      effectiveDate: d,
      occurredAt: null as string | null,
      expiresAt: null as string | null,
      computed: true,
    }));
    const real = rows.map((r) => ({ ...r, computed: false }));
    return [...accrualRows, ...real].sort((a, b) =>
      a.effectiveDate === b.effectiveDate
        ? (a.id ?? 0) - (b.id ?? 0)
        : a.effectiveDate.localeCompare(b.effectiveDate),
    );
  }

  /**
   * R-6: 제출 시점에 잔여를 검사하고 예약 차감한다. 같은 트랜잭션 안에서 호출한다.
   * L-4: 미래 날짜 연차도 "지금" 잔여로 검사 (가불 불가)
   */
  async reserve(manager: EntityManager, user: User, req: WorkRequest): Promise<void> {
    if (req.type === 'HOLIDAY_WORK') return;
    const rows = await this.rows(user.id, manager);
    const now = this.clock.now();
    const base = {
      userId: user.id,
      delta: -1,
      requestId: req.id,
      attendanceId: null,
      effectiveDate: req.targetDate,
      occurredAt: now.toISOString(),
      expiresAt: null,
      reason: `${TYPE_LABEL[req.type]} 신청 #${req.id} (${req.targetDate})`,
    };

    if (req.type === 'ANNUAL') {
      const a = annualRemaining(user.joinDate, dateOf(now), rows);
      if (a.remaining < 1) throw new AppException(ErrorCode.REQ_ANNUAL_INSUFFICIENT, a);
      await manager.insert(BalanceLedger, { ...base, kind: 'ANNUAL', grantLedgerId: null });
      return;
    }
    if (req.type === 'REMOTE') {
      const r = remoteRemaining(monthOf(req.targetDate), rows);
      if (r.remaining < 1) throw new AppException(ErrorCode.REQ_REMOTE_LIMIT, r);
      await manager.insert(BalanceLedger, { ...base, kind: 'REMOTE', grantLedgerId: null });
      return;
    }
    // OFF
    const grants = offGrants(rows, now.valueOf());
    const pick = pickOffGrantFor(grants, req.targetDate);
    if ('error' in pick) {
      throw new AppException(
        pick.error === 'EXPIRED' ? ErrorCode.REQ_OFF_EXPIRED : ErrorCode.REQ_OFF_INSUFFICIENT,
        { available: offAvailable(grants) },
      );
    }
    await manager.insert(BalanceLedger, { ...base, kind: 'OFF', grantLedgerId: pick.grantId });
  }

  /** 반려·취소·만료 시 예약분을 돌려준다 (같은 지급 건으로) */
  async refund(manager: EntityManager, req: WorkRequest, why: string): Promise<void> {
    const rows = await manager.find(BalanceLedger, { where: { requestId: req.id } });
    const byKey = new Map<string, { kind: BalanceLedger['kind']; grant: number | null; sum: number }>();
    for (const r of rows) {
      const k = `${r.kind}:${r.grantLedgerId ?? ''}`;
      const e = byKey.get(k) ?? { kind: r.kind, grant: r.grantLedgerId, sum: 0 };
      e.sum += r.delta;
      byKey.set(k, e);
    }
    for (const e of byKey.values()) {
      if (e.sum >= 0) continue;
      await manager.insert(BalanceLedger, {
        userId: req.userId,
        kind: e.kind,
        delta: -e.sum,
        reason: `${TYPE_LABEL[e.kind]} 반환 — 신청 #${req.id} ${why}`,
        requestId: req.id,
        attendanceId: null,
        grantLedgerId: e.grant,
        effectiveDate: req.targetDate,
        occurredAt: this.clock.nowIso(),
        expiresAt: null,
      });
    }
  }

  /** W-4 / L-6 / M-5: 주말·공휴일 근무 퇴근 기록 시 반일 OFF 1개 (같은 날 1회) */
  async grantOff(manager: EntityManager, att: Attendance): Promise<void> {
    const exists = await manager.count(BalanceLedger, {
      where: { attendanceId: att.id, kind: 'OFF' },
    });
    if (exists > 0) return;
    await manager.insert(BalanceLedger, {
      userId: att.userId,
      kind: 'OFF',
      delta: 1,
      reason: `주말/공휴일 근무 (${att.workDate}) 반일 OFF 지급`,
      requestId: att.workRequestId,
      attendanceId: att.id,
      grantLedgerId: null,
      effectiveDate: att.workDate,
      occurredAt: this.clock.nowIso(),
      expiresAt: new Date(offExpiresAtMs(att.workDate)).toISOString(),
    });
  }

  /** 순수 정책 함수에 넘길 형태 */
  static toRows(rows: BalanceLedger[]): LedgerRow[] {
    return rows;
  }
}
