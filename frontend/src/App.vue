<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NButton,
  NMenu,
  NTag,
  darkTheme,
  dateKoKR,
  koKR,
  useOsTheme,
  type MenuOption,
} from 'naive-ui';
import { computed, h, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import DebugPanel from './components/DebugPanel.vue';
import { useAuthStore } from './stores/auth';
import { useClockStore } from './stores/clock';

const auth = useAuthStore();
const clock = useClockStore();
const route = useRoute();
const router = useRouter();
const osTheme = useOsTheme();
const theme = computed(() => (osTheme.value === 'dark' ? darkTheme : null));
const isDev = import.meta.env.DEV;

onMounted(() => clock.start());

const link = (to: string, label: string) => () => h(RouterLink, { to }, { default: () => label });

/** FR-SYS-02 역할별 메뉴 */
const menu = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [
    { key: '/', label: link('/', auth.isLead ? '팀 현황' : '홈') },
    { key: '/attendance', label: link('/attendance', '내 근태') },
    { key: '/requests/new', label: link('/requests/new', '신청') },
    { key: '/requests', label: link('/requests', '내 신청') },
  ];
  if (auth.isLead) items.push({ key: '/approvals', label: link('/approvals', '승인함') });
  items.push(
    { key: '/balance', label: link('/balance', '잔여') },
    { key: '/settlement', label: link('/settlement', '월별 정산') },
    { key: '/audit', label: link('/audit', '이력') },
    { key: '/holidays', label: link('/holidays', '공휴일') },
  );
  return items;
});

const showChrome = computed(() => !!auth.user && !route.meta.public);

async function logout() {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <NConfigProvider :theme="theme" :locale="koKR" :date-locale="dateKoKR">
    <NMessageProvider>
      <NDialogProvider>
        <header class="header">
          <div class="header-inner">
            <strong class="brand">hiconcy 근태</strong>
            <NMenu v-if="showChrome" mode="horizontal" :options="menu" :value="route.path" class="nav" responsive />
            <div class="right">
              <span class="server-clock mono" title="서버 기준 현재 시각 (Asia/Seoul)">
                🕒 {{ clock.display }}
                <NTag v-if="clock.mode !== 'real'" size="small" type="warning" :bordered="false">
                  {{ clock.mode === 'fixed' ? '고정' : '오프셋' }}
                </NTag>
              </span>
              <template v-if="showChrome">
                <NTag size="small" :type="auth.isLead ? 'success' : 'default'">
                  {{ auth.user?.name }} · {{ auth.isLead ? '리드' : '팀원' }}
                </NTag>
                <NButton size="small" quaternary @click="logout">로그아웃</NButton>
              </template>
            </div>
          </div>
        </header>
        <RouterView />
        <DebugPanel v-if="isDev" />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.header {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  flex-wrap: wrap;
}
.brand {
  white-space: nowrap;
}
.nav {
  flex: 1;
  min-width: 0;
}
.right {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
  flex-wrap: wrap;
}
.server-clock {
  font-size: 13px;
  white-space: nowrap;
}
</style>
