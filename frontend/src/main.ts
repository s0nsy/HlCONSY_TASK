import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { onApiError } from './api/client';
import { router } from './router';
import { useAppStore } from './stores/app';
import { useAuthStore } from './stores/auth';
import './style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// 전역 오류 처리: IP 차단 → 차단 페이지, 세션 없음 → 로그인
onApiError((err) => {
  const store = useAppStore(pinia);
  if (err.status === 403 && err.code === 'IP_DENIED') {
    store.setBlocked({
      ip: err.body.details?.ip ?? '?',
      serverTime: err.body.details?.serverTime ?? '',
      message: err.body.message,
    });
    if (router.currentRoute.value.path !== '/blocked') void router.push('/blocked');
  } else if (err.status === 401 && err.code === 'AUTH_REQUIRED') {
    const auth = useAuthStore(pinia);
    auth.user = null;
    const cur = router.currentRoute.value;
    if (!cur.meta.public) void router.push({ path: '/login', query: { redirect: cur.fullPath } });
  }
});

app.mount('#app');
