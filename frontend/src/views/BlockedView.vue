<script setup lang="ts">
import { NButton, NResult } from 'naive-ui';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { fmtDateTime } from '../utils/format';

/** IP 차단 안내 페이지 (FR-SYS-01) */
const app = useAppStore();
const auth = useAuthStore();
const router = useRouter();

async function retry() {
  try {
    await api.get('/clock');
    app.setBlocked(null);
    await auth.load();
    await router.push('/');
  } catch {
    /* 여전히 차단 — 전역 처리기가 상태를 갱신한다 */
  }
}
</script>

<template>
  <div class="page">
    <NResult status="403" title="허용되지 않은 IP입니다" style="margin-top: 60px">
      <template #footer>
        <div style="line-height: 1.9">
          <div>접속 IP: <b class="mono">{{ app.blocked?.ip ?? '-' }}</b></div>
          <div>서버 시각: <b class="mono">{{ fmtDateTime(app.blocked?.serverTime) }}</b></div>
          <p class="muted">
            연구실 IP에서 접속하거나, 승인된 재택·주말/공휴일 근무 신청의 IP·시간대 안에서 접속해 주세요.<br />
            로그인한 상태라면 그 신청이 <b>본인 것</b>이어야 합니다.
          </p>
          <NButton type="primary" @click="retry">다시 시도</NButton>
        </div>
      </template>
    </NResult>
  </div>
</template>
