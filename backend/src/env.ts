// .env 로더. main.ts에서 가장 먼저 import된다.
// 우선순위: 실제 환경변수 > .env (사용자 로컬) > .env.development (레포에 포함된 개발 기본값)
// process.loadEnvFile 은 이미 있는 변수를 덮어쓰지 않는다.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const files = ['.env'];
if (process.env.NODE_ENV !== 'production') files.push('.env.development');

for (const f of files) {
  const p = join(root, f);
  if (existsSync(p)) process.loadEnvFile(p);
}
