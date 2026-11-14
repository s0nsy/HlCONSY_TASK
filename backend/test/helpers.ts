import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ClockService } from '../src/common/clock/clock.service.js';
import { kstEpoch } from '../src/common/time.js';
import type { AppConfig } from '../src/config/app-config.js';
import { configureApp } from '../src/configure-app.js';
import { CoreModule } from '../src/core.module.js';

export interface TestCtx {
  app: NestExpressApplication;
  clock: ClockService;
  db: DataSource;
  /** 서버 시각을 서울 기준 날짜·시각으로 고정 */
  at: (date: string, time: string) => void;
  /** 로그인한 사용자 세션 (IP 는 X-Debug-Client-IP 로 위장) */
  as: (loginId: string, ip?: string) => Promise<Session>;
  anon: (ip?: string) => Session;
  close: () => Promise<void>;
}

export interface Session {
  ip: string;
  get: (url: string) => request.Test;
  post: (url: string, body?: object) => request.Test;
  put: (url: string, body?: object) => request.Test;
  setIp: (ip: string) => void;
}

export async function createTestApp(overrides: Partial<AppConfig> = {}): Promise<TestCtx> {
  const mod = await Test.createTestingModule({
    imports: [
      CoreModule.forRoot({
        databasePath: ':memory:',
        enableTimeTravel: true,
        enableIpOverride: true,
        requireApproval: true,
        trustProxy: false,
        labIps: ['127.0.0.1'],
        jwtSecret: 'test',
        ...overrides,
      }),
    ],
  }).compile();
  const app = mod.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
  const clock = app.get(ClockService);
  const server = app.getHttpServer();

  const session = (ip: string): Session => {
    const agent = request.agent(server);
    const s: Session = {
      ip,
      setIp: (v) => (s.ip = v),
      get: (url) => agent.get(url).set('X-Debug-Client-IP', s.ip),
      post: (url, body) => agent.post(url).set('X-Debug-Client-IP', s.ip).send(body ?? {}),
      put: (url, body) => agent.put(url).set('X-Debug-Client-IP', s.ip).send(body ?? {}),
    };
    return s;
  };

  return {
    app,
    clock,
    db: app.get(DataSource),
    at: (date, time) => {
      clock.set('fixed', kstEpoch(date, time));
    },
    anon: (ip = '127.0.0.1') => session(ip),
    as: async (loginId, ip = '127.0.0.1') => {
      const s = session(ip);
      const res = await s.post('/api/auth/login', { loginId, password: '1234' });
      if (res.status !== 200) throw new Error(`login ${loginId} failed: ${res.status} ${JSON.stringify(res.body)}`);
      return s;
    },
    close: () => app.close(),
  };
}
