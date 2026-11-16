import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { LessThan, Repository } from 'typeorm';
import { ClockService } from '../common/clock/clock.service.js';
import type { AuthUser } from '../common/decorators.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { User } from '../users/user.entity.js';
import { RevokedToken } from './revoked-token.entity.js';

export const AUTH_COOKIE = 'hc_token';

/** 없는 아이디용 가짜 해시. 시드 비밀번호와 같은 cost(10)여야 걸리는 시간이 같다 */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

interface TokenPayload {
  sub: number;
  jti?: string;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly clock: ClockService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RevokedToken) private readonly revoked: Repository<RevokedToken>,
  ) {}

  async login(loginId: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await this.users.findOneBy({ loginId });
    // 아이디가 없어도 bcrypt 비교를 한 번 돌려 응답 시간으로 아이디 존재 여부를 알 수 없게 한다
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }
    // jti: 로그아웃할 때 이 토큰 하나만 차단 목록에 넣기 위한 식별자
    const token = await this.jwt.signAsync({ sub: user.id }, { jwtid: randomUUID() });
    return { token, user: toAuthUser(user) };
  }

  /**
   * 이 토큰을 차단 목록에 넣는다. 쿠키만 지우면 탈취된 토큰은 만료(12h)까지 계속 쓸 수 있기 때문.
   * 같은 계정의 다른 세션은 건드리지 않는다 (데모처럼 여러 사람이 한 계정을 쓰는 경우).
   */
  async logout(req: Request): Promise<void> {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) return;
    const payload = await this.jwt.verifyAsync<TokenPayload>(token).catch(() => null);
    if (!payload?.jti || !payload.exp) return;
    await this.revoked.upsert({ jti: payload.jti, expiresAt: payload.exp }, ['jti']);
    // JWT 만료는 실제 시각 기준이라 정리도 실제 시각으로 (시간 조작과 무관)
    await this.revoked.delete({ expiresAt: LessThan(Math.floor(this.clock.realNowMs() / 1000)) });
  }

  /**
   * 쿠키의 토큰을 검증해 사용자를 돌려준다(없거나 무효면 null). 요청 객체에 캐시.
   * IpGuard 가 로그인 여부를 알아야 해서 AuthGuard 보다 먼저 호출될 수 있다.
   */
  async userFromRequest(req: Request): Promise<AuthUser | null> {
    const r = req as any;
    if (r.__authResolved) return r.__authUser ?? null;
    r.__authResolved = true;
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token);
      // jti 가 없는 예전 형식 토큰과 로그아웃한 토큰은 거부
      if (!payload.jti || (await this.revoked.existsBy({ jti: payload.jti }))) {
        r.__authUser = null;
      } else {
        const user = await this.users.findOneBy({ id: payload.sub });
        r.__authUser = user ? toAuthUser(user) : null;
      }
    } catch {
      r.__authUser = null;
    }
    return r.__authUser;
  }
}

export function toAuthUser(u: User): AuthUser {
  return { id: u.id, loginId: u.loginId, name: u.name, role: u.role, joinDate: u.joinDate };
}
