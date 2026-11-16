import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';

/** main.ts 와 테스트가 같은 설정을 쓰도록 분리 */
export function configureApp(app: NestExpressApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.set('trust proxy', config.trustProxy);
  warnUnsafeConfig(config);
  return config;
}

function warnUnsafeConfig(config: AppConfig): void {
  const logger = new Logger('Config');
  if (config.trustProxy === true) {
    logger.warn(
      'TRUST_PROXY=true 는 X-Forwarded-For 맨 왼쪽 값(클라이언트가 조작 가능)을 IP 로 쓴다. ' +
        'IP 제한이 우회되므로 프록시 단계 수(예: 1)나 프록시 주소 범위를 지정할 것.',
    );
  }
  if (process.env.NODE_ENV === 'production' && (config.enableTimeTravel || config.enableIpOverride)) {
    logger.warn(
      `운영 모드에서 디버그 기능이 켜져 있다 (ENABLE_TIME_TRAVEL=${config.enableTimeTravel}, ` +
        `ENABLE_IP_OVERRIDE=${config.enableIpOverride}). 데모 배포가 아니면 끌 것.`,
    );
  }
}
