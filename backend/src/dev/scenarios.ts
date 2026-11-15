/**
 * request.md 9장 인수 테스트 시나리오(T-01 ~ T-21)의 "준비" 상태를 정의한다.
 * 디버그 패널에서 버튼 하나로 이 상태를 만들고, 화면에서 "행동"만 하면 기대 결과를 확인할 수 있다.
 *
 * - setup: 준비 단계에서 미리 해 둘 일 (서버 시각을 바꿔 가며 서비스 호출)
 * - clock: 준비가 끝난 뒤 맞출 서버 시각 (고정)
 * - ip: 디버그 IP 위장 값 ('' = 위장 해제 → 127.0.0.1)
 * - loginAs / route: 자동 로그인할 계정, 이동할 화면
 * - steps: 화면에서 할 행동. at 이 있으면 패널에 "그 시각으로 이동" 버튼이 생긴다
 */
import type { CreateRequestInput } from '../requests/requests.service.js';

export type SetupAction =
  | { kind: 'checkIn'; user: string; date: string; time: string; ip?: string }
  | { kind: 'checkOut'; user: string; date: string; time: string; ip?: string }
  | { kind: 'request'; user: string; date: string; time: string; input: CreateRequestInput; approve?: boolean };

export interface ScenarioStep {
  text: string;
  /** "YYYY-MM-DD HH:mm:ss" (서울). 있으면 패널에서 그 시각으로 바로 이동할 수 있다 */
  at?: string;
  /** API 경로 (GET, /api 제외). 있으면 패널에서 호출하고 응답 코드를 보여 준다 — 화면으로 안 보이는 결과 확인용 */
  call?: string;
}

export interface Scenario {
  id: string;
  title: string;
  setup: SetupAction[];
  clock: string;
  ip: string;
  loginAs: string;
  route: string;
  steps: ScenarioStep[];
  expected: string;
}

/** T-14/T-15/T-16/T-09 공통: 연차원이 토요일(11-21) 10:00~15:00 IP 10.0.0.5 근무 승인 */
const WEEKEND_WORK: SetupAction = {
  kind: 'request',
  user: 'yeon',
  date: '2026-11-19',
  time: '10:00:00',
  approve: true,
  input: { type: 'HOLIDAY_WORK', targetDate: '2026-11-21', reason: '주말 근무', ip: '10.0.0.5', startTime: '10:00', endTime: '15:00' },
};
/** 위 근무를 실제로 하고 OFF 를 받는다 */
const WEEKEND_WORK_DONE: SetupAction[] = [
  WEEKEND_WORK,
  { kind: 'checkIn', user: 'yeon', date: '2026-11-21', time: '10:00:00', ip: '10.0.0.5' },
  { kind: 'checkOut', user: 'yeon', date: '2026-11-21', time: '14:00:00', ip: '10.0.0.5' },
];

const kimIn = (date: string, time: string): SetupAction => ({ kind: 'checkIn', user: 'kim', date, time });

export const SCENARIOS: Scenario[] = [
  // ── 출근 ──
  {
    id: 'T-01',
    title: '07:00 전 출근 거부',
    setup: [],
    clock: '2026-11-16 06:59:59',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '홈에서 출근 버튼 상태(툴팁)를 확인한다' }],
    expected: '출근 버튼 비활성, "출근은 07:00부터…" (ATT_TOO_EARLY)',
  },
  {
    id: 'T-02',
    title: '10:00:00 출근 = 정상',
    setup: [],
    clock: '2026-11-16 10:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '출근 버튼을 누른다' }],
    expected: '출근 10:00:00, 지각 배지 없음',
  },
  {
    id: 'T-03',
    title: '10:00:01 출근 = 지각',
    setup: [],
    clock: '2026-11-16 10:00:01',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '출근 버튼을 누른다' }],
    expected: '출근 10:00:01 (지각), 지각 배지',
  },
  // ── 퇴근 ──
  {
    id: 'T-04',
    title: '16:00 전 퇴근 거부',
    setup: [kimIn('2026-11-17', '09:00:00')],
    clock: '2026-11-17 15:59:00',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '09:00 출근 상태. 홈에서 퇴근 버튼 상태(툴팁)를 확인한다' }],
    expected: '퇴근 버튼 비활성, "퇴근은 16:00부터…" (ATT_CHECKOUT_TOO_EARLY)',
  },
  {
    id: 'T-05',
    title: '09:00→18:00 = 480분 정상',
    setup: [kimIn('2026-11-17', '09:00:00')],
    clock: '2026-11-17 18:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '퇴근 버튼을 누른다' }],
    expected: '근무 8시간 00분, 점심 60분 차감, 판정 없음',
  },
  {
    id: 'T-06',
    title: '09:00→17:59 = 479분 조퇴',
    setup: [kimIn('2026-11-17', '09:00:00')],
    clock: '2026-11-17 17:59:00',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '퇴근 버튼을 누른다' }],
    expected: '근무 7시간 59분, 조퇴',
  },
  {
    id: 'T-07',
    title: '12:00→20:00 = 점심 30분 차감',
    setup: [kimIn('2026-11-17', '12:00:00')],
    clock: '2026-11-17 20:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '퇴근 버튼을 누른다' }, { text: '「내 근무」에서 점심 차감을 확인한다' }],
    expected: '점심 30분 차감 → 7시간 30분, 조퇴',
  },
  {
    id: 'T-08',
    title: '13:00→21:00 = 점심 0분',
    setup: [kimIn('2026-11-17', '13:00:00')],
    clock: '2026-11-17 21:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [{ text: '퇴근 버튼을 누른다' }],
    expected: '점심 0분 → 8시간, 정상',
  },
  {
    id: 'T-09',
    title: '반일 OFF 날 13:00→17:00',
    setup: [
      ...WEEKEND_WORK_DONE,
      {
        kind: 'request',
        user: 'yeon',
        date: '2026-11-23',
        time: '09:00:00',
        approve: true,
        input: { type: 'OFF', targetDate: '2026-11-24', reason: '오전 OFF', offHalf: 'AM' },
      },
    ],
    clock: '2026-11-24 13:00:00',
    ip: '',
    loginAs: 'yeon',
    route: '/',
    steps: [{ text: '출근 버튼을 누른다 (지각 판정 없음)' }, { text: '17:00 으로 이동해 퇴근한다', at: '2026-11-24 17:00:00' }],
    expected: '근무 240분 정상, OFF 배지, 지각 없음',
  },
  // ── 미기록 ──
  {
    id: 'T-10',
    title: '퇴근 미기록 → 직접 입력',
    setup: [kimIn('2026-11-16', '09:00:00')],
    clock: '2026-11-17 09:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/',
    steps: [
      { text: '어제(11-16) 출근만 있는 상태. 출근 버튼을 누른다' },
      { text: '"퇴근 미기록" 창에서 11-16 퇴근 시각 18:00:00 을 넣고 「입력하고 출근」' },
      { text: '홈의 「직접 입력」 목록을 확인한다' },
    ],
    expected: '11-16 이 직접 입력(18:00)으로 기록되고, 오늘 09:00 출근',
  },
  // ── 신청 ──
  {
    id: 'T-11',
    title: '금 17:00:00 월요일 연차 신청 = 허용',
    setup: [],
    clock: '2026-11-20 17:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/requests/new',
    steps: [{ text: '종류 연차, 사용일 2026-11-23 으로 신청한다' }],
    expected: '마감 "11/20(금) 17:00" 안내, 제출 성공',
  },
  {
    id: 'T-12',
    title: '금 17:00:01 월요일 연차 신청 = 거부',
    setup: [],
    clock: '2026-11-20 17:00:01',
    ip: '',
    loginAs: 'kim',
    route: '/requests/new',
    steps: [{ text: '종류 연차, 사용일 2026-11-23 을 고른다' }],
    expected: '"(마감됨)" 안내, 제출 버튼 비활성 (REQ_DEADLINE_PASSED)',
  },
  {
    id: 'T-13',
    title: '같은 달 3번째 재택 = 거부',
    setup: [
      { kind: 'request', user: 'yeon', date: '2026-11-20', time: '10:00:00', input: { type: 'REMOTE', targetDate: '2026-12-07', reason: '재택 1', ip: '1.2.3.4', startTime: '09:00', endTime: '18:00' } },
      { kind: 'request', user: 'yeon', date: '2026-11-20', time: '10:00:00', input: { type: 'REMOTE', targetDate: '2026-12-08', reason: '재택 2', ip: '1.2.3.4', startTime: '09:00', endTime: '18:00' } },
    ],
    clock: '2026-11-20 10:00:00',
    ip: '',
    loginAs: 'yeon',
    route: '/requests/new',
    steps: [{ text: '12월 재택 2건(12-07, 12-08)이 있는 상태. 재택 2026-12-09 를 신청한다' }],
    expected: '"재택은 한 달에 2회까지…" (REQ_REMOTE_LIMIT)',
  },
  // ── 주말 근무 · IP ──
  {
    id: 'T-14',
    title: '주말 근무 시간 전 접속 = 차단',
    setup: [WEEKEND_WORK],
    clock: '2026-11-21 09:59:00',
    ip: '10.0.0.5',
    loginAs: 'yeon',
    route: '/',
    steps: [{ text: '토 10:00~15:00, IP 10.0.0.5 근무가 승인된 상태에서 09:59 에 10.0.0.5 로 접속' }],
    expected: '차단 페이지 "허용되지 않은 IP입니다: 10.0.0.5 / 서버 시각 …"',
  },
  {
    id: 'T-15',
    title: '주말 근무 → OFF 지급',
    setup: [WEEKEND_WORK],
    clock: '2026-11-21 10:00:00',
    ip: '10.0.0.5',
    loginAs: 'yeon',
    route: '/',
    steps: [
      { text: '출근 버튼을 누른다 (근무 형태 "주말/공휴일 근무")' },
      { text: '14:00 으로 이동해 퇴근한다', at: '2026-11-21 14:00:00' },
      { text: '「잔여」에서 OFF 를 확인한다' },
    ],
    expected: '기록됨, 반일 OFF 1개 (만료 2026-12-21 23:59:59)',
  },
  {
    id: 'T-16',
    title: 'OFF 만료 후 신청 = 거부',
    setup: WEEKEND_WORK_DONE,
    clock: '2026-12-22 09:00:00',
    ip: '',
    loginAs: 'yeon',
    route: '/requests/new',
    steps: [{ text: '11-21 근무로 받은 OFF 가 만료된 상태. OFF, 사용일 2026-12-23 을 고른다' }, { text: '「잔여」에서 OFF 상태를 확인한다' }],
    expected: '"사용일 기준으로 유효한 OFF가 없습니다(만료)" (REQ_OFF_EXPIRED), 잔여 OFF 0',
  },
  // ── 잔여 ──
  {
    id: 'T-17',
    title: '2026-02-01 연차 잔여',
    setup: [],
    clock: '2026-02-01 00:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/balance',
    steps: [{ text: '「잔여」에서 사용자를 바꿔 가며 연차 잔여를 본다' }],
    expected: '김근태 1일, 연차원 0일, 임자율 0일',
  },
  {
    id: 'T-18',
    title: '2026-03-12 임자율 연차 잔여',
    setup: [],
    clock: '2026-03-12 00:00:00',
    ip: '',
    loginAs: 'lim',
    route: '/balance',
    steps: [{ text: '연차 잔여를 본다' }, { text: '03-11 23:59:59 로 이동해 다시 본다', at: '2026-03-11 23:59:59' }],
    expected: '03-12 00:00 에 1일, 03-11 23:59:59 에는 0일',
  },
  {
    id: 'T-19',
    title: '남의 재택 IP 로 로그인 = 차단',
    setup: [
      {
        kind: 'request',
        user: 'yeon',
        date: '2026-11-20',
        time: '10:00:00',
        approve: true,
        input: { type: 'REMOTE', targetDate: '2026-11-23', reason: '재택', ip: '1.2.3.4', startTime: '08:00', endTime: '19:00' },
      },
    ],
    clock: '2026-11-23 09:00:00',
    ip: '1.2.3.4',
    loginAs: 'kim',
    route: '/',
    steps: [
      { text: '연차원의 재택(IP 1.2.3.4)이 승인된 상태에서 1.2.3.4 로 김근태가 로그인했다' },
      { text: '로그아웃 후 yeon / 1234 로 로그인해 출근해 본다' },
    ],
    expected: '김근태는 로그인 직후 차단 페이지. 연차원은 정상, 출근 시 근무 형태 "재택"',
  },
  // ── 권한 · 이력 ──
  {
    id: 'T-20',
    title: '팀원이 리드 화면 접근 = 403',
    setup: [],
    clock: '2026-11-16 09:00:00',
    ip: '',
    loginAs: 'yeon',
    route: '/approvals',
    steps: [
      { text: '팀원(연차원)으로 /approvals 에 들어갔다. 없는 주소(예: /abc)와 같은 화면인지 비교한다' },
      { text: '팀 현황 API 를 직접 호출한다', call: '/dashboard/team' },
      { text: '「이력」에서 FORBIDDEN 기록을 보려면 kim 으로 로그인' },
    ],
    expected: '"접근할 수 없는 페이지입니다" + 홈 버튼 (없는 주소와 동일, 화면 이름 노출 없음), API 는 403 FORBIDDEN',
  },
  {
    id: 'T-21',
    title: '모든 행동이 이력에 남음',
    setup: [kimIn('2026-11-16', '09:00:00')],
    clock: '2026-11-16 18:00:00',
    ip: '',
    loginAs: 'kim',
    route: '/audit',
    steps: [{ text: '「이력」에서 방금 로그인·시나리오 실행 기록을 확인한다' }, { text: '퇴근 등 아무 행동 후 다시 확인한다' }],
    expected: '모든 요청이 서버 시각·실제 시각과 함께 기록. IP_DENIED·FORBIDDEN·LOGIN_FAIL 도 필터로 확인',
  },
];
