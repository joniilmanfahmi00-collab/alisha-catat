<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { LineChart } from 'chartist'
import 'chartist/dist/index.css'

const props = defineProps<{
  labels: string[]
  series: number[][]
}>()

const chartEl = ref<HTMLElement | null>(null)
let chart: LineChart | null = null

function render() {
  if (!chartEl.value) return
  chart?.detach()
  chart = new LineChart(chartEl.value, { labels: props.labels, series: props.series })
}

onMounted(render)
watch(() => [props.labels, props.series], render, { deep: true })
onUnmounted(() => chart?.detach())
</script>

<template>
  <div ref="chartEl" class="ct-chart"></div>
</template>
