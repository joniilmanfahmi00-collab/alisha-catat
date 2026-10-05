import { defineConfig } from 'vite'
import { solidVue } from 'solid-vue'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ mode }) => ({
  plugins: [
    mkcert(), // 👈 Keep it completely empty. The plugin handles it automatically.
    solidVue({
      mode: 'spa',
      apiPrefix: '/api',
      optimizeCWV: { fonts: true },
    })
  ]
}))
