<script setup lang="ts">
import { useRoute } from 'vue-router'
import { IconChartBar, IconFileInvoice, IconHome, IconReceipt } from '@tabler/icons-vue'

const route = useRoute()

const tabs = [
  { to: '/', label: 'Beranda', icon: IconHome },
  { to: '/nota', label: 'Nota', icon: IconFileInvoice },
  { to: '/laporan', label: 'Laporan', icon: IconChartBar },
]
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-3xl px-4 pb-28 pt-5 text-slate-900 dark:text-slate-100 sm:px-6 sm:pt-7">
    <header
      class="relative mb-5 overflow-hidden rounded-2xl border border-white/80 bg-white/55 px-5 py-4 shadow-lg shadow-emerald-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20"
    >
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent dark:via-emerald-200/40"
      ></div>
      <div class="flex items-center gap-3">
        <span
          class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-lg shadow-emerald-900/20"
          aria-hidden="true"
        >
          <IconReceipt :size="24" stroke-width="1.8" />
        </span>
        <div>
          <p class="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            Percetakan • Pesanan
          </p>
          <h1 class="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">Alisha Catat</h1>
          <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Catat pesanan cukup dengan mengetik.
          </p>
        </div>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <nav
      aria-label="Navigasi utama"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-white/90 to-lime-50/90 shadow-[0_-12px_35px_-20px_rgba(6,78,59,0.35)] backdrop-blur-2xl dark:border-white/10 dark:from-[#081712]/95 dark:via-[#0b1915]/95 dark:to-[#101a14]/95 dark:shadow-black/40"
    >
      <div class="mx-auto grid max-w-3xl grid-cols-3 gap-2 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:px-6">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          :aria-current="route.path === tab.to ? 'page' : undefined"
          class="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          :class="
            route.path === tab.to
              ? 'bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-lg shadow-emerald-900/20'
              : 'text-slate-600 hover:bg-emerald-100/70 hover:text-emerald-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-emerald-200'
          "
        >
          <component :is="tab.icon" :size="21" stroke-width="1.8" aria-hidden="true" />
          <span>{{ tab.label }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
