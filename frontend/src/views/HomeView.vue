<script setup lang="ts">
import { NCard, NDataTable, NEmpty, NSpin, NTag, type DataTableColumns } from 'naive-ui';
import { h, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Attendance, BoardEntry, MyCard, User } from '../api/types';
import Badges from '../components/Badges.vue';
import MyCardView from '../components/MyCard.vue';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { DAY_TYPE_LABEL, PLACE_LABEL, fmtMinutes } from '../utils/format';

type Member = BoardEntry & { user: Pick<User, 'id' | 'name' | 'role'> };

const auth = useAuthStore();
const app = useAppStore();
const card = ref<MyCard | null>(null);
const team = ref<Member[]>([]);
const missing = ref<{ unrecorded: Attendance[]; manual: Attendance[] }>({ unrecorded: [], manual: [] });
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const [c, m] = await Promise.all([
      api.get<MyCard>('/dashboard/me'),
      api.get<typeof missing.value>('/dashboard/missing'),
    ]);
    card.value = c;
    missing.value = m;
    if (auth.isLead) team.value = (await api.get<{ members: Member[] }>('/dashboard/team')).members;
  } finally {
    loading.value = false;
  }
}
watch(() => app.refreshKey, load, { immediate: true });

const STATUS_TYPE: Record<string, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
  ANNUAL: 'warning',
  DONE: 'success',
  WORKING: 'info',
  REMOTE_PLANNED: 'default',
  HOLIDAY_WORK_PLANNED: 'default',
  NOT_CHECKED_IN: 'default',
  DAY_OFF: 'default',
};

const teamColumns: DataTableColumns<Member> = [
  { title: '이름', key: 'name', render: (m) => `${m.user.name}${m.user.role === 'LEAD' ? ' (리드)' : ''}` },
  {
    title: '상태',
    key: 'status',
    render: (m) =>
      h('span', { class: 'row' }, [
        h(NTag, { type: m.lateRisk ? 'error' : STATUS_TYPE[m.status], size: 'small' }, () =>
          m.statusLabel + (m.lateRisk ? ' · 지각 위험' : ''),
        ),
        m.place && m.status === 'WORKING' ? h(NTag, { size: 'small', bordered: false }, () => PLACE_LABEL[m.place!]) : null,
        h(Badges, { badges: m.badges }),
      ]),
  },
  { title: '출근', key: 'in', render: (m) => m.attendance?.checkInTime ?? '-' },
  { title: '퇴근', key: 'out', render: (m) => m.attendance?.checkOutTime ?? '-' },
  { title: '근무', key: 'work', render: (m) => fmtMinutes(m.attendance?.workMinutes) },
];

const missingColumns: DataTableColumns<Attendance> = [
  { title: '근무일', key: 'workDate' },
  { title: '이름', key: 'userName' },
  { title: '형태', key: 'dayType', render: (a) => DAY_TYPE_LABEL[a.dayType] },
  { title: '출근', key: 'checkInTime' },
  { title: '퇴근', key: 'checkOutTime', render: (a) => a.checkOutTime ?? '미기록' },
  { title: '근무', key: 'workMinutes', render: (a) => fmtMinutes(a.workMinutes) },
  { title: '', key: 'badges', render: (a) => h(Badges, { badges: a.badges }) },
];
</script>

<template>
  <div class="page">
    <NSpin :show="loading && !card">
      <div class="grid-2">
        <MyCardView v-if="card" :card="card" @changed="load" />
        <NCard v-if="auth.isLead" title="팀 보드 (오늘)">
          <NDataTable :columns="teamColumns" :data="team" :bordered="false" size="small" />
        </NCard>
      </div>
      <NCard :title="auth.isLead ? '팀 미기록 · 직접 입력 건' : '내 미기록 · 직접 입력 건'" style="margin-top: 16px">
        <h4 style="margin-top: 0">퇴근 미기록</h4>
        <NDataTable v-if="missing.unrecorded.length" :columns="missingColumns" :data="missing.unrecorded" size="small" :bordered="false" />
        <NEmpty v-else description="없음" size="small" />
        <h4>직접 입력</h4>
        <NDataTable
          v-if="missing.manual.length"
          :columns="missingColumns"
          :data="missing.manual"
          size="small"
          :bordered="false"
          :pagination="{ pageSize: 10 }"
        />
        <NEmpty v-else description="없음" size="small" />
      </NCard>
    </NSpin>
  </div>
</template>
