import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
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
