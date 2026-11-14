import { defineStore } from 'pinia';
import { ref } from 'vue';

/** IP 차단 상태 + 데이터 새로고침 신호 (디버그 패널에서 시각/IP 를 바꾸면 화면을 다시 불러온다) */
export const useAppStore = defineStore('app', () => {
  const blocked = ref<{ ip: string; serverTime: string; message: string } | null>(null);
  const refreshKey = ref(0);

  function setBlocked(v: { ip: string; serverTime: string; message: string } | null) {
    blocked.value = v;
  }
  function refresh() {
    refreshKey.value++;
  }
  return { blocked, refreshKey, setBlocked, refresh };
});
