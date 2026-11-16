import { z } from 'zod';
import { isValidDate } from './time.js';

/** 'YYYY-MM-DD' 이면서 실제 달력에 있는 날짜 (2026-02-30 같은 값 거부) */
export const DateStr = z.string().refine(isValidDate, '올바른 날짜가 아닙니다');
