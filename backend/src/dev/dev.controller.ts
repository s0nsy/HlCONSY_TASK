import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ClockService } from '../common/clock/clock.service.js';
import { Audit, Public } from '../common/decorators.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { ScenarioService } from './scenario.service.js';

const ClockSchema = z.object({
  mode: z.enum(['real', 'fixed', 'offset']),
  /** ISO 문자열. 타임존이 없으면 Asia/Seoul 로 해석 */
  at: z.string().optional(),
});

/**
 * 시간 조작 API. ENABLE_TIME_TRAVEL=true 일 때만 모듈이 등록된다.
 * IP 검사는 그대로 받는다. 로그인 없이도 쓸 수 있게 Public (차단 페이지·로그인 화면에서도 조작 가능).
 */
@Controller('dev')
export class DevController {
  constructor(
    private readonly clock: ClockService,
    private readonly scenarios: ScenarioService,
  ) {}

  @Public()
  @Get('clock')
  @Audit('DEV_CLOCK_GET')
  get() {
    return this.clock.state();
  }

  @Public()
  @Put('clock')
  @Audit('DEV_CLOCK_SET')
  set(@Body({ schema: ClockSchema }) body: z.infer<typeof ClockSchema>) {
    if (body.mode === 'real') return this.clock.set('real');
    if (!body.at) throw new AppException(ErrorCode.VALIDATION_FAILED, { at: 'required' });
    const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(body.at);
    const ms = Date.parse(hasZone ? body.at : `${body.at}+09:00`);
    if (Number.isNaN(ms)) throw new AppException(ErrorCode.VALIDATION_FAILED, { at: 'invalid' });
    return this.clock.set(body.mode, ms);
  }

  /** 9장 시나리오 목록 (디버그 패널용) */
  @Public()
  @Get('scenarios')
  @Audit('DEV_SCENARIO_LIST')
  listScenarios() {
    return { items: this.scenarios.list() };
  }

  /** 근태·신청·잔여를 비우고 시나리오의 준비 상태를 만든 뒤 서버 시각을 맞춘다 */
  @Public()
  @Post('scenarios/:id')
  @HttpCode(200)
  @Audit('DEV_SCENARIO_RUN')
  runScenario(@Param('id') id: string) {
    return this.scenarios.run(id);
  }

  /** 근태·신청·잔여 초기화 + 실시간 복귀 */
  @Public()
  @Post('reset')
  @HttpCode(200)
  @Audit('DEV_RESET')
  async reset() {
    await this.scenarios.reset();
    return this.clock.set('real');
  }
}
