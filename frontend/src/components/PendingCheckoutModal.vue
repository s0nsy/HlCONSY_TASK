<script setup lang="ts">
import { NAlert, NButton, NModal, NTimePicker } from 'naive-ui';
import { reactive, watch } from 'vue';
import type { Attendance } from '../api/types';
import { DAY_TYPE_LABEL } from '../utils/format';

/** FN-ATT-03: 출근 전에 밀린 퇴근 시각을 오래된 순서로 전부 입력받는다 */
const props = defineProps<{ show: boolean; items: Attendance[]; loading: boolean; error: string | null }>();
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'submit', v: { attendanceId: number; checkOutTime: string }[]): void;
}>();

const times = reactive<Record<number, string | null>>({});
watch(
  () => props.items,
  (items) => items.forEach((i) => (times[i.id] ??= null)),
  { immediate: true },
);

function submit() {
  emit(
    'submit',
    props.items.map((i) => ({ attendanceId: i.id, checkOutTime: times[i.id] ?? '' })),
  );
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="퇴근 미기록 건이 있습니다"
    style="width: 520px; max-width: calc(100vw - 32px)"
    @update:show="emit('update:show', $event)"
  >
    <p class="muted" style="margin-top: 0">
      퇴근 시각을 직접 입력해야 오늘 출근이 등록됩니다. 입력한 기록은 <b>'직접 입력'</b>으로 표시됩니다.
    </p>
    <div v-for="i in items" :key="i.id" class="item">
      <div>
        <b>{{ i.workDate }}</b>
        <span class="muted"> · {{ DAY_TYPE_LABEL[i.dayType] }} · 출근 {{ i.checkInTime }}</span>
        <div class="muted small">입력 가능: {{ i.rule }}</div>
      </div>
      <NTimePicker v-model:formatted-value="times[i.id]" value-format="HH:mm:ss" format="HH:mm:ss" placeholder="퇴근 시각" style="width: 150px" />
    </div>
    <NAlert v-if="error" type="error" :show-icon="false" style="margin-top: 12px">{{ error }}</NAlert>
    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <NButton @click="emit('update:show', false)">취소</NButton>
        <NButton type="primary" :loading="loading" :disabled="items.some((i) => !times[i.id])" @click="submit">
          입력하고 출근
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.small {
  font-size: 12px;
}
</style>
