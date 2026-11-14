<script setup lang="ts">
import { NCard, NDataTable, NDatePicker, NPagination, NSelect, NTag, type DataTableColumns } from 'naive-ui';
import { computed, h, ref, watch } from 'vue';
import { api } from '../api/client';
import type { AuditLog, User } from '../api/types';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { fmtDateTime } from '../utils/format';

/** FN-LOG-01 이력. 리드: 전체 + 사용자·기간·액션 필터 / 팀원: 본인만 */
const app = useAppStore();
const auth = useAuthStore();
const users = ref<User[]>([]);
const actions = ref<string[]>([]);
const userId = ref<number | null>(null);
const action = ref<string | null>(null);
const range = ref<[string, string] | null>(null);
const page = ref(1);
const size = 50;
const items = ref<AuditLog[]>([]);
const total = ref(0);

async function loadMeta() {
  users.value = (await api.get<{ items: User[] }>('/users')).items;
  actions.value = (await api.get<{ items: string[] }>('/audit-logs/actions')).items;
}

async function load() {
  const q = new URLSearchParams({ page: String(page.value), size: String(size) });
  if (auth.isLead && userId.value) q.set('userId', String(userId.value));
  if (action.value) q.set('action', action.value);
  if (range.value) {
    q.set('from', range.value[0]);
    q.set('to', range.value[1]);
  }
  const r = await api.get<{ items: AuditLog[]; total: number }>(`/audit-logs?${q}`);
  items.value = r.items;
  total.value = r.total;
}

watch(() => app.refreshKey, async () => {
  await loadMeta();
  await load();
}, { immediate: true });
watch([userId, action, range], () => {
  page.value = 1;
  void load();
});
watch(page, load);

const userName = computed(() => new Map(users.value.map((u) => [u.id, u.name])));

const columns: DataTableColumns<AuditLog> = [
  { title: '#', key: 'id', width: 70 },
  { title: '서버 시각', key: 'serverTime', render: (r) => fmtDateTime(r.serverTime), width: 170 },
  { title: '실제 시각', key: 'realTime', render: (r) => fmtDateTime(r.realTime), width: 170 },
  { title: '사용자', key: 'userId', render: (r) => (r.userId ? (userName.value.get(r.userId) ?? r.userId) : '-'), width: 80 },
  { title: '액션', key: 'action', width: 160 },
  { title: '요청', key: 'path', render: (r) => `${r.method} ${r.path}`, ellipsis: { tooltip: true } },
  { title: 'IP', key: 'ip', width: 120 },
  {
    title: '결과',
    key: 'result',
    width: 170,
    render: (r) =>
      h('span', {}, [
        h(NTag, { size: 'small', type: r.result === 'SUCCESS' ? 'success' : 'error' }, () => `${r.result} ${r.statusCode}`),
        r.errorCode ? h('span', { class: 'muted', style: 'font-size:12px;margin-left:4px' }, r.errorCode) : null,
      ]),
  },
  { title: '본문', key: 'body', ellipsis: { tooltip: true }, width: 200 },
];
</script>

<template>
  <div class="page">
    <NCard :title="auth.isLead ? '전체 이력' : '내 이력'">
      <div class="row" style="margin-bottom: 12px">
        <NSelect
          v-if="auth.isLead"
          v-model:value="userId"
          :options="users.map((u) => ({ label: u.name, value: u.id }))"
          placeholder="사용자"
          clearable
          style="width: 140px"
        />
        <NSelect
          v-model:value="action"
          :options="actions.map((a) => ({ label: a, value: a }))"
          placeholder="액션"
          clearable
          filterable
          style="width: 220px"
        />
        <NDatePicker v-model:formatted-value="range" type="daterange" value-format="yyyy-MM-dd" clearable />
        <span class="muted">총 {{ total }}건</span>
      </div>
      <NDataTable :columns="columns" :data="items" size="small" :bordered="false" :scroll-x="1300" />
      <div class="row" style="justify-content: flex-end; margin-top: 12px">
        <NPagination v-model:page="page" :page-size="size" :item-count="total" />
      </div>
    </NCard>
  </div>
</template>
