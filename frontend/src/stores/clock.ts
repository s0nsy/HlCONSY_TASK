import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';
import { parts } from '../utils/format';

interface ClockResponse {
  now: string;
  epochMs: number;
  date: string;
  mode: 'real' | 'fixed' | 'offset';
  clientIp: string;
}

/**
 * 서버 기준 현재 시각. 서버가 준 epochMs 위에서 performance.now() 경과만큼 tick 한다
 * (클라이언트의 벽시계는 쓰지 않는다). fixed 모드면 멈춰 있다.
 */
export const useClockStore = defineStore('clock', () => {
  const serverMs = ref<number | null>(null);
  const syncedAt = ref(0);
  const mode = ref<ClockResponse['mode']>('real');
  const clientIp = ref('');
  const tick = ref(0);
  let timer: number | undefined;
  let resync: number | undefined;

  const nowMs = computed(() => {
    void tick.value;
    if (serverMs.value === null) return null;
    if (mode.value === 'fixed') return serverMs.value;
    return serverMs.value + (performance.now() - syncedAt.value);
  });

  const display = computed(() => {
    if (nowMs.value === null) return '서버 시각 확인 중…';
    const p = parts(nowMs.value);
    return `${p.date}(${p.weekday}) ${p.time}`;
  });

  async function sync() {
    try {
      const r = await api.get<ClockResponse>('/clock');
      serverMs.value = r.epochMs;
      syncedAt.value = performance.now();
      mode.value = r.mode;
      clientIp.value = r.clientIp;
    } catch {
      /* IP 차단 등은 전역 처리 */
    }
  }

  function start() {
    if (timer) return;
    void sync();
    timer = window.setInterval(() => tick.value++, 1000);
    resync = window.setInterval(sync, 5 * 60 * 1000);
  }

  function stop() {
    window.clearInterval(timer);
    window.clearInterval(resync);
    timer = undefined;
  }

  return { nowMs, display, mode, clientIp, sync, start, stop };
});
