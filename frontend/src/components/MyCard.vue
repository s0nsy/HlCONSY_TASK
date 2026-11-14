<script setup lang="ts">
import { NAlert, NButton, NCard, NStatistic, NTag, NTooltip, useMessage } from 'naive-ui';
import { ref } from 'vue';
import { ApiError, api } from '../api/client';
import type { MyCard } from '../api/types';
import { PLACE_LABEL, fmtMinutes } from '../utils/format';
import Badges from './Badges.vue';
import PendingCheckoutModal from './PendingCheckoutModal.vue';

/** FN-DSH-02 내 카드. 버튼 활성/비활성은 서버가 준 canCheckIn/canCheckOut 으로만 정한다. */
const props = defineProps<{ card: MyCard }>();
const emit = defineEmits<{ (e: 'changed'): void }>();
const message = useMessage();

const loading = ref(false);
const showModal = ref(false);
const modalError = ref<string | null>(null);

async function checkIn() {
  if (props.card.pendingCheckouts.length > 0) {
    modalError.value = null;
    showModal.value = true;
    return;
  }
  await doCheckIn([]);
}

async function doCheckIn(manualCheckouts: { attendanceId: number; checkOutTime: string }[]) {
  loading.value = true;
  try {
    const res = await api.post<{ attendance: { isLate: boolean; checkInTime: string } }>('/attendance/check-in', {
      manualCheckouts,
    });
    showModal.value = false;
    message.success(`출근 ${res.attendance.checkInTime}${res.attendance.isLate ? ' (지각)' : ''}`);
    emit('changed');
  } catch (e) {
    if (e instanceof ApiError && e.code === 'ATT_PENDING_CHECKOUT_REQUIRED') {
      showModal.value = true;
      emit('changed');
    } else if (showModal.value) {
      const d = (e as ApiError).body?.details;
      modalError.value = `${(e as Error).message}${d?.workDate ? ` (${d.workDate}: ${d.causeMessage ?? ''})` : ''}`;
    } else {
      message.error((e as Error).message);
    }
  } finally {
    loading.value = false;
  }
}

async function checkOut() {
  loading.value = true;
  try {
    const res = await api.post<{ attendance: { workMinutes: number; isEarlyLeave: boolean; checkOutTime: string } }>(
      '/attendance/check-out',
    );
    const a = res.attendance;
    message.success(`퇴근 ${a.checkOutTime} · 근무 ${fmtMinutes(a.workMinutes)}${a.isEarlyLeave ? ' (조퇴)' : ''}`);
    emit('changed');
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NCard title="내 카드">
    <template #header-extra>
      <span class="muted">{{ card.day.date }}{{ card.day.holidayName ? ` · ${card.day.holidayName}` : card.day.weekend ? ' · 주말' : '' }}</span>
    </template>
    <div class="row" style="margin-bottom: 12px">
      <NTag :type="card.status === 'DONE' ? 'success' : card.status === 'WORKING' ? 'info' : card.lateRisk ? 'error' : 'default'" size="large">
        {{ card.statusLabel }}{{ card.lateRisk ? ' · 지각 위험' : '' }}
      </NTag>
      <NTag v-if="card.place" size="small" :bordered="false">{{ PLACE_LABEL[card.place] }}</NTag>
      <Badges :badges="card.badges" />
    </div>

    <div class="stats">
      <NStatistic label="출근">
        <span class="mono">{{ card.attendance?.checkInTime ?? '-' }}</span>
      </NStatistic>
      <NStatistic label="퇴근">
        <span class="mono">{{ card.attendance?.checkOutTime ?? '-' }}</span>
      </NStatistic>
      <NStatistic label="근무시간">
        <span>{{ fmtMinutes(card.attendance?.workMinutes) }}</span>
      </NStatistic>
    </div>

    <div class="row" style="margin: 16px 0">
      <NTooltip :disabled="card.canCheckIn">
        <template #trigger>
          <span>
            <NButton type="primary" size="large" :disabled="!card.canCheckIn" :loading="loading" @click="checkIn">출근</NButton>
          </span>
        </template>
        {{ card.checkInReason }}
      </NTooltip>
      <NTooltip :disabled="card.canCheckOut">
        <template #trigger>
          <span>
            <NButton size="large" :disabled="!card.canCheckOut" :loading="loading" @click="checkOut">퇴근</NButton>
          </span>
        </template>
        {{ card.checkOutReason }}
      </NTooltip>
      <span class="muted" style="font-size: 12px">
        {{ !card.canCheckIn && !card.attendance ? card.checkInReason : !card.canCheckOut && card.attendance && !card.attendance.checkOutAt ? card.checkOutReason : '' }}
      </span>
    </div>

    <NAlert v-if="card.pendingCheckouts.length" type="warning" :show-icon="false" style="margin-bottom: 12px">
      퇴근 미기록 {{ card.pendingCheckouts.length }}건 — 다음 출근 때 퇴근 시각을 입력해야 합니다.
    </NAlert>

    <div class="stats">
      <NStatistic label="연차 잔여" :value="card.balance.annual.remaining">
        <template #suffix>일</template>
      </NStatistic>
      <NStatistic :label="`재택 잔여 (${card.balance.remote.thisMonth.month})`" :value="card.balance.remote.thisMonth.remaining">
        <template #suffix>/ {{ card.balance.remote.thisMonth.limit }}회</template>
      </NStatistic>
      <NStatistic label="OFF 잔여" :value="card.balance.off.available">
        <template #suffix>개</template>
      </NStatistic>
    </div>
    <div class="muted" style="font-size: 12px; margin-top: 8px">
      접속 IP <span class="mono">{{ card.clientIp }}</span>
      <template v-if="card.requests.remote"> · 재택 {{ card.requests.remote.ip }} {{ card.requests.remote.startTime }}~{{ card.requests.remote.endTime }}</template>
      <template v-if="card.requests.holidayWork">
        · 주말 근무 {{ card.requests.holidayWork.ip }} {{ card.requests.holidayWork.startTime }}~{{ card.requests.holidayWork.endTime }}
      </template>
      <template v-if="card.requests.off"> · 반일 OFF({{ card.requests.off.offHalf === 'AM' ? '오전' : '오후' }})</template>
    </div>

    <PendingCheckoutModal
      v-model:show="showModal"
      :items="card.pendingCheckouts"
      :loading="loading"
      :error="modalError"
      @submit="doCheckIn"
    />
  </NCard>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
</style>
