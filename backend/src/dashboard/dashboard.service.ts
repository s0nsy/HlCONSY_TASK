import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { Attendance } from '../attendance/attendance.entity.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { BalanceService } from '../balance/balance.service.js';
import { BusinessDayService } from '../common/calendar/business-day.service.js';
import { ClockService } from '../common/clock/clock.service.js';
import type { AuthUser } from '../common/decorators.js';
import { POLICY } from '../common/policy.config.js';
import { dateOf, secOfDay, toSec } from '../common/time.js';
import { RequestsService } from '../requests/requests.service.js';
import { User } from '../users/user.entity.js';

/** 5.8 상태 (우선순위 순) */
export type BoardStatus =
  | 'ANNUAL'
  | 'DONE'
  | 'WORKING'
  | 'REMOTE_PLANNED'
  | 'HOLIDAY_WORK_PLANNED'
  | 'NOT_CHECKED_IN'
  | 'DAY_OFF';

export const STATUS_LABEL: Record<BoardStatus, string> = {
  ANNUAL: '연차',
  DONE: '퇴근',
  WORKING: '근무중',
  REMOTE_PLANNED: '재택 예정',
  HOLIDAY_WORK_PLANNED: '주말/공휴일 근무 예정',
  NOT_CHECKED_IN: '미출근',
  DAY_OFF: '휴무',
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly clock: ClockService,
    private readonly calendar: BusinessDayService,
    private readonly attendance: AttendanceService,
    private readonly requests: RequestsService,
    private readonly balance: BalanceService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Attendance) private readonly attRepo: Repository<Attendance>,
  ) {}

  private dayInfo() {
    const now = this.clock.now();
    const date = dateOf(now);
    return {
      now: now.toISOString(),
      date,
      business: this.calendar.isBusinessDay(date),
      holidayName: this.calendar.holidayName(date),
      weekend: this.calendar.isWeekend(date),
    };
  }

  /** 팀원 1명의 오늘 상태 (5.8) */
  async statusOf(userId: number) {
    const now = this.clock.now();
    const date = dateOf(now);
    const dr = await this.attendance.dayRequests(userId, date);
    const att = await this.attRepo.findOneBy({ userId, workDate: date });
    const badges: string[] = [];
    let status: BoardStatus;
    let place: 'LAB' | 'REMOTE' | 'HOLIDAY_WORK' | null = null;
    let lateRisk = false;

    if (dr.annual) status = 'ANNUAL';
    else if (att?.checkOutAt) {
      status = 'DONE';
      badges.push(...this.attendance.view(att).badges.filter((b) => b !== 'OFF'));
    } else if (att) {
      status = 'WORKING';
      place = att.dayType === 'REMOTE' ? 'REMOTE' : att.dayType === 'HOLIDAY_WORK' ? 'HOLIDAY_WORK' : 'LAB';
      if (att.isLate) badges.push('LATE');
    } else if (dr.remote) status = 'REMOTE_PLANNED';
    else if (dr.business) {
      status = 'NOT_CHECKED_IN';
      // 10:00:01 이후 "지각 위험" (반일 OFF 사용일은 지각 판정이 없으므로 제외)
      lateRisk = !dr.off && secOfDay(now) > toSec(POLICY.lateAfter);
    } else if (dr.holidayWork) status = 'HOLIDAY_WORK_PLANNED';
    else status = 'DAY_OFF';

    if (dr.off) badges.push('OFF');
    if (att) place ??= att.dayType === 'REMOTE' ? 'REMOTE' : att.dayType === 'HOLIDAY_WORK' ? 'HOLIDAY_WORK' : 'LAB';

    return {
      status,
      statusLabel: STATUS_LABEL[status],
      place,
      lateRisk,
      badges,
      attendance: att ? this.attendance.view(att) : null,
      requests: {
        remote: dr.remote ? { id: dr.remote.id, ip: dr.remote.ip, startTime: dr.remote.startTime, endTime: dr.remote.endTime } : null,
        off: dr.off ? { id: dr.off.id, offHalf: dr.off.offHalf } : null,
        holidayWork: dr.holidayWork
          ? { id: dr.holidayWork.id, ip: dr.holidayWork.ip, startTime: dr.holidayWork.startTime, endTime: dr.holidayWork.endTime }
          : null,
      },
    };
  }

  /** FN-DSH-02 내 카드 */
  async me(user: AuthUser, ip: string) {
    await this.requests.expireStale();
    const [st, checkIn, checkOut, pending, balance] = await Promise.all([
      this.statusOf(user.id),
      this.attendance.checkInAvailability(user, ip),
      this.attendance.checkOutAvailability(user, ip),
      this.attendance.pendingCheckouts(user.id),
      this.balance.summary(user.id),
    ]);
    return {
      day: this.dayInfo(),
      user,
      clientIp: ip,
      ...st,
      canCheckIn: checkIn.can,
      checkInReason: checkIn.reason,
      checkInCode: checkIn.code,
      canCheckOut: checkOut.can,
      checkOutReason: checkOut.reason,
      checkOutCode: checkOut.code,
      pendingCheckouts: await Promise.all(pending.map((p) => this.attendance.pendingView(p))),
      balance,
    };
  }

  /** FN-DSH-01 팀 보드 */
  async team() {
    await this.requests.expireStale();
    const users = await this.users.find({ order: { id: 'ASC' } });
    const members = await Promise.all(
      users.map(async (u) => ({
        user: { id: u.id, name: u.name, role: u.role },
        ...(await this.statusOf(u.id)),
      })),
    );
    return { day: this.dayInfo(), members };
  }

  /** FN-DSH-03 퇴근 미기록 · 직접 입력 건 */
  async missing(user: AuthUser) {
    const today = dateOf(this.clock.now());
    const scope = user.role === 'LEAD' ? {} : { userId: user.id };
    const [unrecorded, manual] = await Promise.all([
      this.attRepo.find({
        where: { ...scope, checkOutAt: IsNull(), workDate: LessThan(today) },
        order: { workDate: 'DESC' },
      }),
      this.attRepo.find({
        where: { ...scope, checkOutSource: 'MANUAL', checkOutAt: Not(IsNull()) },
        order: { workDate: 'DESC' },
        take: 100,
      }),
    ]);
    const ids = [...new Set([...unrecorded, ...manual].map((a) => a.userId))];
    const names = new Map(
      (ids.length ? await this.users.findBy({ id: In(ids) }) : []).map((u) => [u.id, u.name]),
    );
    const v = (a: Attendance) => ({ ...this.attendance.view(a), userName: names.get(a.userId) ?? '?' });
    return { unrecorded: unrecorded.map(v), manual: manual.map(v) };
  }
}
