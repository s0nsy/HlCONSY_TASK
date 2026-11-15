/**
 * 디버그 패널의 「시나리오 원클릭 재현」(POST /api/dev/scenarios/:id).
 * 모든 시나리오의 준비 단계가 실제 규칙을 통과하는지, 준비 후 "행동"을 하면 9장의 기대 결과가 나오는지 확인한다.
 */
import { SCENARIOS } from '../src/dev/scenarios.js';
import { type TestCtx, createTestApp } from './helpers.js';

let t: TestCtx;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(async () => {
  await t.close();
});

async function run(id: string) {
  const res = await t.anon().post(`/api/dev/scenarios/${id}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

describe('시나리오 원클릭 재현', () => {
  it('목록에 9장 시나리오 21개가 있고 준비 단계는 노출하지 않는다', async () => {
    const res = await t.anon().get('/api/dev/scenarios');
    expect(res.body.items.map((s: { id: string }) => s.id)).toEqual(
      Array.from({ length: 21 }, (_, i) => `T-${String(i + 1).padStart(2, '0')}`),
    );
    expect(res.body.items[0].setup).toBeUndefined();
  });

  it.each(SCENARIOS.map((s) => s.id))('%s 준비 단계가 규칙을 통과하고 시각이 맞춰진다', async (id) => {
    const s = SCENARIOS.find((x) => x.id === id)!;
    const body = await run(id);
    expect(body.clock.mode).toBe('fixed');
    expect(body.login.loginId).toBe(s.loginAs);
    expect(t.clock.now().format('YYYY-MM-DD HH:mm:ss')).toBe(s.clock);
  });

  it('다시 실행하면 이전 데이터가 지워진다 (독립 재현)', async () => {
    await run('T-15');
    const yeon = await t.as('yeon', '10.0.0.5');
    expect((await yeon.post('/api/attendance/check-in')).status).toBe(200);
    await run('T-15');
    const again = await t.as('yeon', '10.0.0.5');
    expect((await again.post('/api/attendance/check-in')).status).toBe(200);
  });

  it('T-10 준비 후 출근 → 미기록 입력 요구', async () => {
    await run('T-10');
    const res = await (await t.as('kim')).post('/api/attendance/check-in');
    expect(res.body.code).toBe('ATT_PENDING_CHECKOUT_REQUIRED');
    expect(res.body.details.pending[0].workDate).toBe('2026-11-16');
  });

  it('T-13 준비 후 3번째 재택 → REQ_REMOTE_LIMIT', async () => {
    await run('T-13');
    const res = await (await t.as('yeon')).post('/api/requests', {
      type: 'REMOTE',
      targetDate: '2026-12-09',
      reason: 'x',
      ip: '1.2.3.4',
      startTime: '09:00',
      endTime: '18:00',
    });
    expect(res.body.code).toBe('REQ_REMOTE_LIMIT');
  });

  it('T-14 준비 후 09:59 에 10.0.0.5 접속 → 차단', async () => {
    await run('T-14');
    const res = await t.anon('10.0.0.5').post('/api/auth/login', { loginId: 'yeon', password: '1234' });
    expect(res.body.code).toBe('IP_DENIED');
  });

  it('T-16 준비 후 OFF 신청 → REQ_OFF_EXPIRED', async () => {
    await run('T-16');
    const res = await (await t.as('yeon')).post('/api/requests', {
      type: 'OFF',
      targetDate: '2026-12-23',
      reason: 'x',
      offHalf: 'AM',
    });
    expect(res.body.code).toBe('REQ_OFF_EXPIRED');
  });

  it('없는 시나리오는 404, reset 은 실시간으로 되돌린다', async () => {
    expect((await t.anon().post('/api/dev/scenarios/T-99')).status).toBe(404);
    await run('T-05');
    const res = await t.anon().post('/api/dev/reset');
    expect(res.body.mode).toBe('real');
  });
});
