import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useAppStore } from "../stores/app";

declare module "vue-router" {
  interface RouteMeta {
    public?: boolean;
    lead?: boolean;
    title?: string;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      component: () => import("../views/LoginView.vue"),
      meta: { public: true, title: "로그인" },
    },
    {
      path: "/blocked",
      component: () => import("../views/BlockedView.vue"),
      meta: { public: true, title: "접속 차단" },
    },
    {
      path: "/",
      component: () => import("../views/HomeView.vue"),
      meta: { title: "홈" },
    },
    {
      path: "/attendance",
      component: () => import("../views/AttendanceView.vue"),
      meta: { title: "내 근무" },
    },
    {
      path: "/requests/new",
      component: () => import("../views/RequestNewView.vue"),
      meta: { title: "신청" },
    },
    {
      path: "/requests",
      component: () => import("../views/MyRequestsView.vue"),
      meta: { title: "내 신청" },
    },
    {
      path: "/approvals",
      component: () => import("../views/ApprovalsView.vue"),
      meta: { lead: true, title: "승인함" },
    },
    {
      path: "/balance",
      component: () => import("../views/BalanceView.vue"),
      meta: { title: "잔여" },
    },
    {
      path: "/settlement",
      component: () => import("../views/SettlementView.vue"),
      meta: { title: "월별 정산" },
    },
    {
      path: "/audit",
      component: () => import("../views/AuditLogView.vue"),
      meta: { title: "이력" },
    },
    {
      path: "/holidays",
      component: () => import("../views/HolidaysView.vue"),
      meta: { title: "공휴일" },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-accessible",
      component: () => import("../views/NotAccessibleView.vue"),
      meta: { title: "접근 불가" },
    },
  ],
});

/** FR-SYS-02: 역할별 페이지. (백엔드 RolesGuard 로도 똑같이 막는다) */
router.beforeEach(async (to) => {
  const app = useAppStore();
  if (app.blocked && to.path !== "/blocked") return "/blocked";
  if (to.meta.public) return true;
  const auth = useAuthStore();
  if (!auth.loaded) await auth.load();
  if (app.blocked) return "/blocked";
  if (!auth.user) return { path: "/login", query: { redirect: to.fullPath } };
  // 권한 없는 화면은 없는 주소와 똑같이 보여 준다 (화면 존재 노출 방지). URL 은 그대로 둔다
  if (to.meta.lead && !auth.isLead) {
    return { name: "not-accessible", params: { pathMatch: to.path.slice(1).split("/") }, replace: true };
  }
  return true;
});

router.afterEach((to) => {
  document.title = `${to.meta.title ?? ""} · hiconsy 근태관리`;
});
