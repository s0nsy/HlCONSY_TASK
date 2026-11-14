import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Between, type FindOptionsWhere, Repository } from 'typeorm';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { ClockService } from '../clock/clock.service.js';
import { kstEpoch, addDays } from '../time.js';
import { clientIp } from '../ip/ip.util.js';
import { AuditLog } from './audit-log.entity.js';

const SENSITIVE = /pass(word)?|pwd|secret|token|authorization/i;

/** 비밀번호 등 민감 필드는 *** 로 바꾼다. 비밀번호 원문은 절대 저장하지 않는다. */
export function maskBody(body: unknown, depth = 0): unknown {
  if (body === null || body === undefined || depth > 5) return body;
  if (Array.isArray(body)) return body.map((b) => maskBody(b, depth + 1));
  if (typeof body === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '***' : maskBody(v, depth + 1);
    }
    return out;
  }
  return body;
}

export interface AuditInput {
  req: Request;
  action: string;
  result: 'SUCCESS' | 'FAIL';
  statusCode: number;
  errorCode?: string | null;
}

/** 경로 → 기본 액션 이름 (핸들러에 @Audit 이 없을 때) */
export function defaultAction(method: string, path: string): string {
  const p = path.split('?')[0].replace(/^\/api\/?/, '');
  const seg = p
    .split('/')
    .filter((s) => s && !/^\d+$/.test(s))
    .join('_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();
  return `${method.toUpperCase()}_${seg || 'ROOT'}`.slice(0, 50);
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: ClockService,
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async record(input: AuditInput): Promise<void> {
    const { req } = input;
    const r = req as any;
    if (r.__audited) return;
    r.__audited = true;
    const body =
      req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
        ? JSON.stringify(maskBody(req.body)).slice(0, 4000)
        : null;
    try {
      await this.repo.insert({
        userId: r.user?.id ?? r.__authUser?.id ?? null,
        action: input.action,
        method: req.method,
        path: (req.originalUrl ?? req.url).slice(0, 300),
        ip: clientIp(req, this.config),
        body,
        result: input.result,
        statusCode: input.statusCode,
        errorCode: input.errorCode ?? null,
        serverTime: this.clock.nowIso(),
        realTime: this.clock.realNowIso(),
      });
    } catch (e) {
      this.logger.error(`audit insert failed: ${(e as Error).message}`);
    }
  }

  async search(q: {
    userId?: number;
    action?: string;
    from?: string;
    to?: string;
    page: number;
    size: number;
  }): Promise<{ items: AuditLog[]; total: number; page: number; size: number }> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (q.userId) where.userId = q.userId;
    if (q.action) where.action = q.action;
    if (q.from || q.to) {
      const from = q.from ? new Date(kstEpoch(q.from)).toISOString() : '0000';
      const to = q.to ? new Date(kstEpoch(addDays(q.to, 1))).toISOString() : '9999';
      where.serverTime = Between(from, to);
    }
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (q.page - 1) * q.size,
      take: q.size,
    });
    return { items, total, page: q.page, size: q.size };
  }

  async actions(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('DISTINCT a.action', 'action')
      .orderBy('action')
      .getRawMany<{ action: string }>();
    return rows.map((r) => r.action);
  }
}
