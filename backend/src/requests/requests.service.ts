import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import { BalanceService } from '../balance/balance.service.js';
import { annualRemaining, offGrants, pickOffGrantFor, remoteRemaining } from '../balance/policy/balance.policy.js';
import { BusinessDayService } from '../common/calendar/business-day.service.js';
import { ClockService } from '../common/clock/clock.service.js';
import type { AuthUser } from '../common/decorators.js';
import { AppException, ERROR_MESSAGES, ErrorCode } from '../common/errors.js';
import { dateOf, fromEpoch, labelDateTime, monthOf } from '../common/time.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { User } from '../users/user.entity.js';
import {
  hasDuplicateConflict,
  isBeforeDeadline,
  needsIpAndWindow,
  requestDeadline,
  validateIp,
  validateTargetDate,
  validateTimeRange,
} from './policy/request.policy.js';
import { ACTIVE_STATUSES, type OffHalf, type RequestStatus, type RequestType, WorkRequest } from './request.entity.js';

export interface CreateRequestInput {
  type: RequestType;
  targetDate: string;
  reason: string;
  ip?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  offHalf?: OffHalf | null;
}

@Injectable()
export class RequestsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: ClockService,
    private readonly calendar: BusinessDayService,
    private readonly balance: BalanceService,
    private readonly dataSource: DataSource,
    @InjectRepository(WorkRequest) private readonly repo: Repository<WorkRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  deadlineOf(targetDate: string) {
    const d = requestDeadline(targetDate, this.calendar.isHoliday);
    return {
      ...d,
      iso: new Date(d.epochMs).toISOString(),
      label: labelDateTime(fromEpoch(d.epochMs)),
      passed: !isBeforeDeadline(this.clock.nowMs(), d.epochMs),
    };
  }

  /**
   * R-9 [추가 결정]: 사용일이 되었는데 PENDING 인 건은 EXPIRED 로 바꾸고 예약분을 돌려준다.
   * 배치 대신 조회·변경 API 진입 시 lazy 하게 처리 (시간 조작과 맞물리도록).
   */
  async expireStale(): Promise<void> {
    const today = dateOf(this.clock.now());
    const stale = await this.repo.find({
      where: { status: 'PENDING', targetDate: LessThanOrEqual(today) },
    });
    if (stale.length === 0) return;
    await this.dataSource.transaction(async (m) => {
      for (const r of stale) {
        r.status = 'EXPIRED';
        await m.save(r);
        await this.balance.refund(m, r, '미승인 만료');
      }
    });
  }

  /** 그 날짜에 효력이 있는 신청 (APPROVED 만, R-8) */
  async effectiveFor(userId: number, date: string): Promise<WorkRequest[]> {
    return this.repo.find({ where: { userId, targetDate: date, status: 'APPROVED' } });
  }

  async effectiveOn(date: string): Promise<WorkRequest[]> {
    return this.repo.find({ where: { targetDate: date, status: 'APPROVED' } });
  }

  /** FN-REQ-01 */
  async create(authUser: AuthUser, input: CreateRequestInput): Promise<WorkRequest> {
    await this.expireStale();
    const user = await this.users.findOneByOrFail({ id: authUser.id });
    const type = input.type;

    // R-2 필수 입력
    if (needsIpAndWindow(type)) {
      if (!input.ip || !input.startTime || !input.endTime) {
        throw new AppException(ErrorCode.REQ_MISSING_FIELDS, { required: ['ip', 'startTime', 'endTime'] });
      }
      const ipErr = validateIp(input.ip);
      if (ipErr) throw new AppException(ipErr);
      const tErr = validateTimeRange(input.startTime, input.endTime);
      if (tErr) throw new AppException(tErr);
    }
    if (type === 'OFF' && !input.offHalf) {
      throw new AppException(ErrorCode.REQ_MISSING_FIELDS, { required: ['offHalf'] });
    }

    // R-4 날짜 유효성
    const dErr = validateTargetDate(type, input.targetDate, this.calendar.isHoliday);
    if (dErr) throw new AppException(dErr);

    // R-3 기한
    const deadline = this.deadlineOf(input.targetDate);
    if (deadline.passed) {
      throw new AppException(ErrorCode.REQ_DEADLINE_PASSED, { deadline: deadline.iso, label: deadline.label });
    }

    return this.dataSource.transaction(async (m) => {
      // R-5 중복
      const sameDay = await m.find(WorkRequest, {
        where: { userId: user.id, targetDate: input.targetDate, status: In(ACTIVE_STATUSES) },
      });
      if (hasDuplicateConflict(type, sameDay.map((r) => r.type))) {
        throw new AppException(ErrorCode.REQ_DUPLICATE, {
          existing: sameDay.map((r) => ({ id: r.id, type: r.type, status: r.status })),
        });
      }

      const now = this.clock.nowIso();
      const approvedNow = !this.config.requireApproval;
      const entity = m.create(WorkRequest, {
        userId: user.id,
        type,
        targetDate: input.targetDate,
        reason: input.reason,
        ip: needsIpAndWindow(type) ? input.ip! : null,
        startTime: needsIpAndWindow(type) ? input.startTime! : null,
        endTime: needsIpAndWindow(type) ? input.endTime! : null,
        offHalf: type === 'OFF' ? input.offHalf! : null,
        status: approvedNow ? 'APPROVED' : 'PENDING',
        reviewerId: null,
        reviewedAt: approvedNow ? now : null,
        rejectReason: null,
        canceledAt: null,
        createdAt: now,
      });
      const saved = await m.save(entity);
      // R-6 잔여 검사 + 예약 차감 (실패하면 트랜잭션 롤백)
      await this.balance.reserve(m, user, saved);
      return saved;
    });
  }

  /** R-7: 본인이, 기한(직전 영업일 17:00) 전까지 */
  async cancel(authUser: AuthUser, id: number): Promise<WorkRequest> {
    await this.expireStale();
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new AppException(ErrorCode.NOT_FOUND);
    if (r.userId !== authUser.id) throw new AppException(ErrorCode.REQ_NOT_OWNER);
    if (!ACTIVE_STATUSES.includes(r.status) || this.deadlineOf(r.targetDate).passed) {
      throw new AppException(ErrorCode.REQ_NOT_CANCELABLE);
    }
    return this.dataSource.transaction(async (m) => {
      r.status = 'CANCELED';
      r.canceledAt = this.clock.nowIso();
      await m.save(r);
      await this.balance.refund(m, r, '취소');
      return r;
    });
  }

  /** FN-REQ-02 승인. R-9: 사용일이 시작된 건은 승인 불가 */
  async approve(lead: AuthUser, id: number): Promise<WorkRequest> {
    await this.expireStale();
    const r = await this.mustPending(id);
    if (r.targetDate <= dateOf(this.clock.now())) {
      throw new AppException(ErrorCode.REQ_REVIEW_EXPIRED);
    }
    r.status = 'APPROVED';
    r.reviewerId = lead.id;
    r.reviewedAt = this.clock.nowIso();
    return this.repo.save(r);
  }

  async reject(lead: AuthUser, id: number, reason: string): Promise<WorkRequest> {
    await this.expireStale();
    const r = await this.mustPending(id);
    return this.dataSource.transaction(async (m) => {
      r.status = 'REJECTED';
      r.reviewerId = lead.id;
      r.reviewedAt = this.clock.nowIso();
      r.rejectReason = reason;
      await m.save(r);
      await this.balance.refund(m, r, '반려');
      return r;
    });
  }

  private async mustPending(id: number): Promise<WorkRequest> {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new AppException(ErrorCode.NOT_FOUND);
    if (r.status !== 'PENDING') throw new AppException(ErrorCode.REQ_NOT_PENDING);
    return r;
  }

  async get(id: number): Promise<WorkRequest> {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new AppException(ErrorCode.NOT_FOUND);
    return r;
  }

  async listMine(userId: number) {
    await this.expireStale();
    const rows = await this.repo.find({ where: { userId }, order: { targetDate: 'DESC', id: 'DESC' } });
    return rows.map((r) => this.view(r));
  }

  async listTeam(status?: RequestStatus) {
    await this.expireStale();
    const rows = await this.repo.find({
      where: status ? { status } : {},
      order: { targetDate: 'DESC', id: 'DESC' },
    });
    const users = new Map((await this.users.find()).map((u) => [u.id, u.name]));
    return rows.map((r) => ({ ...this.view(r), userName: users.get(r.userId) ?? '?' }));
  }

  /** 화면용: 취소 가능 여부, 기한 라벨 */
  view(r: WorkRequest) {
    const dl = this.deadlineOf(r.targetDate);
    return {
      ...r,
      deadline: dl.iso,
      deadlineLabel: dl.label,
      cancelable: ACTIVE_STATUSES.includes(r.status) && !dl.passed,
    };
  }

  /** 신청 화면의 실시간 안내 (기한·잔여). 판정은 모두 서버에서 */
  async preview(authUser: AuthUser, type: RequestType, targetDate: string) {
    const user = await this.users.findOneByOrFail({ id: authUser.id });
    const dateError = validateTargetDate(type, targetDate, this.calendar.isHoliday);
    const deadline = dateError === ErrorCode.REQ_INVALID_DATE ? null : this.deadlineOf(targetDate);
    const rows = await this.balance.rows(user.id);
    const now = this.clock.now();
    let balance: { remaining: number; label: string; error?: string | null } | null = null;
    if (!dateError) {
      if (type === 'ANNUAL') {
        const a = annualRemaining(user.joinDate, dateOf(now), rows);
        balance = { remaining: a.remaining, label: `연차 잔여 ${a.remaining}일`, error: a.remaining < 1 ? ErrorCode.REQ_ANNUAL_INSUFFICIENT : null };
      } else if (type === 'REMOTE') {
        const m = monthOf(targetDate);
        const r = remoteRemaining(m, rows);
        balance = { remaining: r.remaining, label: `${m} 재택 잔여 ${r.remaining}/${r.limit}회`, error: r.remaining < 1 ? ErrorCode.REQ_REMOTE_LIMIT : null };
      } else if (type === 'OFF') {
        const g = offGrants(rows, now.valueOf());
        const pick = pickOffGrantFor(g, targetDate);
        const usable = g.filter((x) => x.remaining > 0 && targetDate <= x.expireDate).reduce((s, x) => s + x.remaining, 0);
        balance = {
          remaining: usable,
          label: `이 날짜에 쓸 수 있는 OFF ${usable}개`,
          error: 'error' in pick ? (pick.error === 'EXPIRED' ? ErrorCode.REQ_OFF_EXPIRED : ErrorCode.REQ_OFF_INSUFFICIENT) : null,
        };
      }
    }
    const sameDay = await this.repo.find({ where: { userId: user.id, targetDate, status: In(ACTIVE_STATUSES) } });
    const duplicate = !dateError && hasDuplicateConflict(type, sameDay.map((r) => r.type));
    const problems = [
      dateError,
      deadline?.passed ? ErrorCode.REQ_DEADLINE_PASSED : null,
      duplicate ? ErrorCode.REQ_DUPLICATE : null,
      balance?.error ?? null,
    ].filter((x): x is ErrorCode => !!x);
    return {
      type,
      targetDate,
      problemMessages: problems.map((c) => ({ code: c, message: ERROR_MESSAGES[c] })),
      deadline: deadline ? { iso: deadline.iso, label: deadline.label, passed: deadline.passed } : null,
      balance,
      problems,
      canSubmit: problems.length === 0,
      requireApproval: this.config.requireApproval,
    };
  }
}
