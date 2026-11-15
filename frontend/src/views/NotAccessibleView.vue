<script setup lang="ts">
import { NButton, NResult } from "naive-ui";
import { RouterLink } from "vue-router";

/**
 * 권한 없는 화면과 없는 주소를 같은 페이지로 보여 준다 (FR-SYS-02).
 * 어떤 화면인지, 권한 때문인지 없는 주소인지 구분하지 않아야 리드 전용 화면의 존재가 드러나지 않는다.
 */
</script>

<template>
  <div class="page">
    <NResult
      status="404"
      title="접근할 수 없는 페이지입니다"
      style="margin-top: 80px"
    >
      <template #footer>
        <RouterLink to="/">
          <NButton type="primary">홈으로</NButton>
        </RouterLink>
      </template>
    </NResult>
  </div>
</template>
