<script setup lang="ts">
import { NAlert, NButton, NCard, NForm, NFormItem, NInput } from 'naive-ui';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const loginId = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  error.value = null;
  loading.value = true;
  try {
    await auth.login(loginId.value.trim(), password.value);
    await router.push((route.query.redirect as string) || '/');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page center">
    <NCard title="로그인" style="width: 360px; max-width: 100%">
      <NForm @submit.prevent="submit">
        <NFormItem label="아이디">
          <NInput v-model:value="loginId" placeholder="kim" autofocus />
        </NFormItem>
        <NFormItem label="비밀번호">
          <NInput v-model:value="password" type="password" show-password-on="click" placeholder="1234" @keyup.enter="submit" />
        </NFormItem>
        <NAlert v-if="error" type="error" :show-icon="false" style="margin-bottom: 12px">{{ error }}</NAlert>
        <NButton type="primary" block :loading="loading" attr-type="submit" @click="submit">로그인</NButton>
      </NForm>
      <p class="muted" style="font-size: 12px; margin-bottom: 0">
        시드 계정: kim(리드) / yeon / lim — 비밀번호 1234
      </p>
    </NCard>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  padding-top: 80px;
}
</style>
