import { defineConfig } from 'vite'
import { solidVue } from 'solid-vue'

export default defineConfig(({ mode }) => ({
  plugins: [
    solidVue({
      mode: 'spa',
      apiPrefix: '/api',
      optimizeCWV: { fonts: true },
    })
  ],
  server: {
    allowedHosts: true,
    ...(mode === 'ngrok'
      ? {
          hmr: {
            host: 'suboptical-unroused-haydee.ngrok-free.dev',
            protocol: 'wss' as const,
            clientPort: 443,
          },
        }
      : {}),
  }
}))
