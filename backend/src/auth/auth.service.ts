import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import type { AuthUser } from '../common/decorators.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { User } from '../users/user.entity.js';

export const AUTH_COOKIE = 'hc_token';

/** 없는 아이디용 가짜 해시. 시드 비밀번호와 같은 cost(10)여야 걸리는 시간이 같다 */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async login(loginId: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await this.users.findOneBy({ loginId });
    // 아이디가 없어도 bcrypt 비교를 한 번 돌려 응답 시간으로 아이디 존재 여부를 알 수 없게 한다
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }
    const token = await this.jwt.signAsync({ sub: user.id });
    return { token, user: toAuthUser(user) };
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
      const payload = await this.jwt.verifyAsync<{ sub: number }>(token);
      const user = await this.users.findOneBy({ id: payload.sub });
      r.__authUser = user ? toAuthUser(user) : null;
    } catch {
      r.__authUser = null;
    }
    return r.__authUser;
  }
}

export function toAuthUser(u: User): AuthUser {
  return { id: u.id, loginId: u.loginId, name: u.name, role: u.role, joinDate: u.joinDate };
}
