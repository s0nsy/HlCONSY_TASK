<script setup lang="ts">
import { NCard, NDataTable, NDatePicker, type DataTableColumns } from 'naive-ui';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import { fmtMinutes } from '../utils/format';

interface Row {
  user: { id: number; name: string; role: string };
  workDays: number;
  holidayWorkDays: number;
  totalWorkMinutes: number;
  lateCount: number;
  earlyLeaveCount: number;
  manualCount: number;
  unrecordedCount: number;
  annualUsed: number;
  remoteUsed: number;
  offUsed: number;
  balance: { annual: number; remoteThisMonth: number; off: number };
}

/** FN-STL-01 월별 정산 (팀원: 본인, 리드: 팀 전체) */
const app = useAppStore();
const month = ref<string | null>(null);
const rows = ref<Row[]>([]);

async function load() {
  const r = await api.get<{ month: string; rows: Row[] }>(`/settlement${month.value ? `?month=${month.value}` : ''}`);
  month.value = r.month;
  rows.value = r.rows;
}
watch([() => app.refreshKey, month], load, { immediate: true });

const columns: DataTableColumns<Row> = [
  { title: '이름', key: 'name', render: (r) => r.user.name, fixed: 'left', width: 80 },
  { title: '근무일', key: 'workDays' },
  { title: '주말/공휴일 근무', key: 'holidayWorkDays' },
  { title: '총 근무시간', key: 'totalWorkMinutes', render: (r) => fmtMinutes(r.totalWorkMinutes) },
  { title: '지각', key: 'lateCount' },
  { title: '조퇴', key: 'earlyLeaveCount' },
  { title: '직접 입력', key: 'manualCount' },
  { title: '미기록', key: 'unrecordedCount' },
  { title: '연차 사용', key: 'annualUsed' },
  { title: '재택', key: 'remoteUsed' },
  { title: 'OFF 사용', key: 'offUsed' },
  { title: '연차 잔여', key: 'ba', render: (r) => r.balance.annual },
  { title: '재택 잔여(이번 달)', key: 'br', render: (r) => r.balance.remoteThisMonth },
  { title: 'OFF 잔여', key: 'bo', render: (r) => r.balance.off },
];
</script>

<template>
  <div class="page">
    <NCard title="월별 정산">
      <template #header-extra>
        <NDatePicker v-model:formatted-value="month" type="month" value-format="yyyy-MM" style="width: 140px" />
      </template>
      <NDataTable :columns="columns" :data="rows" size="small" :bordered="false" :scroll-x="1200" />
      <p class="muted" style="font-size: 12px">잔여는 현재 서버 시각 기준입니다. 연차·재택·OFF 사용 수는 해당 월의 승인 건입니다.</p>
    </NCard>
  </div>
</template>
