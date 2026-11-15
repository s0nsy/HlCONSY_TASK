/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, any>;
  export default component;
}

interface ImportMetaEnv {
  /** 'true' 면 데모 빌드: 디버그 패널 노출 + 기본으로 연구실 IP(127.0.0.1)로 가정 */
  readonly VITE_DEMO?: string;
}
