/** 서버가 준 순간(ISO)을 서울 시각 문자열로. 클라이언트 시계는 쓰지 않는다. */
const dtf = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  weekday: 'short',
});

export function parts(ms: number) {
  const p = Object.fromEntries(dtf.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`,
    weekday: p.weekday as string,
  };
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const p = parts(Date.parse(iso));
  return `${p.date} ${p.time}`;
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return '-';
  return `${Math.floor(min / 60)}시간 ${String(min % 60).padStart(2, '0')}분`;
}

export const TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차',
  REMOTE: '재택',
  OFF: '반일 OFF',
  HOLIDAY_WORK: '주말/공휴일 근무',
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELED: '취소',
  EXPIRED: '만료(미승인)',
};

export const STATUS_TAG: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELED: 'default',
  EXPIRED: 'default',
};

export const BADGE: Record<string, { label: string; type: 'warning' | 'error' | 'info' | 'success' | 'default' }> = {
  LATE: { label: '지각', type: 'warning' },
  EARLY_LEAVE: { label: '조퇴', type: 'error' },
  MANUAL: { label: '직접 입력', type: 'info' },
  OFF: { label: 'OFF', type: 'success' },
};

export const DAY_TYPE_LABEL: Record<string, string> = {
  WEEKDAY: '연구실',
  REMOTE: '재택',
  HOLIDAY_WORK: '주말/공휴일 근무',
};

export const PLACE_LABEL: Record<string, string> = {
  LAB: '연구실',
  REMOTE: '재택',
  HOLIDAY_WORK: '주말/공휴일 근무',
};
