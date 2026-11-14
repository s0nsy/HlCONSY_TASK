import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * 4.1: 코드 어디에서도 new Date() / Date.now() / dayjs() 를 직접 호출하지 않는다.
 * ClockService 만 예외. (oxlint 에 no-restricted-syntax 가 없어 테스트로 강제한다)
 */
const SRC = join(import.meta.dirname, '..', 'src');
const ALLOWED = new Set(['common/clock/clock.service.ts']);
const PATTERNS = [/new Date\(\s*\)/, /Date\.now\(/, /\bdayjs\(\s*\)/];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('현재 시각은 ClockService 로만', () => {
  it('src 에 직접 호출이 없다', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (ALLOWED.has(rel) || rel.endsWith('.spec.ts')) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          if (PATTERNS.some((re) => re.test(line))) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
