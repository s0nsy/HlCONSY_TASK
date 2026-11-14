import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';

/** main.ts 와 테스트가 같은 설정을 쓰도록 분리 */
export function configureApp(app: NestExpressApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.set('trust proxy', config.trustProxy);
  return config;
}
