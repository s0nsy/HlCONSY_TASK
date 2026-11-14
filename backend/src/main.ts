import './env.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  const config = configureApp(app);
  await app.listen(config.port);
  console.log(
    `hiconcy API http://localhost:${config.port}/api  ` +
      `(timeTravel=${config.enableTimeTravel}, ipOverride=${config.enableIpOverride}, requireApproval=${config.requireApproval})`,
  );
}
await bootstrap();
