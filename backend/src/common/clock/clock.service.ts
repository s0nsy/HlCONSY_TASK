import { Injectable } from '@nestjs/common';
import { type Dayjs, fromEpoch } from '../time.js';

export type ClockMode = 'real' | 'fixed' | 'offset';

export interface ClockState {
  mode: ClockMode;
  now: string;
  realNow: string;
  offsetMs: number;
  timezone: string;
}

/**
 * 서버의 "현재 시각" 유일한 출처.
 * 이 파일 밖에서는 new Date() / Date.now() / 인자 없는 dayjs() 를 쓰지 않는다
 * (test/no-direct-clock.spec.ts 가 소스를 검사한다).
 */
@Injectable()
export class ClockService {
  private mode: ClockMode = 'real';
  private fixedMs = 0;
  private offsetMs = 0;

  /** 실제 시각(감사 로그의 realTime 용) */
  realNowMs(): number {
    return Date.now();
  }

  nowMs(): number {
    switch (this.mode) {
      case 'fixed':
        return this.fixedMs;
      case 'offset':
        return this.realNowMs() + this.offsetMs;
      default:
        return this.realNowMs();
    }
  }

  /** Asia/Seoul 기준 현재 시각 */
  now(): Dayjs {
    return fromEpoch(this.nowMs());
  }

  nowIso(): string {
    return new Date(this.nowMs()).toISOString();
  }

  realNowIso(): string {
    return new Date(this.realNowMs()).toISOString();
  }

  /** mode=fixed|offset 은 at(ISO) 필수. offset 은 "지금 이 순간 = at" 이 되도록 오프셋을 잡고 시간이 흐른다. */
  set(mode: ClockMode, atMs?: number): ClockState {
    if (mode === 'real') {
      this.mode = 'real';
      this.offsetMs = 0;
    } else {
      if (atMs === undefined || Number.isNaN(atMs)) {
        throw new Error('at is required for fixed/offset mode');
      }
      if (mode === 'fixed') {
        this.mode = 'fixed';
        this.fixedMs = atMs;
        this.offsetMs = atMs - this.realNowMs();
      } else {
        this.mode = 'offset';
        this.offsetMs = atMs - this.realNowMs();
      }
    }
    return this.state();
  }

  state(): ClockState {
    return {
      mode: this.mode,
      now: this.nowIso(),
      realNow: this.realNowIso(),
      offsetMs: this.mode === 'real' ? 0 : this.nowMs() - this.realNowMs(),
      timezone: 'Asia/Seoul',
    };
  }
}
