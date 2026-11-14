import { Controller, Get } from '@nestjs/common';
import { Audit, type AuthUser, ClientIp, CurrentUser, Roles } from '../common/decorators.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('me')
  @Audit('DSH_ME')
  me(@CurrentUser() user: AuthUser, @ClientIp() ip: string) {
    return this.dashboard.me(user, ip);
  }

  @Get('team')
  @Roles('LEAD')
  @Audit('DSH_TEAM')
  team() {
    return this.dashboard.team();
  }

  @Get('missing')
  @Audit('DSH_MISSING')
  missing(@CurrentUser() user: AuthUser) {
    return this.dashboard.missing(user);
  }
}
