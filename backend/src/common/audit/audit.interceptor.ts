import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { from, type Observable } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { AUDIT_ACTION, type AuditMeta } from '../decorators.js';
import { AuditService, defaultAction } from './audit.service.js';

/**
 * FN-LOG-01: 핸들러까지 도달한 모든 API 호출을 기록한다(조회 포함).
 * 가드에서 막힌 요청(IP 차단, 미로그인, 권한 없음)은 AllExceptionsFilter 가 기록한다.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_ACTION, context.getHandler());
    const action = meta?.action ?? defaultAction(req.method, req.path);

    return next.handle().pipe(
      mergeMap((data) =>
        from(
          this.audit
            .record({ req, action, result: 'SUCCESS', statusCode: res.statusCode })
            .then(() => data),
        ),
      ),
      catchError((err) =>
        from(
          this.audit
            .record({
              req,
              action: meta?.failAction ?? action,
              result: 'FAIL',
              statusCode: err instanceof HttpException ? err.getStatus() : 500,
              errorCode: errorCodeOf(err),
            })
            .then(() => {
              throw err;
            }),
        ),
      ),
    );
  }
}

export function errorCodeOf(err: unknown): string | null {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (body && typeof body === 'object' && 'code' in body) return String((body as any).code);
    return `HTTP_${err.getStatus()}`;
  }
  return 'INTERNAL';
}
