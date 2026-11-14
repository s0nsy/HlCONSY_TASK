/**
 * request.md 9장 인수 테스트 시나리오 T-01 ~ T-21.
 * 날짜: 2026-11-16(월) … 2026-11-20(금), 2026-11-21(토), 2026-11-23(월)
 */
import { AuditLog } from '../src/common/audit/audit-log.entity.js';
import { type TestCtx, createTestApp } from './helpers.js';

let t: TestCtx;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(async () => {
  await t.close();
});

/** 신청 → (리드) 승인 */
async function requestAndApprove(loginId: string, ip: string, body: object) {
  const me = await t.as(loginId, ip);
  const res = await me.post('/api/requests', body);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const lead = await t.as('kim');
  const ap = await lead.post(`/api/requests/${res.body.id}/approve`);
  expect(ap.status, JSON.stringify(ap.body)).toBe(200);
  return res.body.id as number;
}

describe('출근 (FR-ATT-01)', () => {
  it('T-01 평일 06:59:59 출근 → ATT_TOO_EARLY', async () => {
    t.at('2026-11-16', '06:59:59');
    const kim = await t.as('kim');
    const res = await kim.post('/api/attendance/check-in');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ATT_TOO_EARLY');
    // 버튼 상태도 서버가 내려준다
    const me = await kim.get('/api/dashboard/me');
    expect(me.body.canCheckIn).toBe(false);
    expect(me.body.checkInCode).toBe('ATT_TOO_EARLY');
  });

  it('T-02 평일 10:00:00 출근 → 정상', async () => {
    t.at('2026-11-16', '10:00:00');
    const res = await (await t.as('kim')).post('/api/attendance/check-in');
    expect(res.status).toBe(200);
    expect(res.body.attendance.isLate).toBe(false);
  });

  it('T-03 평일 10:00:01 출근 → 지각', async () => {
    t.at('2026-11-16', '10:00:01');
    const kim = await t.as('kim');
    const res = await kim.post('/api/attendance/check-in');
    expect(res.status).toBe(200);
    expect(res.body.attendance.isLate).toBe(true);
    expect(res.body.attendance.badges).toContain('LATE');
    // A-3 중복 출근 거부
    const again = await kim.post('/api/attendance/check-in');
    expect(again.body.code).toBe('ATT_ALREADY_CHECKED_IN');
  });
});

describe('퇴근 & 근무시간 (FR-ATT-02)', () => {
  async function work(inTime: string, outTime: string) {
    t.at('2026-11-17', inTime);
    const kim = await t.as('kim');
    expect((await kim.post('/api/attendance/check-in')).status).toBe(200);
    t.at('2026-11-17', outTime);
    return kim.post('/api/attendance/check-out');
  }

  it('T-04 출근 09:00, 15:59 퇴근 → ATT_CHECKOUT_TOO_EARLY', async () => {
    const res = await work('09:00:00', '15:59:00');
    expect(res.body.code).toBe('ATT_CHECKOUT_TOO_EARLY');
  });
  it('T-05 09:00 → 18:00 = 480분 정상', async () => {
    const res = await work('09:00:00', '18:00:00');
    expect(res.body.attendance).toMatchObject({ workMinutes: 480, lunchMinutes: 60, isEarlyLeave: false });
  });
  it('T-06 09:00 → 17:59 = 479분 조퇴', async () => {
    const res = await work('09:00:00', '17:59:00');
    expect(res.body.attendance).toMatchObject({ workMinutes: 479, isEarlyLeave: true });
  });
  it('T-07 12:00 → 20:00 = 점심 30분 차감, 450분 조퇴', async () => {
    const res = await work('12:00:00', '20:00:00');
    expect(res.body.attendance).toMatchObject({ workMinutes: 450, lunchMinutes: 30, isEarlyLeave: true });
  });
  it('T-08 13:00 → 21:00 = 점심 0분, 480분 정상', async () => {
    const res = await work('13:00:00', '21:00:00');
    expect(res.body.attendance).toMatchObject({ workMinutes: 480, lunchMinutes: 0, isEarlyLeave: false });
  });
});

describe('주말 근무 · OFF (FR-ATT-04, FR-BAL-01)', () => {
  const HW = { type: 'HOLIDAY_WORK', targetDate: '2026-11-21', reason: '실험', ip: '10.0.0.5', startTime: '10:00', endTime: '15:00' };

  async function weekendWorkWithOff() {
    t.at('2026-11-19', '09:00:00');
    await requestAndApprove('yeon', '127.0.0.1', HW);
    t.at('2026-11-21', '10:00:00');
    const yeon = await t.as('yeon', '10.0.0.5');
    expect((await yeon.post('/api/attendance/check-in')).status).toBe(200);
    t.at('2026-11-21', '14:00:00');
    const out = await yeon.post('/api/attendance/check-out');
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    return out;
  }

  it('T-14 토 09:59, 신청 IP 로 접속 → IP Guard 차단', async () => {
    t.at('2026-11-19', '09:00:00');
    await requestAndApprove('yeon', '127.0.0.1', HW);
    t.at('2026-11-21', '09:59:00');
    const res = await t.anon('10.0.0.5').get('/api/clock');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IP_DENIED');
    // 시간대 안이면 허용
    t.at('2026-11-21', '10:00:00');
    expect((await t.anon('10.0.0.5').get('/api/clock')).status).toBe(200);
  });

  it('W-1 신청 없는 주말엔 연구실 IP 여도 출근 불가', async () => {
    t.at('2026-11-21', '10:00:00');
    const res = await (await t.as('lim')).post('/api/attendance/check-in');
    expect(res.body.code).toBe('ATT_NO_HOLIDAY_WORK_REQUEST');
  });

  it('T-15 토 10:00 출근 → 14:00 퇴근: 기록, 반일 OFF 1개 지급 (만료 = 근무일+30일)', async () => {
    const out = await weekendWorkWithOff();
    expect(out.body.attendance).toMatchObject({ dayType: 'HOLIDAY_WORK', workMinutes: 180, isLate: false, isEarlyLeave: false });
    const bal = await (await t.as('yeon', '10.0.0.5')).get('/api/balance/me');
    expect(bal.body.summary.off.available).toBe(1);
    expect(bal.body.summary.off.grants[0]).toMatchObject({
      grantDate: '2026-11-21',
      expireDate: '2026-12-21',
      expiresAt: '2026-12-21T14:59:59.000Z',
    });
  });

  it('T-09 반일 OFF 사용일 13:00 출근 → 17:00 퇴근 = 240분 정상(지각 판정 없음)', async () => {
    await weekendWorkWithOff();
    t.at('2026-11-23', '09:00:00');
    await requestAndApprove('yeon', '127.0.0.1', { type: 'OFF', targetDate: '2026-11-24', reason: '병원', offHalf: 'AM' });
    t.at('2026-11-24', '13:00:00');
    const yeon = await t.as('yeon');
    const inRes = await yeon.post('/api/attendance/check-in');
    expect(inRes.body.attendance).toMatchObject({ isLate: false });
    expect(inRes.body.attendance.badges).toContain('OFF');
    t.at('2026-11-24', '17:00:00');
    const out = await yeon.post('/api/attendance/check-out');
    expect(out.body.attendance).toMatchObject({ workMinutes: 240, isEarlyLeave: false });
    const bal = await yeon.get('/api/balance/me');
    expect(bal.body.summary.off.available).toBe(0);
  });

  it('T-16 OFF 지급 후 31일째 OFF 신청 → REQ_OFF_EXPIRED, 잔여 0', async () => {
    await weekendWorkWithOff();
    t.at('2026-12-22', '09:00:00'); // 11/21 + 31일
    const yeon = await t.as('yeon');
    const res = await yeon.post('/api/requests', { type: 'OFF', targetDate: '2026-12-23', reason: '휴식', offHalf: 'PM' });
    expect(res.body.code).toBe('REQ_OFF_EXPIRED');
    const bal = await yeon.get('/api/balance/me');
    expect(bal.body.summary.off.available).toBe(0);
    expect(bal.body.summary.off.grants[0].expired).toBe(true);
  });

  it('M-5 주말 근무 퇴근을 직접 입력해도 OFF 지급, 지급일 = 근무일', async () => {
    t.at('2026-11-19', '09:00:00');
    await requestAndApprove('yeon', '127.0.0.1', HW);
    t.at('2026-11-21', '10:00:00');
    expect((await (await t.as('yeon', '10.0.0.5')).post('/api/attendance/check-in')).status).toBe(200);
    t.at('2026-11-23', '09:00:00');
    const yeon = await t.as('yeon');
    const pend = await yeon.get('/api/attendance/pending-checkouts');
    const id = pend.body.items[0].id;
    // 신청 시간대 밖은 거부
    const bad = await yeon.post('/api/attendance/check-in', { manualCheckouts: [{ attendanceId: id, checkOutTime: '16:00' }] });
    expect(bad.body.code).toBe('ATT_MANUAL_INVALID');
    const ok = await yeon.post('/api/attendance/check-in', { manualCheckouts: [{ attendanceId: id, checkOutTime: '15:00' }] });
    expect(ok.status).toBe(200);
    const bal = await yeon.get('/api/balance/me');
    expect(bal.body.summary.off.grants[0].grantDate).toBe('2026-11-21');
  });
});

describe('퇴근 미기록 (FR-ATT-03)', () => {
  it('T-10 어제 출근만 있음 → 오늘 09:00 출근: 모달용 거부 → 18:00 입력 → 직접 입력 + 오늘 출근', async () => {
    t.at('2026-11-16', '09:00:00');
    const kim = await t.as('kim');
    await kim.post('/api/attendance/check-in');
    t.at('2026-11-17', '09:00:00');
    const pend = await kim.get('/api/attendance/pending-checkouts');
    expect(pend.body.items).toHaveLength(1);
    const first = await kim.post('/api/attendance/check-in');
    expect(first.status).toBe(409);
    expect(first.body.code).toBe('ATT_PENDING_CHECKOUT_REQUIRED');

    const id = pend.body.items[0].id;
    const res = await kim.post('/api/attendance/check-in', { manualCheckouts: [{ attendanceId: id, checkOutTime: '18:00' }] });
    expect(res.status).toBe(200);
    expect(res.body.resolved[0]).toMatchObject({ workDate: '2026-11-16', checkOutSource: 'MANUAL', workMinutes: 480, isEarlyLeave: false });
    expect(res.body.resolved[0].badges).toContain('MANUAL');
    expect(res.body.attendance.workDate).toBe('2026-11-17');

    const missing = await kim.get('/api/dashboard/missing');
    expect(missing.body.manual).toHaveLength(1);
    expect(missing.body.unrecorded).toHaveLength(0);
  });

  it('M-3 직접 입력도 평일 16:00 이전은 거부 (트랜잭션: 오늘 출근도 기록되지 않음)', async () => {
    t.at('2026-11-16', '09:00:00');
    const kim = await t.as('kim');
    await kim.post('/api/attendance/check-in');
    t.at('2026-11-17', '09:00:00');
    const id = (await kim.get('/api/attendance/pending-checkouts')).body.items[0].id;
    const res = await kim.post('/api/attendance/check-in', { manualCheckouts: [{ attendanceId: id, checkOutTime: '15:00' }] });
    expect(res.body.code).toBe('ATT_MANUAL_INVALID');
    const me = await kim.get('/api/dashboard/me');
    expect(me.body.attendance).toBeNull();
  });
});

describe('신청 (FR-REQ-01)', () => {
  it('T-11 금 17:00:00 월요일 연차 신청 → 허용', async () => {
    t.at('2026-11-20', '17:00:00');
    const res = await (await t.as('kim')).post('/api/requests', { type: 'ANNUAL', targetDate: '2026-11-23', reason: '개인 사유' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status).toBe('PENDING');
  });

  it('T-12 금 17:00:01 월요일 연차 신청 → REQ_DEADLINE_PASSED', async () => {
    t.at('2026-11-20', '17:00:01');
    const res = await (await t.as('kim')).post('/api/requests', { type: 'ANNUAL', targetDate: '2026-11-23', reason: '개인 사유' });
    expect(res.body.code).toBe('REQ_DEADLINE_PASSED');
  });

  it('T-13 같은 달 재택 2건 → 3번째 REQ_REMOTE_LIMIT', async () => {
    t.at('2026-11-20', '09:00:00');
    const yeon = await t.as('yeon');
    const body = (d: string) => ({ type: 'REMOTE', targetDate: d, reason: '재택', ip: '1.2.3.4', startTime: '08:00', endTime: '19:00' });
    expect((await yeon.post('/api/requests', body('2026-12-01'))).status).toBe(200);
    expect((await yeon.post('/api/requests', body('2026-12-02'))).status).toBe(200);
    const third = await yeon.post('/api/requests', body('2026-12-03'));
    expect(third.body.code).toBe('REQ_REMOTE_LIMIT');
    // 다음 달 한도는 별개 (L-5)
    expect((await yeon.post('/api/requests', body('2027-01-04'))).status).toBe(200);
  });

  it('R-6 반려하면 예약분을 돌려준다', async () => {
    t.at('2026-11-20', '09:00:00');
    const yeon = await t.as('yeon');
    const body = (d: string) => ({ type: 'REMOTE', targetDate: d, reason: '재택', ip: '1.2.3.4', startTime: '08:00', endTime: '19:00' });
    const a = await yeon.post('/api/requests', body('2026-12-01'));
    await yeon.post('/api/requests', body('2026-12-02'));
    const kim = await t.as('kim');
    expect((await kim.post(`/api/requests/${a.body.id}/reject`, { reason: '일정 겹침' })).status).toBe(200);
    expect((await yeon.post('/api/requests', body('2026-12-03'))).status).toBe(200);
  });

  it('R-5 같은 날 연차+재택 중복 거부, 재택+OFF 는 허용 검사 통과', async () => {
    t.at('2026-11-20', '09:00:00');
    const kim = await t.as('kim');
    expect((await kim.post('/api/requests', { type: 'ANNUAL', targetDate: '2026-12-01', reason: 'a' })).status).toBe(200);
    const dup = await kim.post('/api/requests', { type: 'REMOTE', targetDate: '2026-12-01', reason: 'b', ip: '1.2.3.4', startTime: '08:00', endTime: '19:00' });
    expect(dup.body.code).toBe('REQ_DUPLICATE');
  });

  it('R-7 기한 전 취소 가능, 지나면 불가', async () => {
    t.at('2026-11-20', '09:00:00');
    const kim = await t.as('kim');
    const a = await kim.post('/api/requests', { type: 'ANNUAL', targetDate: '2026-11-24', reason: 'a' });
    const b = await kim.post('/api/requests', { type: 'ANNUAL', targetDate: '2026-11-25', reason: 'b' });
    expect((await kim.post(`/api/requests/${a.body.id}/cancel`)).body.status).toBe('CANCELED');
    t.at('2026-11-24', '17:00:01');
    expect((await kim.post(`/api/requests/${b.body.id}/cancel`)).body.code).toBe('REQ_NOT_CANCELABLE');
  });

  it('R-9 사용일까지 PENDING 이면 EXPIRED 처리되고 잔여가 돌아온다', async () => {
    t.at('2026-11-20', '09:00:00');
    const kim = await t.as('kim');
    const before = (await kim.get('/api/balance/me')).body.summary.annual.remaining;
    const r = await kim.post('/api/requests', { type: 'ANNUAL', targetDate: '2026-11-23', reason: 'a' });
    expect((await kim.get('/api/balance/me')).body.summary.annual.remaining).toBe(before - 1);
    t.at('2026-11-23', '08:00:00');
    expect((await kim.post(`/api/requests/${r.body.id}/approve`)).body.code).toBe('REQ_NOT_PENDING');
    const list = await kim.get('/api/requests/me');
    expect(list.body.items[0].status).toBe('EXPIRED');
    expect((await kim.get('/api/balance/me')).body.summary.annual.remaining).toBe(before);
  });

  it('A-4 승인된 연차일에는 출근 불가', async () => {
    t.at('2026-11-20', '09:00:00');
    await requestAndApprove('kim', '127.0.0.1', { type: 'ANNUAL', targetDate: '2026-11-23', reason: 'a' });
    t.at('2026-11-23', '09:00:00');
    const res = await (await t.as('kim')).post('/api/attendance/check-in');
    expect(res.body.code).toBe('ATT_ANNUAL_LEAVE_DAY');
  });
});

describe('잔여 (FR-BAL-01)', () => {
  it('T-17 2026-02-01 00:00 연차 잔여: 김근태 1, 연차원 0, 임자율 0', async () => {
    t.at('2026-02-01', '00:00:00');
    expect((await (await t.as('kim')).get('/api/balance/me')).body.summary.annual.remaining).toBe(1);
    expect((await (await t.as('yeon')).get('/api/balance/me')).body.summary.annual.remaining).toBe(0);
    expect((await (await t.as('lim')).get('/api/balance/me')).body.summary.annual.remaining).toBe(0);
  });

  it('T-18 2026-03-12 00:00 임자율 연차 잔여 1', async () => {
    t.at('2026-03-11', '23:59:59');
    expect((await (await t.as('lim')).get('/api/balance/me')).body.summary.annual.remaining).toBe(0);
    t.at('2026-03-12', '00:00:00');
    expect((await (await t.as('lim')).get('/api/balance/me')).body.summary.annual.remaining).toBe(1);
  });

  it('L-4 잔여 없으면 연차 신청 거부 (가불 불가)', async () => {
    t.at('2026-01-20', '09:00:00');
    const res = await (await t.as('kim')).post('/api/requests', { type: 'ANNUAL', targetDate: '2026-03-03', reason: 'a' });
    expect(res.body.code).toBe('REQ_ANNUAL_INSUFFICIENT');
  });
});

describe('접속 제한 · 권한 (FR-SYS-01, FR-SYS-02)', () => {
  it('T-19 연차원 재택 IP 1.2.3.4 에서 김근태로 로그인 → 로그인 후 요청 차단', async () => {
    t.at('2026-11-20', '09:00:00');
    await requestAndApprove('yeon', '127.0.0.1', {
      type: 'REMOTE', targetDate: '2026-11-23', reason: '재택', ip: '1.2.3.4', startTime: '08:00', endTime: '19:00',
    });
    t.at('2026-11-23', '09:00:00');
    // 로그인 화면 접근은 허용 (누구의 신청이든 있으면)
    const kim = await t.as('kim', '1.2.3.4');
    const res = await kim.get('/api/auth/me');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IP_DENIED');
    // 본인(연차원)은 허용, 재택으로 출근
    const yeon = await t.as('yeon', '1.2.3.4');
    expect((await yeon.get('/api/auth/me')).status).toBe(200);
    const ci = await yeon.post('/api/attendance/check-in');
    expect(ci.body.attendance.dayType).toBe('REMOTE');
  });

  it('등록되지 않은 IP 는 로그인도 차단', async () => {
    t.at('2026-11-16', '09:00:00');
    const res = await t.anon('8.8.8.8').post('/api/auth/login', { loginId: 'kim', password: '1234' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IP_DENIED');
  });

  it('T-20 팀원이 /api/dashboard/team → 403', async () => {
    t.at('2026-11-16', '09:00:00');
    const res = await (await t.as('yeon')).get('/api/dashboard/team');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect((await (await t.as('kim')).get('/api/dashboard/team')).status).toBe(200);
  });

  it('미로그인 → 401', async () => {
    const res = await t.anon().get('/api/dashboard/me');
    expect(res.status).toBe(401);
  });

  it('잘못된 비밀번호 → LOGIN_FAIL 이력, 비밀번호는 저장 안 함', async () => {
    t.at('2026-11-16', '09:00:00');
    await t.anon().post('/api/auth/login', { loginId: 'kim', password: 'wrong-pw' });
    const log = await t.db.getRepository(AuditLog).findOneByOrFail({ action: 'LOGIN_FAIL' });
    expect(log.result).toBe('FAIL');
    expect(log.body).not.toContain('wrong-pw');
    expect(log.body).toContain('***');
  });
});

describe('대시보드 (FR-DSH-01)', () => {
  it('팀 보드 상태 우선순위', async () => {
    t.at('2026-11-20', '09:00:00');
    await requestAndApprove('lim', '127.0.0.1', {
      type: 'REMOTE', targetDate: '2026-11-23', reason: '재택', ip: '1.2.3.4', startTime: '08:00', endTime: '19:00',
    });
    await requestAndApprove('yeon', '127.0.0.1', { type: 'ANNUAL', targetDate: '2026-11-23', reason: '휴가' });
    t.at('2026-11-23', '10:30:00');
    const kim = await t.as('kim');
    const board = (await kim.get('/api/dashboard/team')).body.members;
    const by = (name: string) => board.find((m: any) => m.user.name === name);
    expect(by('연차원').status).toBe('ANNUAL');
    expect(by('임자율').status).toBe('REMOTE_PLANNED');
    expect(by('김근태')).toMatchObject({ status: 'NOT_CHECKED_IN', lateRisk: true });
    await kim.post('/api/attendance/check-in');
    const after = (await kim.get('/api/dashboard/team')).body.members;
    expect(after.find((m: any) => m.user.name === '김근태')).toMatchObject({ status: 'WORKING', place: 'LAB' });
    t.at('2026-11-21', '10:00:00');
    expect((await kim.get('/api/dashboard/team')).body.members[0].status).toBe('DAY_OFF');
  });
});

describe('시간 조작 · 이력 (4.2, FR-LOG-01)', () => {
  it('PUT /api/dev/clock 로 서버 시각을 바꾼다', async () => {
    const anon = t.anon();
    const res = await anon.put('/api/dev/clock', { mode: 'fixed', at: '2026-11-16T09:00:00' });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('fixed');
    expect(res.body.now).toBe('2026-11-16T00:00:00.000Z');
    const clock = await anon.get('/api/clock');
    expect(clock.body.date).toBe('2026-11-16');
    const off = await anon.put('/api/dev/clock', { mode: 'offset', at: '2027-01-01T09:00:00+09:00' });
    expect(off.body.mode).toBe('offset');
    expect((await anon.put('/api/dev/clock', { mode: 'real' })).body.mode).toBe('real');
  });

  it('ENABLE_TIME_TRAVEL=false 면 dev 라우트가 없다', async () => {
    const t2 = await createTestApp({ enableTimeTravel: false });
    try {
      expect((await t2.anon().get('/api/dev/clock')).status).toBe(404);
    } finally {
      await t2.close();
    }
  });

  it('T-21 모든 행동이 audit_log 에 serverTime·realTime 과 함께 남음 (차단 포함)', async () => {
    t.at('2026-11-16', '10:00:01');
    const kim = await t.as('kim');
    await kim.post('/api/attendance/check-in');
    await kim.get('/api/dashboard/me');
    await t.anon('8.8.8.8').get('/api/clock');
    await (await t.as('yeon')).get('/api/dashboard/team');

    const logs = await t.db.getRepository(AuditLog).find({ order: { id: 'ASC' } });
    const actions = logs.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN', 'ATT_CHECK_IN', 'DSH_ME', 'IP_DENIED', 'FORBIDDEN']));
    for (const l of logs) {
      expect(l.serverTime).toBe('2026-11-16T01:00:01.000Z');
      expect(l.realTime).not.toBe(l.serverTime);
    }
    const ci = logs.find((l) => l.action === 'ATT_CHECK_IN')!;
    expect(ci).toMatchObject({ result: 'SUCCESS', method: 'POST', path: '/api/attendance/check-in', ip: '127.0.0.1' });
    expect(ci.userId).not.toBeNull();

    // 팀원은 본인 이력만
    const yeon = await t.as('yeon');
    const mine = await yeon.get('/api/audit-logs?size=200');
    const yeonId = (await yeon.get('/api/auth/me')).body.user.id;
    expect(mine.body.items.every((l: any) => l.userId === yeonId)).toBe(true);
    const all = await kim.get('/api/audit-logs?action=IP_DENIED');
    expect(all.body.total).toBe(1);
  });
});

describe('PDF (FR-REQ-03)', () => {
  it('신청서 PDF 를 내려받는다 (본인·리드만)', async () => {
    t.at('2026-11-20', '09:00:00');
    const yeon = await t.as('yeon');
    const r = await yeon.post('/api/requests', { type: 'ANNUAL', targetDate: '2026-11-24', reason: '가족 행사' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    // yeon 은 1/15 입사 → 11/20 기준 적립 10일
    const pdf = await yeon.get(`/api/requests/${r.body.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    const lim = await t.as('lim');
    expect((await lim.get(`/api/requests/${r.body.id}/pdf`)).status).toBe(403);
  }, 30000);
});
