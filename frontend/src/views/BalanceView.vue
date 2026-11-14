<script setup lang="ts">
import { NCard, NDataTable, NSelect, NStatistic, NTag, type DataTableColumns } from 'naive-ui';
import { computed, h, ref, watch } from 'vue';
import { api } from '../api/client';
import type { BalanceSummary, LedgerItem, OffGrant, User } from '../api/types';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { fmtDateTime } from '../utils/format';

/** 잔여 + 원장 내역 (FN-BAL-01). 리드는 팀원별로 볼 수 있다. */
const app = useAppStore();
const auth = useAuthStore();
const users = ref<User[]>([]);
const selected = ref<number | null>(null);
const summary = ref<BalanceSummary | null>(null);
const history = ref<LedgerItem[]>([]);

async function load() {
  if (auth.isLead && users.value.length === 0) {
    users.value = (await api.get<{ items: User[] }>('/users')).items;
  }
  const url = auth.isLead && selected.value && selected.value !== auth.user?.id ? `/balance/users/${selected.value}` : '/balance/me';
  const r = await api.get<{ summary: BalanceSummary; history: LedgerItem[] }>(url);
  summary.value = r.summary;
  history.value = [...r.history].reverse();
}
watch([() => app.refreshKey, selected], load, { immediate: true });

const userOptions = computed(() => users.value.map((u) => ({ label: u.name, value: u.id })));

/** 만료 7일 이내 = 임박 */
function daysLeft(g: OffGrant): number {
  if (!summary.value) return 0;
  return Math.ceil((Date.parse(g.expiresAt) - Date.parse(summary.value.asOf)) / 86400000);
}

const grantColumns: DataTableColumns<OffGrant> = [
  { title: '지급(근무일)', key: 'grantDate' },
  { title: '만료', key: 'expiresAt', render: (g) => fmtDateTime(g.expiresAt) },
  { title: '잔여', key: 'remaining' },
  {
    title: '상태',
    key: 'state',
    render: (g) =>
      g.remaining <= 0
        ? h(NTag, { size: 'small' }, () => '사용됨')
        : g.expired
          ? h(NTag, { size: 'small', type: 'error' }, () => '만료')
          : daysLeft(g) <= 7
            ? h(NTag, { size: 'small', type: 'warning' }, () => `만료 임박 (D-${daysLeft(g)})`)
            : h(NTag, { size: 'small', type: 'success' }, () => `사용 가능 (D-${daysLeft(g)})`),
  },
];

const KIND: Record<string, string> = { ANNUAL: '연차', REMOTE: '재택', OFF: 'OFF' };
const ledgerColumns: DataTableColumns<LedgerItem> = [
  { title: '효력일', key: 'effectiveDate' },
  { title: '종류', key: 'kind', render: (r) => KIND[r.kind] },
  {
    title: '증감',
    key: 'delta',
    render: (r) => h('b', { style: `color:${r.delta > 0 ? '#18a058' : '#d03050'}` }, r.delta > 0 ? `+${r.delta}` : `${r.delta}`),
  },
  { title: '사유', key: 'reason' },
  { title: '기록 시각(서버)', key: 'occurredAt', render: (r) => (r.computed ? '계산값' : fmtDateTime(r.occurredAt)) },
];
</script>

<template>
  <div class="page">
    <div class="row" style="justify-content: space-between; margin-bottom: 12px">
      <h2 class="title" style="margin: 0">잔여</h2>
      <NSelect
        v-if="auth.isLead"
        v-model:value="selected"
        :options="userOptions"
        placeholder="팀원 선택 (기본: 나)"
        clearable
        style="width: 200px"
      />
    </div>
    <template v-if="summary">
      <div class="grid-2">
        <NCard title="연차">
          <NStatistic label="잔여" :value="summary.annual.remaining"><template #suffix>일</template></NStatistic>
          <div class="muted">적립 {{ summary.annual.accrued }} · 사용/예약 {{ summary.annual.used }} · 다음 적립 {{ summary.annual.nextAccrualDate }}</div>
        </NCard>
        <NCard title="재택 (월 2회, 이월 없음)">
          <div class="row" style="gap: 32px">
            <NStatistic :label="summary.remote.thisMonth.month" :value="summary.remote.thisMonth.remaining">
              <template #suffix>/ {{ summary.remote.thisMonth.limit }}</template>
            </NStatistic>
            <NStatistic :label="summary.remote.nextMonth.month" :value="summary.remote.nextMonth.remaining">
              <template #suffix>/ {{ summary.remote.nextMonth.limit }}</template>
            </NStatistic>
          </div>
        </NCard>
      </div>
      <NCard title="반일 OFF" style="margin-top: 16px">
        <template #header-extra>
          <span>사용 가능 <b>{{ summary.off.available }}</b>개</span>
        </template>
        <NDataTable :columns="grantColumns" :data="summary.off.grants" size="small" :bordered="false" />
      </NCard>
      <NCard title="원장 내역" style="margin-top: 16px">
        <NDataTable :columns="ledgerColumns" :data="history" size="small" :bordered="false" :pagination="{ pageSize: 20 }" />
      </NCard>
      <p class="muted" style="font-size: 12px">기준 시각(서버): {{ fmtDateTime(summary.asOf) }}</p>
    </template>
  </div>
</template>
