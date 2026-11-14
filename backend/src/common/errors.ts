import { HttpException, HttpStatus } from '@nestjs/common';

/** 모든 오류 응답은 { code, message, details? } 형식. */
export enum ErrorCode {
  // 시스템
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL = 'INTERNAL',
  IP_DENIED = 'IP_DENIED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  FORBIDDEN = 'FORBIDDEN',

  // 출퇴근
  ATT_TOO_EARLY = 'ATT_TOO_EARLY',
  ATT_ALREADY_CHECKED_IN = 'ATT_ALREADY_CHECKED_IN',
  ATT_ANNUAL_LEAVE_DAY = 'ATT_ANNUAL_LEAVE_DAY',
  ATT_NO_HOLIDAY_WORK_REQUEST = 'ATT_NO_HOLIDAY_WORK_REQUEST',
  ATT_OUTSIDE_WINDOW = 'ATT_OUTSIDE_WINDOW',
  ATT_IP_MISMATCH = 'ATT_IP_MISMATCH',
  ATT_NOT_CHECKED_IN = 'ATT_NOT_CHECKED_IN',
  ATT_ALREADY_CHECKED_OUT = 'ATT_ALREADY_CHECKED_OUT',
  ATT_CHECKOUT_TOO_EARLY = 'ATT_CHECKOUT_TOO_EARLY',
  ATT_CHECKOUT_BEFORE_CHECKIN = 'ATT_CHECKOUT_BEFORE_CHECKIN',
  ATT_PENDING_CHECKOUT_REQUIRED = 'ATT_PENDING_CHECKOUT_REQUIRED',
  ATT_MANUAL_INVALID = 'ATT_MANUAL_INVALID',

  // 신청
  REQ_DEADLINE_PASSED = 'REQ_DEADLINE_PASSED',
  REQ_INVALID_DATE = 'REQ_INVALID_DATE',
  REQ_NOT_BUSINESS_DAY = 'REQ_NOT_BUSINESS_DAY',
  REQ_NOT_HOLIDAY = 'REQ_NOT_HOLIDAY',
  REQ_DUPLICATE = 'REQ_DUPLICATE',
  REQ_REMOTE_LIMIT = 'REQ_REMOTE_LIMIT',
  REQ_ANNUAL_INSUFFICIENT = 'REQ_ANNUAL_INSUFFICIENT',
  REQ_OFF_EXPIRED = 'REQ_OFF_EXPIRED',
  REQ_OFF_INSUFFICIENT = 'REQ_OFF_INSUFFICIENT',
  REQ_INVALID_TIME_RANGE = 'REQ_INVALID_TIME_RANGE',
  REQ_INVALID_IP = 'REQ_INVALID_IP',
  REQ_MISSING_FIELDS = 'REQ_MISSING_FIELDS',
  REQ_NOT_CANCELABLE = 'REQ_NOT_CANCELABLE',
  REQ_NOT_PENDING = 'REQ_NOT_PENDING',
  REQ_REVIEW_EXPIRED = 'REQ_REVIEW_EXPIRED',
  REQ_NOT_OWNER = 'REQ_NOT_OWNER',

  // 기타
  HOLIDAY_EXISTS = 'HOLIDAY_EXISTS',
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: '입력값이 올바르지 않습니다.',
  NOT_FOUND: '대상을 찾을 수 없습니다.',
  INTERNAL: '서버 오류가 발생했습니다.',
  IP_DENIED: '허용되지 않은 IP입니다.',
  AUTH_REQUIRED: '로그인이 필요합니다.',
  AUTH_INVALID_CREDENTIALS: '아이디 또는 비밀번호가 올바르지 않습니다.',
  FORBIDDEN: '권한이 없습니다.',

  ATT_TOO_EARLY: '출근은 07:00부터 등록할 수 있습니다.',
  ATT_ALREADY_CHECKED_IN: '오늘은 이미 출근을 등록했습니다.',
  ATT_ANNUAL_LEAVE_DAY: '연차일입니다. 출근을 등록할 수 없습니다.',
  ATT_NO_HOLIDAY_WORK_REQUEST:
    '주말·공휴일은 승인된 근무 신청이 있어야 출근할 수 있습니다.',
  ATT_OUTSIDE_WINDOW: '신청한 근무 시간대가 아닙니다.',
  ATT_IP_MISMATCH: '신청한 IP에서만 출퇴근할 수 있습니다.',
  ATT_NOT_CHECKED_IN: '오늘 출근 기록이 없습니다.',
  ATT_ALREADY_CHECKED_OUT: '오늘은 이미 퇴근을 등록했습니다.',
  ATT_CHECKOUT_TOO_EARLY: '퇴근은 16:00부터 등록할 수 있습니다.',
  ATT_CHECKOUT_BEFORE_CHECKIN: '퇴근 시각이 출근 시각보다 빠릅니다.',
  ATT_PENDING_CHECKOUT_REQUIRED:
    '퇴근 미기록 건이 있습니다. 퇴근 시각을 먼저 입력해 주세요.',
  ATT_MANUAL_INVALID: '직접 입력한 퇴근 시각이 올바르지 않습니다.',

  REQ_DEADLINE_PASSED: '신청 기한(직전 영업일 17:00)이 지났습니다.',
  REQ_INVALID_DATE: '날짜 형식이 올바르지 않습니다.',
  REQ_NOT_BUSINESS_DAY: '연차·재택·OFF는 영업일에만 신청할 수 있습니다.',
  REQ_NOT_HOLIDAY: '주말/공휴일 근무는 주말·공휴일에만 신청할 수 있습니다.',
  REQ_DUPLICATE: '같은 날짜에 이미 신청한 건이 있습니다.',
  REQ_REMOTE_LIMIT: '재택은 한 달에 2회까지 신청할 수 있습니다.',
  REQ_ANNUAL_INSUFFICIENT: '연차 잔여가 없습니다.',
  REQ_OFF_EXPIRED: '사용일 기준으로 유효한 OFF가 없습니다(만료).',
  REQ_OFF_INSUFFICIENT: 'OFF 잔여가 없습니다.',
  REQ_INVALID_TIME_RANGE: '시간대가 올바르지 않습니다 (시작 < 종료).',
  REQ_INVALID_IP: 'IP 형식이 올바르지 않습니다.',
  REQ_MISSING_FIELDS: '필수 입력값이 빠졌습니다.',
  REQ_NOT_CANCELABLE: '취소 기한이 지났거나 취소할 수 없는 상태입니다.',
  REQ_NOT_PENDING: '대기 중인 신청만 처리할 수 있습니다.',
  REQ_REVIEW_EXPIRED:
    '사용일이 이미 시작된 신청은 승인할 수 없습니다(소급 불가).',
  REQ_NOT_OWNER: '본인 신청만 처리할 수 있습니다.',

  HOLIDAY_EXISTS: '이미 등록된 공휴일입니다.',
};

const DEFAULT_STATUS: Partial<Record<ErrorCode, number>> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
  IP_DENIED: HttpStatus.FORBIDDEN,
  AUTH_REQUIRED: HttpStatus.UNAUTHORIZED,
  AUTH_INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  REQ_NOT_OWNER: HttpStatus.FORBIDDEN,
  ATT_ALREADY_CHECKED_IN: HttpStatus.CONFLICT,
  ATT_ALREADY_CHECKED_OUT: HttpStatus.CONFLICT,
  ATT_PENDING_CHECKOUT_REQUIRED: HttpStatus.CONFLICT,
  REQ_DUPLICATE: HttpStatus.CONFLICT,
  HOLIDAY_EXISTS: HttpStatus.CONFLICT,
};

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    details?: unknown,
    message?: string,
    status?: number,
  ) {
    const body: ErrorBody = {
      code,
      message: message ?? ERROR_MESSAGES[code],
      ...(details !== undefined ? { details } : {}),
    };
    super(body, status ?? DEFAULT_STATUS[code] ?? HttpStatus.BAD_REQUEST);
  }
}
