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
} from "naive-ui";
import { computed, h, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import DebugPanel from "./components/DebugPanel.vue";
import { useAuthStore } from "./stores/auth";
import { useClockStore } from "./stores/clock";

const auth = useAuthStore();
const clock = useClockStore();
const route = useRoute();
const router = useRouter();
const osTheme = useOsTheme();
const theme = computed(() => (osTheme.value === "dark" ? darkTheme : null));
const isDev = import.meta.env.DEV;
const logoFailed = ref(false);

onMounted(() => clock.start());

const link = (to: string, label: string) => () =>
  h(RouterLink, { to }, { default: () => label });

/** FR-SYS-02 역할별 메뉴 */
const menu = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [
    { key: "/", label: link("/", auth.isLead ? "팀 현황" : "홈") },
    { key: "/attendance", label: link("/attendance", "내 근무") },
    { key: "/requests/new", label: link("/requests/new", "신청") },
    { key: "/requests", label: link("/requests", "내 신청") },
  ];
  if (auth.isLead)
    items.push({ key: "/approvals", label: link("/approvals", "승인함") });
  items.push(
    { key: "/balance", label: link("/balance", "잔여") },
    { key: "/settlement", label: link("/settlement", "월별 정산") },
    { key: "/audit", label: link("/audit", "이력") },
    { key: "/holidays", label: link("/holidays", "공휴일") },
  );
  return items;
});

const showChrome = computed(() => !!auth.user && !route.meta.public);

async function logout() {
  await auth.logout();
  await router.push("/login");
}
</script>

<template>
  <NConfigProvider :theme="theme" :locale="koKR" :date-locale="dateKoKR">
    <NMessageProvider>
      <NDialogProvider>
        <header class="header">
          <div class="header-inner">
            <div class="header-top">
              <RouterLink to="/" class="brand" aria-label="hiconsy 근무 관리">
                <img
                  v-if="!logoFailed"
                  src="/logo.png"
                  alt="hiconsy"
                  class="brand-logo"
                  @error="logoFailed = true"
                />
                <strong v-else>hiconsy</strong>
                <span class="brand-title">근무 관리</span>
              </RouterLink>
              <div class="right">
                <span
                  class="server-clock mono"
                  title="서버 기준 현재 시각 (Asia/Seoul)"
                >
                  🕒 {{ clock.display }}
                  <NTag
                    v-if="clock.mode !== 'real'"
                    size="small"
                    type="warning"
                    :bordered="false"
                  >
                    {{ clock.mode === "fixed" ? "고정" : "오프셋" }}
                  </NTag>
                </span>
                <template v-if="showChrome">
                  <NTag
                    size="small"
                    :type="auth.isLead ? 'success' : 'default'"
                  >
                    {{ auth.user?.name }} · {{ auth.isLead ? "리드" : "팀원" }}
                  </NTag>
                  <NButton size="small" quaternary @click="logout"
                    >로그아웃</NButton
                  >
                </template>
              </div>
            </div>
            <nav v-if="showChrome" class="nav">
              <NMenu
                mode="horizontal"
                :options="menu"
                :value="route.path"
                responsive
              />
            </nav>
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
  padding: 12px 16px 0;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  min-height: 40px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  color: inherit;
  text-decoration: none;
}
.brand-logo {
  height: 22px;
  width: auto;
  display: block;
}
.brand-title {
  font-weight: 600;
  font-size: 15px;
}
@media (prefers-color-scheme: dark) {
  /* 검정 워드마크가 다크 테마에서 보이도록 반전 */
  .brand-logo {
    filter: invert(1);
  }
}
.nav {
  min-width: 0;
  margin-top: 8px;
}
/* 현재 페이지 메뉴: hover와 구분되도록 연두 배경 + 흰 글씨 */
/* 모든 항목에 하단 2px 투명 border가 있어 배경을 칠하면 글자가 위로 치우쳐 보임 → 상단에도 같은 두께를 줘서 수직 중앙 맞춤 */
.nav :deep(.n-menu-item-content) {
  border-top: 2px solid transparent;
}
.nav :deep(.n-menu-item-content--selected) {
  background-color: #29b64c;
  border-bottom-color: #29b64c !important;
}
.nav :deep(.n-menu-item-content--selected .n-menu-item-content-header),
.nav :deep(.n-menu-item-content--selected .n-menu-item-content-header a) {
  color: #fff !important;
}
.right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.server-clock {
  font-size: 13px;
  white-space: nowrap;
}
</style>
