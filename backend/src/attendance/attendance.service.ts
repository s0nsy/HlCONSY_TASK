import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, LessThan, Like, Repository } from 'typeorm';
import { BalanceService } from '../balance/balance.service.js';
import { BusinessDayService } from '../common/calendar/business-day.service.js';
import { ClockService } from '../common/clock/clock.service.js';
import type { AuthUser } from '../common/decorators.js';
import { AppException, ERROR_MESSAGES, ErrorCode } from '../common/errors.js';
import { AllowedIp } from '../common/ip/allowed-ip.entity.js';
import { dateOf, fromIso, kstInstant, normalizeTime, secOfDay, timeOf, toSec } from '../common/time.js';
import type { WorkRequest } from '../requests/request.entity.js';
import { RequestsService } from '../requests/requests.service.js';
import { Attendance, type DayType } from './attendance.entity.js';
import { type DayContext, evaluateCheckIn, evaluateCheckOut } from './policy/attendance.policy.js';

export interface ManualCheckoutInput {
  attendanceId: number;
  /** HH:mm 또는 HH:mm:ss — 그 근무일의 시각 */
  checkOutTime: string;
}

/** 그 날짜의 효력 있는 신청들 */
export interface DayRequests {
  business: boolean;
  holidayName: string | null;
  annual: WorkRequest | null;
  remote: WorkRequest | null;
  off: WorkRequest | null;
  holidayWork: WorkRequest | null;
}

export interface Availability {
  can: boolean;
  code: ErrorCode | null;
  reason: string | null;
}

const ok: Availability = { can: true, code: null, reason: null };
const no = (code: ErrorCode, reason?: string): Availability => ({
  can: false,
  code,
  reason: reason ?? ERROR_MESSAGES[code],
});

@Injectable()
export class AttendanceService {
  constructor(
    private readonly clock: ClockService,
    private readonly calendar: BusinessDayService,
    private readonly requests: RequestsService,
    private readonly balance: BalanceService,
    private readonly dataSource: DataSource,
    @InjectRepository(Attendance) private readonly repo: Repository<Attendance>,
    @InjectRepository(AllowedIp) private readonly allowedIps: Repository<AllowedIp>,
  ) {}

  async dayRequests(userId: number, date: string): Promise<DayRequests> {
    const reqs = await this.requests.effectiveFor(userId, date);
    const find = (t: WorkRequest['type']) => reqs.find((r) => r.type === t) ?? null;
    return {
      business: this.calendar.isBusinessDay(date),
      holidayName: this.calendar.holidayName(date),
      annual: find('ANNUAL'),
      remote: find('REMOTE'),
      off: find('OFF'),
      holidayWork: find('HOLIDAY_WORK'),
    };
  }

  private async isLab(ip: string): Promise<boolean> {
    return (await this.allowedIps.countBy({ ip })) > 0;
  }

  async today(userId: number): Promise<Attendance | null> {
    return this.repo.findOneBy({ userId, workDate: dateOf(this.clock.now()) });
  }

  /** M-1: 출근은 있고 퇴근이 없는 지난 근무일 (오래된 순) */
  async pendingCheckouts(userId: number): Promise<Attendance[]> {
    return this.repo.find({
      where: { userId, checkOutAt: IsNull(), workDate: LessThan(dateOf(this.clock.now())) },
      order: { workDate: 'ASC' },
    });
  }

  /**
   * 오늘 출근 가능 여부와 근무 형태. 버튼 활성화(canCheckIn)와 API 가 같은 함수를 쓴다.
   */
  async checkInAvailability(
    user: AuthUser,
    ip: string,
  ): Promise<Availability & { dayType: DayType | null; workRequest: WorkRequest | null; halfOff: WorkRequest | null }> {
    const now = this.clock.now();
    const date = dateOf(now);
    const base = { dayType: null, workRequest: null, halfOff: null };
    if (await this.repo.findOneBy({ userId: user.id, workDate: date })) {
      return { ...no(ErrorCode.ATT_ALREADY_CHECKED_IN), ...base };
    }
    const dr = await this.dayRequests(user.id, date);
    if (dr.annual) return { ...no(ErrorCode.ATT_ANNUAL_LEAVE_DAY), ...base };

    let dayType: DayType;
    let workRequest: WorkRequest | null = null;
    if (!dr.business) {
      // W-1: 사전 신청 필수 / W-2: 신청 IP + 시간대
      if (!dr.holidayWork) return { ...no(ErrorCode.ATT_NO_HOLIDAY_WORK_REQUEST), ...base };
      if (dr.holidayWork.ip !== ip) return { ...no(ErrorCode.ATT_IP_MISMATCH), ...base };
      dayType = 'HOLIDAY_WORK';
      workRequest = dr.holidayWork;
    } else if (dr.remote && dr.remote.ip === ip) {
      dayType = 'REMOTE';
      workRequest = dr.remote;
    } else if (await this.isLab(ip)) {
      dayType = 'WEEKDAY';
    } else {
      return { ...no(ErrorCode.ATT_IP_MISMATCH), ...base };
    }

    const ctx = this.ctx(dayType, !!dr.off, workRequest);
    const v = evaluateCheckIn(secOfDay(now), ctx);
    if (!v.ok) return { ...no(v.code), dayType, workRequest, halfOff: dr.off };
    return { ...ok, dayType, workRequest, halfOff: dr.off };
  }

  async checkOutAvailability(user: AuthUser, ip: string): Promise<Availability> {
    const now = this.clock.now();
    const att = await this.today(user.id);
    if (!att) return no(ErrorCode.ATT_NOT_CHECKED_IN);
    if (att.checkOutAt) return no(ErrorCode.ATT_ALREADY_CHECKED_OUT);
    const ctx = await this.ctxOf(att);
    if (att.dayType === 'HOLIDAY_WORK' || att.dayType === 'REMOTE') {
      const wr = att.workRequestId ? await this.requests.get(att.workRequestId) : null;
      if (wr && wr.ip !== ip && !(att.dayType === 'REMOTE' && (await this.isLab(ip)))) {
        return no(ErrorCode.ATT_IP_MISMATCH);
      }
    }
    const v = evaluateCheckOut(toSec(timeOf(fromIso(att.checkInAt))), secOfDay(now), ctx);
    if (!v.ok) return no(v.code);
    return ok;
  }

  private ctx(dayType: DayType, halfOff: boolean, wr: WorkRequest | null): DayContext {
    return {
      dayType,
      halfOff,
      window: wr?.startTime && wr.endTime ? { start: wr.startTime, end: wr.endTime } : null,
    };
  }

  private async ctxOf(att: Attendance): Promise<DayContext> {
    const wr = att.workRequestId ? await this.requests.get(att.workRequestId) : null;
    return this.ctx(att.dayType, att.usedOffRequestId !== null, wr);
  }

  /** FN-ATT-01 + FN-ATT-03: 출근 (밀린 퇴근 직접 입력을 한 트랜잭션으로) */
  async checkIn(user: AuthUser, ip: string, manual: ManualCheckoutInput[] = []) {
    const pending = await this.pendingCheckouts(user.id);
    const avail = await this.checkInAvailability(user, ip);
    if (!avail.can) throw new AppException(avail.code!);

    // M-2: 미기록 건이 있으면 오래된 순서로 전부 입력해야 한다
    if (pending.length > 0) {
      const given = new Map(manual.map((m) => [m.attendanceId, m.checkOutTime]));
      const missing = pending.filter((p) => !given.has(p.id));
      if (missing.length > 0) {
        throw new AppException(ErrorCode.ATT_PENDING_CHECKOUT_REQUIRED, {
          pending: await Promise.all(pending.map((p) => this.pendingView(p))),
        });
      }
    }
    const extra = manual.filter((m) => !pending.some((p) => p.id === m.attendanceId));
    if (extra.length > 0) {
      throw new AppException(ErrorCode.ATT_MANUAL_INVALID, { unknownAttendanceIds: extra.map((e) => e.attendanceId) });
    }

    // M-3 검증 (전부 통과해야 저장)
    const updates: { att: Attendance; out: string; work: number; lunch: number; early: boolean }[] = [];
    for (const p of pending) {
      const t = manual.find((m) => m.attendanceId === p.id)!.checkOutTime;
      if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t)) {
        throw new AppException(ErrorCode.ATT_MANUAL_INVALID, { attendanceId: p.id, workDate: p.workDate });
      }
      const ctx = await this.ctxOf(p);
      const inSec = toSec(timeOf(fromIso(p.checkInAt)));
      const v = evaluateCheckOut(inSec, toSec(t), ctx);
      if (!v.ok) {
        throw new AppException(ErrorCode.ATT_MANUAL_INVALID, {
          attendanceId: p.id,
          workDate: p.workDate,
          cause: v.code,
          causeMessage: ERROR_MESSAGES[v.code],
        });
      }
      updates.push({
        att: p,
        out: kstInstant(p.workDate, normalizeTime(t)).toISOString(),
        work: v.workMinutes,
        lunch: v.lunchMinutes,
        early: v.isEarlyLeave,
      });
    }

    const now = this.clock.now();
    const nowIso = this.nowSecIso();
    const v = evaluateCheckIn(secOfDay(now), this.ctx(avail.dayType!, !!avail.halfOff, avail.workRequest));
    if (!v.ok) throw new AppException(v.code);

    try {
      return await this.dataSource.transaction(async (m) => {
        for (const u of updates) {
          Object.assign(u.att, {
            checkOutAt: u.out,
            checkOutSource: 'MANUAL',
            manualEnteredAt: nowIso,
            workMinutes: u.work,
            lunchMinutes: u.lunch,
            isEarlyLeave: u.early,
            checkOutIp: ip,
          });
          await m.save(u.att);
          // M-5: 지급일은 근무일
          if (u.att.dayType === 'HOLIDAY_WORK') await this.balance.grantOff(m, u.att);
        }
        const att = m.create(Attendance, {
          userId: user.id,
          workDate: dateOf(now),
          checkInAt: nowIso,
          checkOutAt: null,
          checkOutSource: null,
          manualEnteredAt: null,
          workMinutes: null,
          lunchMinutes: null,
          isLate: v.isLate,
          isEarlyLeave: false,
          dayType: avail.dayType!,
          usedOffRequestId: avail.halfOff?.id ?? null,
          workRequestId: avail.workRequest?.id ?? null,
          checkInIp: ip,
          checkOutIp: null,
        });
        const saved = await m.save(att);
        return {
          attendance: this.view(saved),
          resolved: updates.map((u) => this.view(u.att)),
        };
      });
    } catch (e) {
      if (/UNIQUE|duplicate/i.test(String((e as Error).message))) {
        throw new AppException(ErrorCode.ATT_ALREADY_CHECKED_IN);
      }
      throw e;
    }
  }

  /** FN-ATT-02 */
  async checkOut(user: AuthUser, ip: string) {
    const avail = await this.checkOutAvailability(user, ip);
    if (!avail.can) throw new AppException(avail.code!);
    const att = (await this.today(user.id))!;
    const ctx = await this.ctxOf(att);
    const now = this.clock.now();
    const v = evaluateCheckOut(toSec(timeOf(fromIso(att.checkInAt))), secOfDay(now), ctx);
    if (!v.ok) throw new AppException(v.code);
    return this.dataSource.transaction(async (m: EntityManager) => {
      Object.assign(att, {
        checkOutAt: this.nowSecIso(),
        checkOutSource: 'BUTTON',
        workMinutes: v.workMinutes,
        lunchMinutes: v.lunchMinutes,
        isEarlyLeave: v.isEarlyLeave,
        checkOutIp: ip,
      });
      await m.save(att);
      if (att.dayType === 'HOLIDAY_WORK') await this.balance.grantOff(m, att);
      return { attendance: this.view(att) };
    });
  }

  /** C-3: 기록은 초 단위 (밀리초 버림) */
  private nowSecIso(): string {
    const ms = Math.floor(this.clock.nowMs() / 1000) * 1000;
    return new Date(ms).toISOString();
  }

  async month(userId: number, month: string) {
    const rows = await this.repo.find({
      where: { userId, workDate: Like(`${month}-%`) },
      order: { workDate: 'ASC' },
    });
    return rows.map((r) => this.view(r));
  }

  async pendingView(p: Attendance) {
    const ctx = await this.ctxOf(p);
    return {
      ...this.view(p),
      rule:
        ctx.dayType === 'HOLIDAY_WORK'
          ? `신청 시간대 ${ctx.window?.start}~${ctx.window?.end} 안`
          : ctx.halfOff
            ? '출근 시각 이후 ~ 23:59:59 (반일 OFF 사용일)'
            : '16:00:00 ~ 23:59:59',
    };
  }

  view(a: Attendance) {
    const badges: string[] = [];
    if (a.isLate) badges.push('LATE');
    if (a.isEarlyLeave) badges.push('EARLY_LEAVE');
    if (a.checkOutSource === 'MANUAL') badges.push('MANUAL');
    if (a.usedOffRequestId) badges.push('OFF');
    return {
      ...a,
      checkInTime: timeOf(fromIso(a.checkInAt)),
      checkOutTime: a.checkOutAt ? timeOf(fromIso(a.checkOutAt)) : null,
      badges,
    };
  }

  /** 대시보드/정산 공용 */
  async byDate(date: string): Promise<Attendance[]> {
    return this.repo.findBy({ workDate: date });
  }

  async all(where: Partial<Pick<Attendance, 'userId'>> = {}): Promise<Attendance[]> {
    return this.repo.find({ where, order: { workDate: 'DESC' } });
  }

}
