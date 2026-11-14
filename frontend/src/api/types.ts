export type Role = 'MEMBER' | 'LEAD';
export interface User {
  id: number;
  loginId: string;
  name: string;
  role: Role;
  joinDate: string;
}

export type RequestType = 'ANNUAL' | 'REMOTE' | 'OFF' | 'HOLIDAY_WORK';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';

export interface Attendance {
  id: number;
  userId: number;
  userName?: string;
  workDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  checkOutSource: 'BUTTON' | 'MANUAL' | null;
  workMinutes: number | null;
  lunchMinutes: number | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  dayType: 'WEEKDAY' | 'REMOTE' | 'HOLIDAY_WORK';
  badges: string[];
  rule?: string;
}

export interface WorkRequest {
  id: number;
  userId: number;
  userName?: string;
  type: RequestType;
  targetDate: string;
  reason: string;
  ip: string | null;
  startTime: string | null;
  endTime: string | null;
  offHalf: 'AM' | 'PM' | null;
  status: RequestStatus;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  deadline: string;
  deadlineLabel: string;
  cancelable: boolean;
}

export interface OffGrant {
  grantId: number;
  grantDate: string;
  expiresAt: string;
  expireDate: string;
  remaining: number;
  expired: boolean;
}

export interface BalanceSummary {
  userId: number;
  asOf: string;
  annual: { accrued: number; used: number; remaining: number; nextAccrualDate: string };
  remote: {
    thisMonth: { month: string; limit: number; used: number; remaining: number };
    nextMonth: { month: string; limit: number; used: number; remaining: number };
  };
  off: { available: number; grants: OffGrant[] };
}

export interface LedgerItem {
  id: number | null;
  kind: 'ANNUAL' | 'REMOTE' | 'OFF';
  delta: number;
  reason: string;
  effectiveDate: string;
  occurredAt: string | null;
  expiresAt: string | null;
  computed: boolean;
}

export interface BoardEntry {
  status: string;
  statusLabel: string;
  place: 'LAB' | 'REMOTE' | 'HOLIDAY_WORK' | null;
  lateRisk: boolean;
  badges: string[];
  attendance: Attendance | null;
  requests: {
    remote: { id: number; ip: string; startTime: string; endTime: string } | null;
    off: { id: number; offHalf: 'AM' | 'PM' } | null;
    holidayWork: { id: number; ip: string; startTime: string; endTime: string } | null;
  };
}

export interface DayInfo {
  now: string;
  date: string;
  business: boolean;
  holidayName: string | null;
  weekend: boolean;
}

export interface MyCard extends BoardEntry {
  day: DayInfo;
  user: User;
  clientIp: string;
  canCheckIn: boolean;
  checkInReason: string | null;
  checkInCode: string | null;
  canCheckOut: boolean;
  checkOutReason: string | null;
  checkOutCode: string | null;
  pendingCheckouts: Attendance[];
  balance: BalanceSummary;
}

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  method: string;
  path: string;
  ip: string;
  body: string | null;
  result: 'SUCCESS' | 'FAIL';
  statusCode: number;
  errorCode: string | null;
  serverTime: string;
  realTime: string;
}
