import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Role } from '../users/user.entity.js';

export const IS_PUBLIC = 'isPublic';
/** 로그인 없이 호출 가능 (IP 검사는 여전히 적용) */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const AUDIT_ACTION = 'auditAction';
export interface AuditMeta {
  action: string;
  /** 실패 시 action 이름 (예: LOGIN_FAIL) */
  failAction?: string;
}
export const Audit = (action: string, failAction?: string) =>
  SetMetadata(AUDIT_ACTION, { action, failAction } satisfies AuditMeta);

export interface AuthUser {
  id: number;
  loginId: string;
  name: string;
  role: Role;
  joinDate: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);

export const ClientIp = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest().__clientIp,
);
