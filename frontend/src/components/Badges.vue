<script setup lang="ts">
import { NTag } from 'naive-ui';
import { BADGE } from '../utils/format';

defineProps<{ badges: string[] }>();
</script>

<template>
  <span class="row" style="display: inline-flex; gap: 4px">
    <NTag v-for="b in badges" :key="b" size="small" :type="BADGE[b]?.type ?? 'default'" :bordered="false">
      {{ BADGE[b]?.label ?? b }}
    </NTag>
  </span>
</template>
