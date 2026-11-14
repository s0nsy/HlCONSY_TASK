import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Audit, type AuthUser, CurrentUser, Public } from '../common/decorators.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { AUTH_COOKIE, AuthService } from './auth.service.js';

const LoginSchema = z.object({
  loginId: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** FN-SYS-02 */
  @Public()
  @Post('login')
  @HttpCode(200)
  @Audit('LOGIN', 'LOGIN_FAIL')
  async login(
    @Body({ schema: LoginSchema }) body: z.infer<typeof LoginSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.login(body.loginId, body.password);
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.cookieSecure,
      path: '/',
    });
    // 이력에 로그인한 사용자가 남도록
    (res.req as any).user = user;
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  @Audit('LOGOUT')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @Audit('AUTH_ME')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
