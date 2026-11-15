import { join } from 'node:path';

export interface AppConfig {
  port: number;
  /** SQLite 파일 경로. 테스트는 ':memory:' */
  databasePath: string;
  jwtSecret: string;
  /** GET/PUT /api/dev/clock 라우트 등록 여부 */
  enableTimeTravel: boolean;
  /** X-Debug-Client-IP 헤더로 클라이언트 IP 위장 허용 */
  enableIpOverride: boolean;
  /** true: APPROVED 만 효력. false: 제출 즉시 APPROVED */
  requireApproval: boolean;
  /** express 'trust proxy' 값. false 면 소켓 주소만 사용 */
  trustProxy: boolean | number | string;
  /** 부팅 시 allowed_ip 테이블에 넣을 연구실 IP */
  labIps: string[];
  /** 쿠키 Secure 플래그 (HTTPS 운영 시 true) */
  cookieSecure: boolean;
  /** 빌드된 프론트엔드(frontend/dist) 경로. 있으면 API 와 같은 서버에서 화면도 서빙한다 (배포용) */
  staticDir: string | null;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function trustProxy(v: string | undefined): boolean | number | string {
  if (v === undefined || v === '' || v === 'false') return false;
  if (v === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v; // 'loopback', '10.0.0.0/8' 같은 express 문법 그대로
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const env = process.env;
  return {
    port: Number(env.PORT ?? 3000),
    databasePath:
      env.DATABASE_PATH ??
      join(import.meta.dirname, '..', '..', 'data', 'hiconsy.sqlite'),
    jwtSecret: env.JWT_SECRET ?? 'dev-only-secret-change-me',
    enableTimeTravel: bool(env.ENABLE_TIME_TRAVEL, false),
    enableIpOverride: bool(env.ENABLE_IP_OVERRIDE, false),
    requireApproval: bool(env.REQUIRE_APPROVAL, true),
    trustProxy: trustProxy(env.TRUST_PROXY),
    labIps: (env.LAB_IPS ?? '127.0.0.1')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cookieSecure: bool(env.COOKIE_SECURE, false),
    staticDir: env.STATIC_DIR || null,
    ...overrides,
  };
}
