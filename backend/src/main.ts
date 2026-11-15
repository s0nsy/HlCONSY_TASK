import './env.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { join, resolve } from 'node:path';
import { AppModule, OBSERVE_ENABLED, ObserveInstrument } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...(OBSERVE_ENABLED ? { instrument: ObserveInstrument } : {}),
  });
  const config = configureApp(app);

  // 배포: 빌드된 화면을 같은 서버에서 서빙. /api 외의 GET 은 SPA 라우팅이라 index.html 로 돌려준다
  if (config.staticDir) {
    const dir = resolve(config.staticDir);
    app.useStaticAssets(dir, { index: false, maxAge: '1h' });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(dir, 'index.html'));
    });
  }

  await app.listen(config.port);
  console.log(
    `hiconsy API http://localhost:${config.port}/api  ` +
      `(timeTravel=${config.enableTimeTravel}, ipOverride=${config.enableIpOverride}, requireApproval=${config.requireApproval}` +
      `${config.staticDir ? `, static=${config.staticDir}` : ''}, observe=${OBSERVE_ENABLED})`,
  );
}
await bootstrap();
