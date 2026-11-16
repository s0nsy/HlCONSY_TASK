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

/**
 * TRUST_PROXY 해석. 대소문자·앞뒤 공백 무시 (bool() 과 같은 규칙).
 * - false/no/off/빈 값 → false (소켓 주소만 사용)
 * - 숫자 → 믿을 프록시 단계 수 (Render 처럼 프록시 1단계 뒤면 1)
 * - true/yes/on → true. X-Forwarded-For 맨 왼쪽(클라이언트가 마음대로 넣는 값)을 믿게 되어
 *   IP 제한을 우회할 수 있다. configureApp 이 경고를 남긴다.
 * - 그 밖의 값은 'loopback', '10.0.0.0/8' 같은 express 문법으로 그대로 넘긴다.
 */
export function parseTrustProxy(v: string | undefined): boolean | number | string {
  const s = (v ?? '').trim();
  const lower = s.toLowerCase();
  if (s === '' || ['false', 'no', 'off'].includes(lower)) return false;
  if (['true', 'yes', 'on'].includes(lower)) return true;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

/** 레포에 공개된 개발용 서명 키 (.env.development). 운영에서 이 값으로는 시작하지 않는다 */
export const DEV_JWT_SECRET = 'dev-only-secret-change-me';

/**
 * 운영(NODE_ENV=production, Docker 이미지가 설정)에서 JWT_SECRET 이 없거나 공개된 개발용 값·32자 미만이면
 * 시작을 막는다. 키가 알려지면 누구나 리드 토큰을 만들 수 있기 때문. 로컬 개발(npm run dev)은 영향 없음.
 */
export function assertJwtSecret(secret: string, nodeEnv = process.env.NODE_ENV): void {
  if (nodeEnv !== 'production') return;
  if (secret === DEV_JWT_SECRET || secret.length < 32) {
    throw new Error(
      'JWT_SECRET 이 없거나 안전하지 않습니다. 운영에서는 32자 이상의 무작위 값을 지정하세요 ' +
        '(예: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))").',
    );
  }
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = readConfig(overrides);
  assertJwtSecret(config.jwtSecret);
  return config;
}

function readConfig(overrides: Partial<AppConfig>): AppConfig {
  const env = process.env;
  return {
    port: Number(env.PORT ?? 3000),
    databasePath:
      env.DATABASE_PATH ??
      join(import.meta.dirname, '..', '..', 'data', 'hiconsy.sqlite'),
    jwtSecret: env.JWT_SECRET || DEV_JWT_SECRET,
    enableTimeTravel: bool(env.ENABLE_TIME_TRAVEL, false),
    enableIpOverride: bool(env.ENABLE_IP_OVERRIDE, false),
    requireApproval: bool(env.REQUIRE_APPROVAL, true),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    labIps: (env.LAB_IPS ?? '127.0.0.1')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cookieSecure: bool(env.COOKIE_SECURE, false),
    staticDir: env.STATIC_DIR || null,
    ...overrides,
  };
}
