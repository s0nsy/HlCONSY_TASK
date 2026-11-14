import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_MESSAGES, type ErrorBody, ErrorCode } from '../errors.js';
import { AuditService, defaultAction } from './audit.service.js';

/** 오류 응답을 { code, message, details? } 로 통일하고, 아직 기록되지 않은 요청을 이력에 남긴다. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(private readonly audit: AuditService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { status, body } = this.toBody(exception);

    // 가드에서 막힌 요청 등 인터셉터를 거치지 않은 경우
    if (!(req as any).__audited) {
      const action =
        body.code === ErrorCode.IP_DENIED
          ? 'IP_DENIED'
          : body.code === ErrorCode.AUTH_REQUIRED
            ? 'AUTH_REQUIRED'
            : body.code === ErrorCode.FORBIDDEN
              ? 'FORBIDDEN'
              : defaultAction(req.method, req.path);
      await this.audit.record({
        req,
        action,
        result: 'FAIL',
        statusCode: status,
        errorCode: body.code,
      });
    }
    if (!res.headersSent) res.status(status).json(body);
  }

  private toBody(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (raw && typeof raw === 'object' && 'code' in raw && 'message' in raw) {
        return { status, body: raw as ErrorBody };
      }
      const message =
        typeof raw === 'object' && raw && 'message' in raw ? (raw as any).message : raw;
      const code =
        status === HttpStatus.NOT_FOUND
          ? ErrorCode.NOT_FOUND
          : status === HttpStatus.BAD_REQUEST
            ? ErrorCode.VALIDATION_FAILED
            : status === HttpStatus.FORBIDDEN
              ? ErrorCode.FORBIDDEN
              : status === HttpStatus.UNAUTHORIZED
                ? ErrorCode.AUTH_REQUIRED
                : ErrorCode.INTERNAL;
      return {
        status,
        body: {
          code,
          message: ERROR_MESSAGES[code],
          details: message,
        },
      };
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ErrorCode.INTERNAL, message: ERROR_MESSAGES.INTERNAL },
    };
  }
}
