import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { CoreModule } from './core.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

/**
 * NestJS Observe(트레이스·에러·로그·지표)는 키가 있을 때만 켠다.
 * 키 없이 켜면 자리표시자로 전송하다 401 로 거부되기만 한다 (데모 배포·로컬 기본 상태).
 * 키는 https://observe.nestjs.com 가입 후 `npx @nestjs/observe link` 로 .env 에 쓰거나, 배포 환경변수로 넣는다.
 */
export const OBSERVE_ENABLED = Boolean(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET);

@Module({
  imports: [
    ...(OBSERVE_ENABLED
      ? [
          ObserveModule.forRoot({
            appKey: process.env.OBSERVE_APP_KEY!,
            appSecret: process.env.OBSERVE_APP_SECRET!,
            serviceId: 'hiconsy',
          }),
        ]
      : []),
    CoreModule.forRoot(),
  ],
})
export class AppModule {}
