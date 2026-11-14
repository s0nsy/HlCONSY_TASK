<script setup lang="ts">
import { NButton, NCard, NDataTable, NDatePicker, NInput, NSelect, useMessage, type DataTableColumns } from 'naive-ui';
import { h, ref, watch } from 'vue';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';

interface Holiday {
  date: string;
  name: string;
}

/** C-2 공휴일 (리드: 추가·삭제) */
const app = useAppStore();
const auth = useAuthStore();
const message = useMessage();
const year = ref<string>('2026');
const rows = ref<Holiday[]>([]);
const date = ref<string | null>(null);
const name = ref('');

async function load() {
  rows.value = (await api.get<{ items: Holiday[] }>(`/holidays?year=${year.value}`)).items;
}
watch([() => app.refreshKey, year], load, { immediate: true });

async function add() {
  try {
    await api.post('/holidays', { date: date.value, name: name.value });
    message.success('추가했습니다');
    date.value = null;
    name.value = '';
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

async function remove(h: Holiday) {
  try {
    await api.del(`/holidays/${h.date}`);
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

const columns: DataTableColumns<Holiday> = [
  { title: '날짜', key: 'date' },
  { title: '이름', key: 'name' },
  {
    title: '',
    key: 'actions',
    render: (r) => (auth.isLead ? h(NButton, { size: 'tiny', quaternary: true, type: 'error', onClick: () => remove(r) }, () => '삭제') : null),
  },
];
</script>

<template>
  <div class="page">
    <NCard title="공휴일">
      <template #header-extra>
        <NSelect v-model:value="year" :options="['2026', '2027', '2028'].map((y) => ({ label: y, value: y }))" style="width: 100px" />
      </template>
      <div v-if="auth.isLead" class="row" style="margin-bottom: 12px">
        <NDatePicker v-model:formatted-value="date" type="date" value-format="yyyy-MM-dd" style="width: 160px" />
        <NInput v-model:value="name" placeholder="이름 (예: 임시공휴일)" style="width: 200px" />
        <NButton type="primary" :disabled="!date || !name.trim()" @click="add">추가</NButton>
      </div>
      <NDataTable :columns="columns" :data="rows" size="small" :bordered="false" />
    </NCard>
  </div>
</template>
