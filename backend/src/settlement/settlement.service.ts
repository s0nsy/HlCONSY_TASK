import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Attendance } from '../attendance/attendance.entity.js';
import { BalanceService } from '../balance/balance.service.js';
import type { AuthUser } from '../common/decorators.js';
import { RequestsService } from '../requests/requests.service.js';
import { WorkRequest } from '../requests/request.entity.js';
import { User } from '../users/user.entity.js';

/** FN-STL-01 월별 정산 */
@Injectable()
export class SettlementService {
  constructor(
    private readonly balance: BalanceService,
    private readonly requests: RequestsService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Attendance) private readonly att: Repository<Attendance>,
    @InjectRepository(WorkRequest) private readonly reqs: Repository<WorkRequest>,
  ) {}

  async month(viewer: AuthUser, month: string) {
    await this.requests.expireStale();
    const users =
      viewer.role === 'LEAD'
        ? await this.users.find({ order: { id: 'ASC' } })
        : await this.users.findBy({ id: viewer.id });

    const rows = await Promise.all(
      users.map(async (u) => {
        const days = await this.att.find({ where: { userId: u.id, workDate: Like(`${month}-%`) } });
        const approved = await this.reqs.find({
          where: { userId: u.id, targetDate: Like(`${month}-%`), status: 'APPROVED' },
        });
        const count = (t: WorkRequest['type']) => approved.filter((r) => r.type === t).length;
        const bal = await this.balance.summary(u.id);
        return {
          user: { id: u.id, name: u.name, role: u.role },
          workDays: days.length,
          weekdayDays: days.filter((d) => d.dayType !== 'HOLIDAY_WORK').length,
          holidayWorkDays: days.filter((d) => d.dayType === 'HOLIDAY_WORK').length,
          totalWorkMinutes: days.reduce((s, d) => s + (d.workMinutes ?? 0), 0),
          lateCount: days.filter((d) => d.isLate).length,
          earlyLeaveCount: days.filter((d) => d.isEarlyLeave).length,
          manualCount: days.filter((d) => d.checkOutSource === 'MANUAL').length,
          unrecordedCount: days.filter((d) => !d.checkOutAt).length,
          annualUsed: count('ANNUAL'),
          remoteUsed: count('REMOTE'),
          offUsed: count('OFF'),
          balance: {
            annual: bal.annual.remaining,
            remoteThisMonth: bal.remote.thisMonth.remaining,
            off: bal.off.available,
          },
        };
      }),
    );
    return { month, rows };
  }
}
