/**
 * 보안·설정 관련 회귀 테스트: 로그인 시도 제한, 날짜 검증, 공휴일 변경 제한(D-23), TRUST_PROXY 해석.
 */
import request from 'supertest';
import { parseTrustProxy } from '../src/config/app-config.js';
import { type TestCtx, createTestApp } from './helpers.js';

let t: TestCtx;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(async () => {
  await t.close();
});

describe('TRUST_PROXY 해석', () => {
  it('대소문자·공백을 무시하고, 숫자는 프록시 단계 수로 읽는다', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('False')).toBe(false);
    expect(parseTrustProxy(' OFF ')).toBe(false);
    expect(parseTrustProxy('TRUE')).toBe(true);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback')).toBe('loopback');
  });
});

describe('로그인 시도 제한', () => {
  it('같은 IP·아이디로 1분에 10회를 넘기면 429 AUTH_TOO_MANY_ATTEMPTS', async () => {
    const anon = t.anon();
    for (let i = 0; i < 10; i++) {
      const res = await anon.post('/api/auth/login', { loginId: 'yeon', password: 'wrong' });
      expect(res.status).toBe(401);
    }
    const blocked = await anon.post('/api/auth/login', { loginId: 'yeon', password: '1234' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('AUTH_TOO_MANY_ATTEMPTS');

    // 같은 연구실 IP 의 다른 팀원은 영향 없음
    const other = await t.anon().post('/api/auth/login', { loginId: 'lim', password: '1234' });
    expect(other.status).toBe(200);
  });

  it('없는 아이디도 같은 오류 코드', async () => {
    const res = await t.anon().post('/api/auth/login', { loginId: 'nobody', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

describe('공휴일 날짜 검증', () => {
  it('달력에 없는 날짜(2026-02-30)는 400', async () => {
    const lead = await t.as('kim');
    const res = await lead.post('/api/holidays', { date: '2026-02-30', name: '없는 날' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});

describe('D-23 공휴일 변경 시 진행 중·승인 신청이 있으면 거부', () => {
  const del = (date: string, ip = '127.0.0.1') =>
    request(t.app.getHttpServer()).delete(`/api/holidays/${date}`).set('X-Debug-Client-IP', ip);

  it('승인된 연차가 있는 평일을 공휴일로 추가 → 409, 반려 후에는 추가된다', async () => {
    t.at('2026-11-16', '10:00');
    const yeon = await t.as('yeon');
    const req = await yeon.post('/api/requests', { type: 'ANNUAL', targetDate: '2026-11-20', reason: '개인 사유' });
    expect(req.status, JSON.stringify(req.body)).toBe(200);

    const lead = await t.as('kim');
    expect((await lead.post(`/api/requests/${req.body.id}/approve`)).status).toBe(200);

    const add = await lead.post('/api/holidays', { date: '2026-11-20', name: '임시공휴일' });
    expect(add.status).toBe(409);
    expect(add.body.code).toBe('HOLIDAY_HAS_REQUESTS');

    const cancel = await yeon.post(`/api/requests/${req.body.id}/cancel`);
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
    expect((await lead.post('/api/holidays', { date: '2026-11-20', name: '임시공휴일' })).status).toBe(201);
  });

  it('공휴일 근무 신청이 있는 평일 공휴일 삭제 → 409', async () => {
    t.at('2026-11-16', '10:00');
    const lead = await t.as('kim');
    expect((await lead.post('/api/holidays', { date: '2026-11-19', name: '임시공휴일' })).status).toBe(201);

    const lim = await t.as('lim');
    const hw = await lim.post('/api/requests', {
      type: 'HOLIDAY_WORK',
      targetDate: '2026-11-19',
      reason: '실험',
      ip: '127.0.0.1',
      startTime: '10:00',
      endTime: '15:00',
    });
    expect(hw.status, JSON.stringify(hw.body)).toBe(200);

    // 리드 쿠키로 DELETE (Session 헬퍼에 delete 가 없어 직접 보낸다)
    const login = await request(t.app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Debug-Client-IP', '127.0.0.1')
      .send({ loginId: 'kim', password: '1234' });
    const cookie = login.headers['set-cookie'];
    const res = await del('2026-11-19').set('Cookie', cookie);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HOLIDAY_HAS_REQUESTS');
  });
});
