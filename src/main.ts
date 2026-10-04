import { createSolidApp } from 'solid-vue/client'
import App from './App.vue'

const { app, router } = createSolidApp(App)

let mounted = false
let retryCount = 0
const MAX_RETRIES = 2

function mountApp() {
  if (mounted) return // idempotent guard
  mounted = true
  app.mount('#app')
}

function mountErrorShell(error: unknown) {
  console.error('[solid-vue] boot failed:', error)

  const root = document.getElementById('app')
  if (!root || mounted) return

  root.innerHTML = `
    <div class="sv-boot-error">
      <p>Error timeout occurred while booting the application.</p>
      <button id="sv-retry">Try Again</button>
    </div>
  `

  root.querySelector('#sv-retry')?.addEventListener('click', () => {
    if (retryCount >= MAX_RETRIES) {
      location.reload() // fallback pamungkas
      return
    }
    retryCount++
    // retry ka route nu sarua (deep link tetep kajaga, teu balik ka '/')
    router.replace(router.currentRoute.value.fullPath)
      .then(mountApp)
      .catch(mountErrorShell)
  }, { once: true })
}

router.isReady().then(mountApp).catch(mountErrorShell)