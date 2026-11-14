<script setup lang="ts">
import { NCard, NDataTable, NDatePicker, type DataTableColumns } from 'naive-ui';
import { h, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Attendance } from '../api/types';
import Badges from '../components/Badges.vue';
import { useAppStore } from '../stores/app';
import { useClockStore } from '../stores/clock';
import { DAY_TYPE_LABEL, fmtMinutes, parts } from '../utils/format';

const app = useAppStore();
const clock = useClockStore();
const month = ref<string | null>(null);
const rows = ref<Attendance[]>([]);

async function load() {
  const q = month.value ? `?month=${month.value}` : '';
  const r = await api.get<{ month: string; items: Attendance[] }>(`/attendance/me${q}`);
  month.value = r.month;
  rows.value = r.items;
}
watch([() => app.refreshKey, month], load, { immediate: true });
watch(
  () => clock.nowMs,
  (ms) => {
    if (!month.value && ms) month.value = parts(ms).date.slice(0, 7);
  },
);

const columns: DataTableColumns<Attendance> = [
  { title: '근무일', key: 'workDate' },
  { title: '형태', key: 'dayType', render: (a) => DAY_TYPE_LABEL[a.dayType] },
  { title: '출근', key: 'checkInTime' },
  { title: '퇴근', key: 'checkOutTime', render: (a) => a.checkOutTime ?? '미기록' },
  { title: '점심 차감', key: 'lunchMinutes', render: (a) => (a.lunchMinutes === null ? '-' : `${a.lunchMinutes}분`) },
  { title: '근무시간', key: 'workMinutes', render: (a) => fmtMinutes(a.workMinutes) },
  { title: '판정', key: 'badges', render: (a) => h(Badges, { badges: a.badges }) },
];
</script>

<template>
  <div class="page">
    <NCard title="내 근태">
      <template #header-extra>
        <NDatePicker v-model:formatted-value="month" type="month" value-format="yyyy-MM" style="width: 140px" />
      </template>
      <NDataTable :columns="columns" :data="rows" size="small" :bordered="false" />
    </NCard>
  </div>
</template>
