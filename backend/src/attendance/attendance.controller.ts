import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ClockService } from '../common/clock/clock.service.js';
import { Audit, type AuthUser, ClientIp, CurrentUser } from '../common/decorators.js';
import { dateOf, monthOf } from '../common/time.js';
import { AttendanceService } from './attendance.service.js';

const CheckInSchema = z
  .object({
    manualCheckouts: z
      .array(
        z.object({
          attendanceId: z.number().int().positive(),
          checkOutTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
        }),
      )
      .optional(),
  })
  .optional();

const MonthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly clock: ClockService,
  ) {}

  @Post('check-in')
  @HttpCode(200)
  @Audit('ATT_CHECK_IN')
  checkIn(
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
    @Body({ schema: CheckInSchema }) body: z.infer<typeof CheckInSchema>,
  ) {
    return this.attendance.checkIn(user, ip, body?.manualCheckouts ?? []);
  }

  @Post('check-out')
  @HttpCode(200)
  @Audit('ATT_CHECK_OUT')
  checkOut(@CurrentUser() user: AuthUser, @ClientIp() ip: string) {
    return this.attendance.checkOut(user, ip);
  }

  @Get('pending-checkouts')
  @Audit('ATT_PENDING_LIST')
  async pending(@CurrentUser() user: AuthUser) {
    const rows = await this.attendance.pendingCheckouts(user.id);
    return { items: await Promise.all(rows.map((r) => this.attendance.pendingView(r))) };
  }

  @Get('me')
  @Audit('ATT_MY_MONTH')
  async me(@CurrentUser() user: AuthUser, @Query({ schema: MonthQuery }) q: z.infer<typeof MonthQuery>) {
    const month = q.month ?? monthOf(dateOf(this.clock.now()));
    return { month, items: await this.attendance.month(user.id, month) };
  }
}
