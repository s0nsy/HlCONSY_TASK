<script setup lang="ts">
import { NButton, NCard, NDataTable, NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui';
import { h, ref, watch } from 'vue';
import { api } from '../api/client';
import type { WorkRequest } from '../api/types';
import { useAppStore } from '../stores/app';
import { STATUS_LABEL, STATUS_TAG, TYPE_LABEL, fmtDateTime } from '../utils/format';

const app = useAppStore();
const message = useMessage();
const dialog = useDialog();
const rows = ref<WorkRequest[]>([]);

async function load() {
  rows.value = (await api.get<{ items: WorkRequest[] }>('/requests/me')).items;
}
watch(() => app.refreshKey, load, { immediate: true });

function cancel(r: WorkRequest) {
  dialog.warning({
    title: '신청 취소',
    content: `${r.targetDate} ${TYPE_LABEL[r.type]} 신청을 취소할까요?`,
    positiveText: '취소하기',
    negativeText: '닫기',
    onPositiveClick: async () => {
      try {
        await api.post(`/requests/${r.id}/cancel`);
        message.success('취소했습니다');
        await load();
      } catch (e) {
        message.error((e as Error).message);
      }
    },
  });
}

async function pdf(r: WorkRequest) {
  try {
    await api.download(`/requests/${r.id}/pdf`, `신청서-${r.id}.pdf`);
  } catch (e) {
    message.error((e as Error).message);
  }
}

function detail(r: WorkRequest): string {
  if (r.type === 'REMOTE' || r.type === 'HOLIDAY_WORK') return `${r.ip} · ${r.startTime}~${r.endTime}`;
  if (r.type === 'OFF') return r.offHalf === 'AM' ? '오전' : '오후';
  return '';
}

const columns: DataTableColumns<WorkRequest> = [
  { title: '#', key: 'id', width: 60 },
  { title: '사용일', key: 'targetDate' },
  { title: '종류', key: 'type', render: (r) => TYPE_LABEL[r.type] },
  { title: '내용', key: 'detail', render: detail },
  { title: '사유', key: 'reason', ellipsis: { tooltip: true } },
  {
    title: '상태',
    key: 'status',
    render: (r) =>
      h('span', {}, [
        h(NTag, { type: STATUS_TAG[r.status], size: 'small' }, () => STATUS_LABEL[r.status]),
        r.rejectReason ? h('div', { class: 'muted', style: 'font-size:12px' }, `반려 사유: ${r.rejectReason}`) : null,
      ]),
  },
  { title: '신청 시각', key: 'createdAt', render: (r) => fmtDateTime(r.createdAt) },
  { title: '마감', key: 'deadlineLabel' },
  {
    title: '',
    key: 'actions',
    render: (r) =>
      h('span', { class: 'row' }, [
        r.cancelable ? h(NButton, { size: 'tiny', onClick: () => cancel(r) }, () => '취소') : null,
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => pdf(r) }, () => 'PDF'),
      ]),
  },
];
</script>

<template>
  <div class="page">
    <NCard title="내 신청 목록">
      <NDataTable :columns="columns" :data="rows" size="small" :bordered="false" :scroll-x="900" :pagination="{ pageSize: 20 }" />
    </NCard>
  </div>
</template>
