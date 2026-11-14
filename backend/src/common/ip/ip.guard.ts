import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { In, Repository } from 'typeorm';
import { AuthService } from '../../auth/auth.service.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { WorkRequest } from '../../requests/request.entity.js';
import { inWindow } from '../../attendance/policy/attendance.policy.js';
import { ClockService } from '../clock/clock.service.js';
import { AppException, ErrorCode } from '../errors.js';
import { dateOf, secOfDay } from '../time.js';
import { AllowedIp } from './allowed-ip.entity.js';
import { clientIp } from './ip.util.js';

/**
 * FN-SYS-01 전역 IP 검사 (4.3). 로그인·dev API 포함 모든 요청에 적용.
 *  1. 연구실 IP → 허용
 *  2. 현재 서버 시각에 유효한(APPROVED, 오늘, 시간대 안) 재택/주말·공휴일 근무 신청 중 ip 일치
 *     - 로그인 전: 누구 것이든 허용 / 로그인 후: 본인 것이어야
 *  3. 그 외 403 IP_DENIED
 */
@Injectable()
export class IpGuard implements CanActivate {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: ClockService,
    private readonly auth: AuthService,
    @InjectRepository(AllowedIp) private readonly allowedIps: Repository<AllowedIp>,
    @InjectRepository(WorkRequest) private readonly requests: Repository<WorkRequest>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = clientIp(req, this.config);
    const decision = await this.check(ip, req);
    if (decision) return true;
    throw new AppException(
      ErrorCode.IP_DENIED,
      { ip, serverTime: this.clock.nowIso() },
      `허용되지 않은 IP입니다: ${ip}`,
    );
  }

  private async check(ip: string, req: Request): Promise<boolean> {
    if (await this.isLabIp(ip)) return true;
    const grants = await this.activeGrantsForIp(ip);
    if (grants.length === 0) return false;
    const user = await this.auth.userFromRequest(req);
    if (!user) return true;
    return grants.some((g) => g.userId === user.id);
  }

  async isLabIp(ip: string): Promise<boolean> {
    return (await this.allowedIps.countBy({ ip })) > 0;
  }

  /** 지금 이 IP 로 유효한 재택/주말 근무 신청 */
  async activeGrantsForIp(ip: string): Promise<WorkRequest[]> {
    const now = this.clock.now();
    const today = dateOf(now);
    const sec = secOfDay(now);
    const rows = await this.requests.find({
      where: {
        ip,
        targetDate: today,
        status: 'APPROVED',
        type: In(['REMOTE', 'HOLIDAY_WORK']),
      },
    });
    return rows.filter(
      (r) => r.startTime && r.endTime && inWindow(sec, { start: r.startTime, end: r.endTime }),
    );
  }
}
