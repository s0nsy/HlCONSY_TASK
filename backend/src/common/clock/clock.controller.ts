import { Controller, Get } from '@nestjs/common';
import { Audit, ClientIp, Public } from '../decorators.js';
import { dateOf } from '../time.js';
import { ClockService } from './clock.service.js';

@Controller('clock')
export class ClockController {
  constructor(private readonly clock: ClockService) {}

  /** 모든 화면의 시계용 서버 시각. 클라이언트는 이 값 위에서 tick 한다. */
  @Public()
  @Get()
  @Audit('CLOCK_GET')
  get(@ClientIp() ip: string) {
    const now = this.clock.now();
    const state = this.clock.state();
    return {
      now: now.toISOString(),
      epochMs: now.valueOf(),
      date: dateOf(now),
      timezone: state.timezone,
      mode: state.mode,
      clientIp: ip,
    };
  }
}
