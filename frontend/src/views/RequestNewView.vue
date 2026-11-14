<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NRadioButton,
  NRadioGroup,
  NTimePicker,
  useMessage,
} from 'naive-ui';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import type { RequestType } from '../api/types';
import { useClockStore } from '../stores/clock';
import { TYPE_LABEL } from '../utils/format';

interface Preview {
  deadline: { iso: string; label: string; passed: boolean } | null;
  balance: { remaining: number; label: string } | null;
  problemMessages: { code: string; message: string }[];
  canSubmit: boolean;
  requireApproval: boolean;
}

/** FN-REQ-01 신청서. 기한·잔여 안내는 서버 미리보기 API 로 실시간 확인 */
const router = useRouter();
const message = useMessage();
const clock = useClockStore();

const type = ref<RequestType>('ANNUAL');
const targetDate = ref<string | null>(null);
const reason = ref('');
const ip = ref(clock.clientIp);
const startTime = ref<string | null>('09:00');
const endTime = ref<string | null>('18:00');
const offHalf = ref<'AM' | 'PM'>('AM');
const preview = ref<Preview | null>(null);
const submitting = ref(false);
const needsIp = computed(() => type.value === 'REMOTE' || type.value === 'HOLIDAY_WORK');

watch(
  () => clock.clientIp,
  (v) => {
    if (!ip.value) ip.value = v;
  },
);

watch(
  [type, targetDate],
  async () => {
    preview.value = null;
    if (!targetDate.value) return;
    preview.value = await api.get<Preview>(`/requests/preview?type=${type.value}&date=${targetDate.value}`);
  },
);

async function submit() {
  if (!targetDate.value) return message.warning('날짜를 고르세요');
  submitting.value = true;
  try {
    const r = await api.post<{ id: number; status: string }>('/requests', {
      type: type.value,
      targetDate: targetDate.value,
      reason: reason.value,
      ...(needsIp.value ? { ip: ip.value, startTime: startTime.value, endTime: endTime.value } : {}),
      ...(type.value === 'OFF' ? { offHalf: offHalf.value } : {}),
    });
    message.success(`신청 #${r.id} 제출 (${r.status === 'APPROVED' ? '승인' : '승인 대기'})`);
    await router.push('/requests');
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <NCard title="신청서 작성" style="max-width: 640px">
      <NForm label-placement="top">
        <NFormItem label="종류">
          <NRadioGroup v-model:value="type">
            <NRadioButton v-for="t in ['ANNUAL', 'REMOTE', 'OFF', 'HOLIDAY_WORK'] as const" :key="t" :value="t">
              {{ TYPE_LABEL[t] }}
            </NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="사용일">
          <NDatePicker v-model:formatted-value="targetDate" type="date" value-format="yyyy-MM-dd" clearable style="width: 200px" />
        </NFormItem>

        <NAlert v-if="preview" :type="preview.canSubmit ? 'info' : 'warning'" :show-icon="false" style="margin-bottom: 16px">
          <div v-if="preview.deadline">
            이 날짜의 신청 마감: <b>{{ preview.deadline.label }}</b>
            <span v-if="preview.deadline.passed"> (마감됨)</span>
          </div>
          <div v-if="preview.balance">{{ preview.balance.label }}</div>
          <div v-for="p in preview.problemMessages" :key="p.code">⚠ {{ p.message }}</div>
          <div v-if="preview.requireApproval" class="muted" style="font-size: 12px">리드 승인 후 효력이 생깁니다.</div>
        </NAlert>

        <template v-if="needsIp">
          <NFormItem label="접속 IP (이 IP에서만 출퇴근·접속 가능)">
            <NInput v-model:value="ip" placeholder="예: 10.0.0.5" />
          </NFormItem>
          <NFormItem label="시간대">
            <div class="row">
              <NTimePicker v-model:formatted-value="startTime" value-format="HH:mm" format="HH:mm" style="width: 120px" />
              ~
              <NTimePicker v-model:formatted-value="endTime" value-format="HH:mm" format="HH:mm" style="width: 120px" />
            </div>
          </NFormItem>
        </template>
        <NFormItem v-if="type === 'OFF'" label="오전/오후 (표시용)">
          <NRadioGroup v-model:value="offHalf">
            <NRadioButton value="AM">오전</NRadioButton>
            <NRadioButton value="PM">오후</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="사유">
          <NInput v-model:value="reason" type="textarea" :maxlength="500" show-count />
        </NFormItem>
        <NButton type="primary" :loading="submitting" :disabled="!preview?.canSubmit || !reason.trim()" @click="submit">
          제출
        </NButton>
      </NForm>
    </NCard>
  </div>
</template>
