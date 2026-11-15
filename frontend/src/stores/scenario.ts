import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, setDebugIp } from '../api/client';

export interface ScenarioStep {
  text: string;
  /** "YYYY-MM-DD HH:mm:ss" (서울) */
  at?: string;
  /** GET 할 API 경로 (/api 제외) */
  call?: string;
}

export interface Scenario {
  id: string;
  title: string;
  clock: string;
  ip: string;
  loginAs: string;
  route: string;
  steps: ScenarioStep[];
  expected: string;
}

interface RunResult extends Scenario {
  login: { loginId: string; password: string };
}

const KEY = 'hiconsy.scenario';

function load(): Scenario | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Scenario) : null;
  } catch {
    return null;
  }
}
function save(s: Scenario | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장 불가 환경 */
  }
}

/**
 * 9장 시나리오 원클릭 재현 (개발 모드).
 * 서버가 준비 상태(데이터·시각)를 만들고, 여기서는 IP 위장 → 로그인까지 이어서 한다.
 * 진행 중인 시나리오는 새로고침해도 가이드가 남도록 localStorage 에 둔다.
 */
export const useScenarioStore = defineStore('scenario', () => {
  const list = ref<Scenario[]>([]);
  const active = ref<Scenario | null>(load());

  async function fetchList() {
    if (list.value.length) return;
    list.value = (await api.get<{ items: Scenario[] }>('/dev/scenarios')).items;
  }

  /** 준비 상태 생성. 로그인·이동은 호출한 쪽에서 (차단 시나리오는 로그인 자체가 막힌다) */
  async function run(id: string): Promise<RunResult> {
    // 이전 시나리오의 IP 위장이 남아 있으면 /dev 호출부터 막히므로 먼저 해제
    setDebugIp('');
    const r = await api.post<RunResult>(`/dev/scenarios/${id}`);
    const { login: _login, ...s } = r;
    active.value = s;
    save(s);
    return r;
  }

  async function reset() {
    setDebugIp('');
    await api.post('/dev/reset');
    clear();
  }

  function clear() {
    active.value = null;
    save(null);
  }

  return { list, active, fetchList, run, reset, clear };
});
