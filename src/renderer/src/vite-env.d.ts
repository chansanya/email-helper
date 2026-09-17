/// <reference types="vite/client" />

import type { ElectronAPI } from '@shared/types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
