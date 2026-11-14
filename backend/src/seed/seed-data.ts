/**
 * 시드 데이터. 최초 실행 시 비어 있는 테이블에만 들어간다.
 * 리드를 바꾸려면 role 만 바꾸면 된다 (원문에 리드 지정이 없어 김근태를 리드로 가정).
 */
import type { Role } from '../users/user.entity.js';

export const SEED_USERS: {
  loginId: string;
  password: string;
  name: string;
  role: Role;
  joinDate: string;
}[] = [
  { loginId: 'kim', password: '1234', name: '김근태', role: 'LEAD', joinDate: '2026-01-01' },
  { loginId: 'yeon', password: '1234', name: '연차원', role: 'MEMBER', joinDate: '2026-01-15' },
  { loginId: 'lim', password: '1234', name: '임자율', role: 'MEMBER', joinDate: '2026-02-12' },
];

/** 2026~2027 대한민국 공휴일 (대체공휴일 포함). 리드가 화면에서 추가·삭제할 수 있다. */
export const SEED_HOLIDAYS: { date: string; name: string }[] = [
  // 2026
  { date: '2026-01-01', name: '신정' },
  { date: '2026-02-16', name: '설날 연휴' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날 연휴' },
  { date: '2026-03-01', name: '삼일절' },
  { date: '2026-03-02', name: '대체공휴일(삼일절)' },
  { date: '2026-05-05', name: '어린이날' },
  { date: '2026-05-24', name: '부처님오신날' },
  { date: '2026-05-25', name: '대체공휴일(부처님오신날)' },
  { date: '2026-06-03', name: '전국동시지방선거' },
  { date: '2026-06-06', name: '현충일' },
  { date: '2026-08-15', name: '광복절' },
  { date: '2026-08-17', name: '대체공휴일(광복절)' },
  { date: '2026-09-24', name: '추석 연휴' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-09-26', name: '추석 연휴' },
  { date: '2026-10-03', name: '개천절' },
  { date: '2026-10-05', name: '대체공휴일(개천절)' },
  { date: '2026-10-09', name: '한글날' },
  { date: '2026-12-25', name: '성탄절' },
  // 2027
  { date: '2027-01-01', name: '신정' },
  { date: '2027-02-06', name: '설날 연휴' },
  { date: '2027-02-07', name: '설날' },
  { date: '2027-02-08', name: '설날 연휴' },
  { date: '2027-02-09', name: '대체공휴일(설날)' },
  { date: '2027-03-01', name: '삼일절' },
  { date: '2027-05-05', name: '어린이날' },
  { date: '2027-05-13', name: '부처님오신날' },
  { date: '2027-06-06', name: '현충일' },
  { date: '2027-08-15', name: '광복절' },
  { date: '2027-08-16', name: '대체공휴일(광복절)' },
  { date: '2027-09-14', name: '추석 연휴' },
  { date: '2027-09-15', name: '추석' },
  { date: '2027-09-16', name: '추석 연휴' },
  { date: '2027-10-03', name: '개천절' },
  { date: '2027-10-04', name: '대체공휴일(개천절)' },
  { date: '2027-10-09', name: '한글날' },
  { date: '2027-10-11', name: '대체공휴일(한글날)' },
  { date: '2027-12-25', name: '성탄절' },
  { date: '2027-12-27', name: '대체공휴일(성탄절)' },
];
