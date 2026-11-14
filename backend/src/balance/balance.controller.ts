import { Controller, Get, Param } from '@nestjs/common';
import { z } from 'zod';
import { Audit, type AuthUser, CurrentUser, Roles } from '../common/decorators.js';
import { RequestsService } from '../requests/requests.service.js';
import { BalanceService } from './balance.service.js';

const Id = z.coerce.number().int().positive();

@Controller('balance')
export class BalanceController {
  constructor(
    private readonly balance: BalanceService,
    private readonly requests: RequestsService,
  ) {}

  @Get('me')
  @Audit('BAL_ME')
  async me(@CurrentUser() user: AuthUser) {
    await this.requests.expireStale();
    return { summary: await this.balance.summary(user.id), history: await this.balance.history(user.id) };
  }

  /** 리드: 팀원별 잔여 */
  @Get('users/:id')
  @Roles('LEAD')
  @Audit('BAL_USER')
  async user(@Param('id', { schema: Id }) id: number) {
    await this.requests.expireStale();
    return { summary: await this.balance.summary(id), history: await this.balance.history(id) };
  }
}
