import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Attendance } from '../attendance/attendance.entity.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { BalanceLedger } from '../balance/balance-ledger.entity.js';
import { ClockService } from '../common/clock/clock.service.js';
import type { AuthUser } from '../common/decorators.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { kstEpoch } from '../common/time.js';
import { WorkRequest } from '../requests/request.entity.js';
import { RequestsService } from '../requests/requests.service.js';
import { SEED_USERS } from '../seed/seed-data.js';
import { User } from '../users/user.entity.js';
import { SCENARIOS, type Scenario, type SetupAction } from './scenarios.js';

const LOCAL_IP = '127.0.0.1';

/** 9장 시나리오 원클릭 재현 (개발 모드 전용). 실제 서비스 로직을 그대로 호출해 준비 상태를 만든다. */
@Injectable()
export class ScenarioService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly requests: RequestsService,
    private readonly attendance: AttendanceService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  list() {
    return SCENARIOS.map((s) => this.publicView(s));
  }

  /** 근태·신청·잔여 원장을 비운다. 계정·공휴일·연구실 IP·이력은 그대로 둔다. */
  async reset(): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(Attendance).clear();
      await m.getRepository(WorkRequest).clear();
      await m.getRepository(BalanceLedger).clear();
    });
  }

  async run(id: string) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) throw new AppException(ErrorCode.NOT_FOUND, { scenario: id });

    await this.reset();
    for (const [i, action] of s.setup.entries()) {
      this.clock.set('fixed', this.epoch(action.date, action.time));
      try {
        await this.apply(action);
      } catch (e) {
        // 준비 단계가 실패하면 시나리오 정의가 규칙과 어긋난 것. 어느 단계인지 알려 준다
        this.clock.set('real');
        throw new AppException(ErrorCode.INTERNAL, {
          scenario: s.id,
          step: i + 1,
          action: action.kind,
          cause: (e as Error).message,
        });
      }
    }
    const [date, time] = s.clock.split(' ');
    const clock = this.clock.set('fixed', this.epoch(date, time));
    return { ...this.publicView(s), login: this.credentials(s.loginAs), clock };
  }

  private publicView({ setup: _setup, ...s }: Scenario) {
    return s;
  }

  /** 개발 모드에서 자동 로그인용. 시드 비밀번호 그대로 (실제 로그인 API 를 거쳐 IP 검사·이력이 똑같이 적용되게) */
  private credentials(loginId: string) {
    const u = SEED_USERS.find((x) => x.loginId === loginId);
    if (!u) throw new AppException(ErrorCode.NOT_FOUND, { loginId });
    return { loginId: u.loginId, password: u.password };
  }

  private epoch(date: string, time: string): number {
    return kstEpoch(date, time.length === 5 ? `${time}:00` : time);
  }

  private async authUser(loginId: string): Promise<AuthUser> {
    const u = await this.users.findOneByOrFail({ loginId });
    return { id: u.id, loginId: u.loginId, name: u.name, role: u.role, joinDate: u.joinDate };
  }

  private async apply(a: SetupAction): Promise<void> {
    const user = await this.authUser(a.user);
    switch (a.kind) {
      case 'checkIn':
        await this.attendance.checkIn(user, a.ip ?? LOCAL_IP);
        return;
      case 'checkOut':
        await this.attendance.checkOut(user, a.ip ?? LOCAL_IP);
        return;
      case 'request': {
        const r = await this.requests.create(user, a.input);
        if (a.approve && r.status === 'PENDING') {
          const lead = await this.users.findOneByOrFail({ role: 'LEAD' });
          await this.requests.approve(await this.authUser(lead.loginId), r.id);
        }
        return;
      }
    }
  }
}
