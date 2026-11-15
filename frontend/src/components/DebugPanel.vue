<script setup lang="ts">
import {
  NButton,
  NCard,
  NDatePicker,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError, api, getDebugIp, setDebugIp } from '../api/client';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { useClockStore } from '../stores/clock';
import { useScenarioStore } from '../stores/scenario';
import { parts } from '../utils/format';

/**
 * 개발 모드 디버그 패널 (4.2, 4.3): 9장 시나리오 원클릭 재현 + 서버 시각 변경 + IP 위장.
 * 서버 시각 조작은 백엔드 ENABLE_TIME_TRAVEL=true 일 때만 동작한다.
 */
const clock = useClockStore();
const app = useAppStore();
const auth = useAuthStore();
const scenario = useScenarioStore();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();

// 진행 중인 시나리오가 있으면 새로고침해도 가이드가 보이게 열어 둔다
const open = ref(!!scenario.active);
const available = ref<boolean | null>(null);
const at = ref<string | null>(null);
const mode = ref<'fixed' | 'offset'>('offset');
const ip = ref(getDebugIp());
const busy = ref(false);
const picked = ref<string | null>(scenario.active?.id ?? null);
const scenarioOptions = computed(() => scenario.list.map((s) => ({ label: `${s.id} ${s.title}`, value: s.id })));

onMounted(async () => {
  try {
    await api.get('/dev/clock');
    available.value = true;
    await scenario.fetchList();
  } catch (e) {
    available.value = e instanceof ApiError && e.code === 'IP_DENIED' ? true : false;
  }
});

function fillNow() {
  if (clock.nowMs === null) return;
  const p = parts(clock.nowMs);
  at.value = `${p.date} ${p.time}`;
}

async function afterChange() {
  await clock.sync();
  app.setBlocked(null);
  await auth.load();
  app.refresh();
  if (router.currentRoute.value.path === '/blocked') await router.push('/');
}

async function applyClock() {
  if (!at.value) return message.warning('날짜·시간을 고르세요');
  busy.value = true;
  try {
    // 타임존 없이 보내면 서버가 Asia/Seoul 로 해석한다
    await api.put('/dev/clock', { mode: mode.value, at: at.value.replace(' ', 'T') });
    message.success(`서버 시각을 ${at.value} 로 설정 (${mode.value === 'fixed' ? '고정' : '흐름'})`);
    await afterChange();
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function resetClock() {
  busy.value = true;
  try {
    await api.put('/dev/clock', { mode: 'real' });
    message.success('실시간으로 되돌렸습니다');
    await afterChange();
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    busy.value = false;
  }
}

/** 9장 시나리오: 데이터 초기화 → 준비 상태 → IP 위장 → 자동 로그인 → 화면 이동 */
function runScenario() {
  if (!picked.value) return message.warning('시나리오를 고르세요');
  const id = picked.value;
  dialog.warning({
    title: `${id} 재현`,
    content: '근태·신청·잔여 데이터를 지우고 이 시나리오의 준비 상태로 바꿉니다. (계정·공휴일·이력은 유지)',
    positiveText: '재현',
    negativeText: '취소',
    onPositiveClick: async () => {
      busy.value = true;
      try {
        const r = await scenario.run(id);
        callResults.value = {};
        await auth.logout().catch(() => undefined);
        setDebugIp(r.ip);
        ip.value = r.ip;
        app.setBlocked(null);
        try {
          await auth.login(r.login.loginId, r.login.password);
        } catch (e) {
          // T-14 처럼 접속 자체가 막히는 시나리오는 전역 처리기가 차단 페이지로 보낸다
          if (!(e instanceof ApiError && e.code === 'IP_DENIED')) throw e;
        }
        await clock.sync();
        app.refresh();
        if (!app.blocked) await router.push(r.route);
        message.success(`${id} 준비 완료 — ${r.loginAs} 로 로그인했습니다`);
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        busy.value = false;
      }
    },
  });
}

/** 화면으로는 안 보이는 결과(예: 403)를 확인하려고 API 를 직접 호출. 단계 번호별 결과 */
const callResults = ref<Record<number, { ok: boolean; text: string }>>({});
async function callApi(i: number, path: string) {
  try {
    await api.get(path);
    callResults.value[i] = { ok: true, text: '200 OK' };
  } catch (e) {
    callResults.value[i] =
      e instanceof ApiError ? { ok: false, text: `${e.status} ${e.code}` } : { ok: false, text: (e as Error).message };
  }
}

/** 시나리오의 다음 단계 시각으로 이동 (고정) */
async function jumpTo(target: string) {
  busy.value = true;
  try {
    await api.put('/dev/clock', { mode: 'fixed', at: target.replace(' ', 'T') });
    message.success(`서버 시각 ${target}`);
    await afterChange();
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    busy.value = false;
  }
}

function resetAll() {
  dialog.warning({
    title: '데이터 초기화',
    content: '근태·신청·잔여 데이터를 지우고 서버 시각·IP 위장을 실시간/해제로 되돌립니다. (계정·공휴일·이력은 유지)',
    positiveText: '초기화',
    negativeText: '취소',
    onPositiveClick: async () => {
      busy.value = true;
      try {
        await scenario.reset();
        ip.value = '';
        picked.value = null;
        message.success('초기화했습니다');
        await afterChange();
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        busy.value = false;
      }
    },
  });
}

async function applyIp() {
  setDebugIp(ip.value.trim());
  message.info(ip.value.trim() ? `내 IP를 ${ip.value.trim()} 로 가정` : 'IP 위장 해제');
  await afterChange();
}

async function clearIp() {
  ip.value = '';
  await applyIp();
}
</script>

<template>
  <div class="debug">
    <NButton v-if="!open" size="small" type="warning" secondary @click="open = true">
      🛠 디버그<template v-if="scenario.active"> · {{ scenario.active.id }}</template>
    </NButton>
    <NCard v-else size="small" title="디버그 패널 (개발 모드)" closable @close="open = false" class="card">
      <div v-if="available" class="section">
        <div class="label">9장 시나리오 재현</div>
        <div class="row">
          <NSelect
            v-model:value="picked"
            :options="scenarioOptions"
            size="small"
            filterable
            placeholder="시나리오 선택 (T-01 ~ T-21)"
            style="flex: 1; min-width: 0"
          />
          <NButton size="small" type="primary" :loading="busy" :disabled="!picked" @click="runScenario">재현</NButton>
        </div>
        <div v-if="scenario.active" class="guide">
          <div class="guide-head">
            <b>{{ scenario.active.id }} {{ scenario.active.title }}</b>
            <NButton size="tiny" quaternary @click="scenario.clear()">닫기</NButton>
          </div>
          <div class="muted small">
            준비: <span class="mono">{{ scenario.active.clock }}</span> · {{ scenario.active.loginAs }}
            <template v-if="scenario.active.ip"> · IP <span class="mono">{{ scenario.active.ip }}</span></template>
          </div>
          <ol class="steps">
            <li v-for="(s, i) in scenario.active.steps" :key="i">
              {{ s.text }}
              <NButton v-if="s.at" size="tiny" secondary :loading="busy" @click="jumpTo(s.at)">
                {{ s.at.slice(5) }} 로 이동
              </NButton>
              <template v-if="s.call">
                <NButton size="tiny" secondary @click="callApi(i, s.call)">GET /api{{ s.call }}</NButton>
                <NTag v-if="callResults[i]" size="tiny" :type="callResults[i].ok ? 'success' : 'error'" :bordered="false">
                  {{ callResults[i].text }}
                </NTag>
              </template>
            </li>
          </ol>
          <div class="expected"><b>기대 결과</b> {{ scenario.active.expected }}</div>
        </div>
        <NButton size="tiny" quaternary style="margin-top: 6px" :loading="busy" @click="resetAll">
          데이터 초기화 (근태·신청·잔여)
        </NButton>
      </div>
      <div class="section">
        <div class="label">
          서버 시각 <NTag size="tiny" :bordered="false">{{ clock.mode }}</NTag>
        </div>
        <div class="mono now">{{ clock.display }}</div>
        <template v-if="available">
          <NDatePicker
            v-model:formatted-value="at"
            type="datetime"
            value-format="yyyy-MM-dd HH:mm:ss"
            placeholder="날짜·시간 선택 (서울)"
            clearable
            size="small"
            style="width: 100%"
          />
          <div class="row" style="margin-top: 6px">
            <NRadioGroup v-model:value="mode" size="small">
              <NRadioButton value="offset">흐르게</NRadioButton>
              <NRadioButton value="fixed">고정</NRadioButton>
            </NRadioGroup>
            <NButton size="tiny" quaternary @click="fillNow">현재값</NButton>
          </div>
          <div class="row" style="margin-top: 6px">
            <NButton size="small" type="primary" :loading="busy" @click="applyClock">서버 시각 변경</NButton>
            <NButton size="small" :loading="busy" @click="resetClock">실시간으로 되돌리기</NButton>
          </div>
        </template>
        <div v-else-if="available === false" class="muted small">
          백엔드 ENABLE_TIME_TRAVEL=true 일 때만 시각을 바꿀 수 있습니다.
        </div>
      </div>
      <div class="section">
        <div class="label">IP 위장 (X-Debug-Client-IP)</div>
        <div class="muted small">서버가 본 내 IP: <span class="mono">{{ clock.clientIp || '-' }}</span></div>
        <div class="row" style="margin-top: 6px">
          <NInput v-model:value="ip" size="small" placeholder="내 IP를 ___로 가정 (예: 10.0.0.5)" style="flex: 1" @keyup.enter="applyIp" />
          <NButton size="small" @click="applyIp">적용</NButton>
          <NButton size="small" quaternary @click="clearIp">해제</NButton>
        </div>
        <div class="muted small">백엔드 ENABLE_IP_OVERRIDE=true 일 때만 반영됩니다.</div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.debug {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 100;
  max-width: calc(100vw - 32px);
}
.card {
  width: 340px;
  max-width: 100%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.section + .section {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.label {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}
.now {
  font-size: 15px;
  margin-bottom: 6px;
}
.small {
  font-size: 12px;
  margin-top: 4px;
}
.guide {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
}
.guide-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.steps {
  margin: 6px 0;
  padding-left: 18px;
}
.steps li + li {
  margin-top: 4px;
}
.expected {
  font-size: 12px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}
.card {
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}
</style>
