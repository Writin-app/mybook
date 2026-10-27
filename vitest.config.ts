import { defineConfig } from 'vitest/config'

process.env.NODE_ENV = 'test'

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      'virtual:pwa-register/react': new URL('./src/test/mockPwaRegisterReact.ts', import.meta.url).pathname,
    },
  },
  test: {
    exclude: ['**/node_modules/**', 'dist/**', 'e2e/**'],
    fileParallelism: false,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      VITE_GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      VITE_GOOGLE_AUTH_MODE: 'browser',
    },
  },
})
