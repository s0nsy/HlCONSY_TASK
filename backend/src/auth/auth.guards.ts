import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../common/decorators.js';
import { IS_PUBLIC, ROLES } from '../common/decorators.js';
import { AppException, ErrorCode } from '../common/errors.js';
import type { Role } from '../users/user.entity.js';
import { AuthService } from './auth.service.js';

/** 전역: @Public() 이 아니면 로그인 필요 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = await this.auth.userFromRequest(req);
    if (user) req.user = user;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (!user) throw new AppException(ErrorCode.AUTH_REQUIRED);
    return true;
  }
}

/** 전역: @Roles('LEAD') 가 붙은 핸들러는 역할 검사 (FE 만 막는 것 금지) */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }
    return true;
  }
}

/**
 * 로그인 시도 제한 (POST /api/auth/login 에만 @UseGuards 로 붙인다).
 * 같은 IP + 같은 아이디로 1분에 10회를 넘기면 5분간 429 AUTH_TOO_MANY_ATTEMPTS (AuthModule 의 ThrottlerModule 설정).
 * 연구실은 팀원이 한 IP 를 같이 쓰므로 IP 만으로 세지 않는다.
 * IP 는 전역 IpGuard 가 먼저 계산해 둔 값(clientIp)을 쓴다. 저장소는 메모리라 서버를 여러 대 띄우면 Redis 등으로 바꾼다.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const ip: string = req.__clientIp ?? req.ip ?? 'unknown';
    const loginId = typeof req.body?.loginId === 'string' ? req.body.loginId.trim().toLowerCase() : '';
    return `${ip}|${loginId}`;
  }

  protected override async throwThrottlingException(): Promise<void> {
    throw new AppException(ErrorCode.AUTH_TOO_MANY_ATTEMPTS);
  }
}
