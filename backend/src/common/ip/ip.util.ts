import type { Request } from 'express';
import type { AppConfig } from '../../config/app-config.js';

export const DEBUG_IP_HEADER = 'x-debug-client-ip';

/** '::1', '::ffff:127.0.0.1' → '127.0.0.1' */
export function normalizeIp(raw: string | undefined | null): string {
  if (!raw) return 'unknown';
  let ip = raw.trim();
  // X-Forwarded-For 등 목록이면 첫 번째
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return '127.0.0.1';
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (m) return m[1];
  return ip.toLowerCase();
}

/** 요청의 클라이언트 IP. 요청 객체에 캐시한다. */
export function clientIp(req: Request, config: AppConfig): string {
  const cached = (req as any).__clientIp as string | undefined;
  if (cached) return cached;
  let ip: string;
  const override = req.headers[DEBUG_IP_HEADER];
  if (config.enableIpOverride && typeof override === 'string' && override.trim()) {
    ip = normalizeIp(override);
  } else if (config.trustProxy) {
    ip = normalizeIp(req.ip);
  } else {
    ip = normalizeIp(req.socket?.remoteAddress);
  }
  (req as any).__clientIp = ip;
  return ip;
}
