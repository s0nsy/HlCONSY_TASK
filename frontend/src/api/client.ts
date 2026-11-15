/**
 * API 클라이언트. 모든 판정은 서버에서 하고, 여기서는 호출·오류 변환만 한다.
 * 개발 모드 IP 위장: localStorage 의 값을 X-Debug-Client-IP 헤더로 보낸다.
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: any;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
  get code() {
    return this.body.code;
  }
}

const IP_KEY = 'hiconsy.debugIp';

/** 데모 빌드: 방문자 실제 IP 는 연구실 IP 가 아니므로, 위장 값이 없으면 연구실 IP 로 가정한다 */
export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';
const DEMO_DEFAULT_IP = '127.0.0.1';

export function getDebugIp(): string {
  try {
    return localStorage.getItem(IP_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setDebugIp(ip: string) {
  try {
    if (ip) localStorage.setItem(IP_KEY, ip);
    else localStorage.removeItem(IP_KEY);
  } catch {
    /* 저장 불가 환경 */
  }
}

type Listener = (err: ApiError) => void;
const listeners: Listener[] = [];
/** IP 차단(403 IP_DENIED)·세션 만료(401) 를 전역에서 처리하기 위한 구독 */
export function onApiError(fn: Listener) {
  listeners.push(fn);
}

function headers(json: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const ip = getDebugIp() || (IS_DEMO ? DEMO_DEFAULT_IP : '');
  if (ip) h['X-Debug-Client-IP'] = ip;
  return h;
}

async function raw(method: string, url: string, body?: unknown): Promise<Response> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'include',
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let parsed: ApiErrorBody;
    try {
      parsed = await res.json();
    } catch {
      parsed = { code: `HTTP_${res.status}`, message: `요청 실패 (${res.status})` };
    }
    const err = new ApiError(res.status, parsed);
    listeners.forEach((l) => l(err));
    throw err;
  }
  return res;
}

async function json<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await raw(method, url, body);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(url: string) => json<T>('GET', url),
  post: <T>(url: string, body: unknown = {}) => json<T>('POST', url, body),
  put: <T>(url: string, body: unknown = {}) => json<T>('PUT', url, body),
  del: <T>(url: string) => json<T>('DELETE', url),
  /** 파일 다운로드 (헤더가 필요해서 <a href> 대신 fetch) */
  async download(url: string, filename: string) {
    const res = await raw('GET', url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};
