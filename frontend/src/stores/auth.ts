import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';
import type { User } from '../api/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loaded = ref(false);
  const isLead = computed(() => user.value?.role === 'LEAD');

  async function load() {
    try {
      user.value = (await api.get<{ user: User }>('/auth/me')).user;
    } catch {
      user.value = null;
    } finally {
      loaded.value = true;
    }
  }

  async function login(loginId: string, password: string) {
    user.value = (await api.post<{ user: User }>('/auth/login', { loginId, password })).user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      user.value = null;
    }
  }

  return { user, loaded, isLead, load, login, logout };
});
