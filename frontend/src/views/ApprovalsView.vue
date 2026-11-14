<script setup lang="ts">
import {
  NButton,
  NCard,
  NDataTable,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { h, ref, watch } from 'vue';
import { api } from '../api/client';
import type { WorkRequest } from '../api/types';
import { useAppStore } from '../stores/app';
import { STATUS_LABEL, STATUS_TAG, TYPE_LABEL, fmtDateTime } from '../utils/format';

/** FN-REQ-02 승인함 (리드) */
const app = useAppStore();
const message = useMessage();
const status = ref<string>('PENDING');
const rows = ref<WorkRequest[]>([]);
const rejecting = ref<WorkRequest | null>(null);
const rejectReason = ref('');

async function load() {
  const q = status.value === 'ALL' ? '' : `?status=${status.value}`;
  rows.value = (await api.get<{ items: WorkRequest[] }>(`/requests${q}`)).items;
}
watch([() => app.refreshKey, status], load, { immediate: true });

async function approve(r: WorkRequest) {
  try {
    await api.post(`/requests/${r.id}/approve`);
    message.success(`#${r.id} 승인`);
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

async function reject() {
  if (!rejecting.value) return;
  try {
    await api.post(`/requests/${rejecting.value.id}/reject`, { reason: rejectReason.value });
    message.success(`#${rejecting.value.id} 반려`);
    rejecting.value = null;
    rejectReason.value = '';
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

async function pdf(r: WorkRequest) {
  await api.download(`/requests/${r.id}/pdf`, `신청서-${r.id}.pdf`);
}

const columns: DataTableColumns<WorkRequest> = [
  { title: '#', key: 'id', width: 60 },
  { title: '신청자', key: 'userName' },
  { title: '사용일', key: 'targetDate' },
  { title: '종류', key: 'type', render: (r) => TYPE_LABEL[r.type] },
  {
    title: '내용',
    key: 'detail',
    render: (r) =>
      r.type === 'REMOTE' || r.type === 'HOLIDAY_WORK'
        ? `${r.ip} · ${r.startTime}~${r.endTime}`
        : r.type === 'OFF'
          ? (r.offHalf === 'AM' ? '오전' : '오후')
          : '',
  },
  { title: '사유', key: 'reason', ellipsis: { tooltip: true } },
  { title: '상태', key: 'status', render: (r) => h(NTag, { type: STATUS_TAG[r.status], size: 'small' }, () => STATUS_LABEL[r.status]) },
  { title: '신청 시각', key: 'createdAt', render: (r) => fmtDateTime(r.createdAt) },
  {
    title: '',
    key: 'actions',
    render: (r) =>
      h('span', { class: 'row' }, [
        r.status === 'PENDING'
          ? [
              h(NButton, { size: 'tiny', type: 'primary', onClick: () => approve(r) }, () => '승인'),
              h(NButton, { size: 'tiny', type: 'error', secondary: true, onClick: () => (rejecting.value = r) }, () => '반려'),
            ]
          : null,
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => pdf(r) }, () => 'PDF'),
      ]),
  },
];
</script>

<template>
  <div class="page">
    <NCard title="승인함">
      <template #header-extra>
        <NRadioGroup v-model:value="status" size="small">
          <NRadioButton value="PENDING">대기</NRadioButton>
          <NRadioButton value="APPROVED">승인</NRadioButton>
          <NRadioButton value="REJECTED">반려</NRadioButton>
          <NRadioButton value="ALL">전체</NRadioButton>
        </NRadioGroup>
      </template>
      <NDataTable :columns="columns" :data="rows" size="small" :bordered="false" :scroll-x="900" :pagination="{ pageSize: 20 }" />
    </NCard>
    <NModal :show="!!rejecting" preset="card" title="반려 사유" style="width: 420px; max-width: calc(100vw - 32px)" @update:show="rejecting = null">
      <NInput v-model:value="rejectReason" type="textarea" placeholder="반려 사유를 입력하세요" />
      <template #footer>
        <div class="row" style="justify-content: flex-end">
          <NButton @click="rejecting = null">닫기</NButton>
          <NButton type="error" :disabled="!rejectReason.trim()" @click="reject">반려</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
