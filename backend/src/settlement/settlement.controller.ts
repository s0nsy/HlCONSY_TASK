import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { ClockService } from '../common/clock/clock.service.js';
import { Audit, type AuthUser, CurrentUser } from '../common/decorators.js';
import { dateOf, monthOf } from '../common/time.js';
import { SettlementService } from './settlement.service.js';

const MonthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

@Controller('settlement')
export class SettlementController {
  constructor(
    private readonly settlement: SettlementService,
    private readonly clock: ClockService,
  ) {}

  @Get()
  @Audit('STL_MONTH')
  month(@CurrentUser() user: AuthUser, @Query({ schema: MonthQuery }) q: z.infer<typeof MonthQuery>) {
    return this.settlement.month(user, q.month ?? monthOf(dateOf(this.clock.now())));
  }
}
