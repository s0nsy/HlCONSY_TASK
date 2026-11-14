<script setup lang="ts">
import { NButton, NCard, NDatePicker, NInput, NRadioButton, NRadioGroup, NTag, useMessage } from 'naive-ui';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError, api, getDebugIp, setDebugIp } from '../api/client';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { useClockStore } from '../stores/clock';
import { parts } from '../utils/format';

/**
 * 개발 모드 디버그 패널 (4.2, 4.3): 서버 시각 변경 + IP 위장.
 * 서버 시각 조작은 백엔드 ENABLE_TIME_TRAVEL=true 일 때만 동작한다.
 */
const clock = useClockStore();
const app = useAppStore();
const auth = useAuthStore();
const router = useRouter();
const message = useMessage();

const open = ref(false);
const available = ref<boolean | null>(null);
const at = ref<string | null>(null);
const mode = ref<'fixed' | 'offset'>('offset');
const ip = ref(getDebugIp());
const busy = ref(false);

onMounted(async () => {
  try {
    await api.get('/dev/clock');
    available.value = true;
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
    <NButton v-if="!open" size="small" type="warning" secondary @click="open = true">🛠 디버그</NButton>
    <NCard v-else size="small" title="디버그 패널 (개발 모드)" closable @close="open = false" class="card">
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
</style>
