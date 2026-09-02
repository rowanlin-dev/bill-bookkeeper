<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-gray-800">💹 现金流预测</h2>
      <select v-model="days" @change="load" class="border rounded-lg px-3 py-1.5 text-sm text-gray-600">
        <option :value="30">未来 30 天</option>
        <option :value="90">未来 90 天</option>
        <option :value="180">未来 180 天</option>
      </select>
    </div>

    <div v-if="store.error" class="bg-red-50 text-red-600 rounded-xl p-4 text-sm">
      加载失败：{{ store.error }}
    </div>

    <template v-if="data">
      <!-- KPI -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="当前现金" :value="data.currentCash" prefix="¥" :color="data.currentCash >= 0 ? 'green' : 'red'" />
        <KpiCard :title="`${days} 天后预计`" :value="data.summary.endBalance" prefix="¥" :color="data.summary.endBalance >= 0 ? 'blue' : 'red'" />
        <KpiCard title="期内最低余额" :value="data.summary.minBalance" prefix="¥" :color="data.summary.minBalance >= 0 ? 'green' : 'red'" />
        <KpiCard title="日均支出" :value="data.avgDailyExpense" prefix="¥" color="blue" />
      </div>

      <!-- 风险提示 -->
      <div v-if="data.summary.risk" class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        ⚠️ 预测期内资金将在 <b>{{ data.summary.minDate }}</b> 跌破 0（最低 ¥{{ data.summary.minBalance }}），请提前安排收入或压缩支出。
      </div>
      <div v-else class="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
        ✅ 未来 {{ days }} 天余额始终为正，最低 ¥{{ data.summary.minBalance }}（{{ data.summary.minDate }}）。
      </div>

      <!-- 曲线图 -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-800 mb-1">📈 余额走势（近 30 天实际 + 未来 {{ days }} 天预测）</h3>
        <p class="text-xs text-gray-400 mb-4">预测口径：当前现金按近 30 天日均净额（收入−支出）漂移，叠加预计收支事件，每月 1 日扣固定支出</p>
        <div class="h-72">
          <canvas ref="chartEl"></canvas>
        </div>
      </div>

      <!-- 预计收支事件 -->
      <div v-if="data.events.length" class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-800 mb-3">📅 预计收支事件</h3>
        <div class="space-y-2">
          <div v-for="(e, i) in data.events" :key="i" class="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
            <span class="text-gray-600">{{ e.date }}</span>
            <span>{{ e.name }}</span>
            <span :class="e.type === '收入' ? 'text-green-600' : 'text-red-600'" class="font-medium">
              {{ e.type === '收入' ? '+' : '-' }}¥{{ e.amount }}
            </span>
          </div>
        </div>
      </div>

      <!-- AI 分析 -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-gray-800">🤖 AI 现金流解读</h3>
          <button
            @click="store.analyze()"
            :disabled="store.aiLoading"
            class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {{ store.aiLoading ? '分析中...' : (store.aiAnalysis ? '重新分析' : '开始分析') }}
          </button>
        </div>
        <p v-if="!store.aiAnalysis && !store.aiLoading" class="text-sm text-gray-400">
          基于上方真实数据，让 AI 给出风险判断和建议。
        </p>
        <div v-if="store.aiAnalysis" class="text-sm text-gray-700 leading-relaxed" v-html="analysisHtml"></div>
      </div>

      <!-- 情景模拟 -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-800 mb-3">🧪 情景模拟</h3>
        <p class="text-xs text-gray-400 mb-2">例如：如果 8 月入职月薪 8000，资金走势如何？／如果每月多存 500 呢？</p>
        <textarea
          v-model="simText"
          rows="2"
          class="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="输入你的假设情景..."
        />
        <button
          @click="runSim"
          :disabled="store.simLoading || !simText.trim()"
          class="mt-2 bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          {{ store.simLoading ? '模拟中...' : '开始模拟' }}
        </button>
        <div v-if="store.simResult" class="mt-3 text-sm text-gray-700 leading-relaxed border-t pt-3" v-html="simHtml"></div>
      </div>
    </template>

    <div v-else-if="store.loading" class="text-center text-gray-400 py-12">加载中...</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCashflowStore } from '../stores/cashflow'
import { renderMarkdown } from '../utils/markdown'
import KpiCard from '../components/KpiCard.vue'
import Chart from 'chart.js/auto'

const store = useCashflowStore()
const days = ref(90)
const chartEl = ref(null)
const simText = ref('')
let chartInstance = null

const data = computed(() => store.forecastData)
const analysisHtml = computed(() => renderMarkdown(store.aiAnalysis))
const simHtml = computed(() => renderMarkdown(store.simResult))

onMounted(load)

async function load() {
  await store.fetchForecast(days.value)
  renderChart()
}

function renderChart() {
  if (!data.value || !chartEl.value) return
  if (chartInstance) chartInstance.destroy()

  const history = data.value.history
  const forecast = data.value.forecast
  const labels = [...history.map(h => h.date), ...forecast.map(f => f.date)]

  // 实际曲线：历史段有值；预测曲线：从最后一天实际值接续，保证连续
  const historyData = [...history.map(h => h.balance), ...forecast.map(() => null)]
  const forecastData = [...history.map((h, i) => (i === history.length - 1 ? h.balance : null)), ...forecast.map(f => f.balance)]

  chartInstance = new Chart(chartEl.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '实际余额',
          data: historyData,
          borderColor: '#4299e1',
          backgroundColor: 'rgba(66,153,225,0.08)',
          fill: true,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: '预测余额',
          data: forecastData,
          borderColor: '#ed8936',
          borderDash: [6, 4],
          backgroundColor: 'rgba(237,137,54,0.05)',
          fill: true,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: '零线',
          data: labels.map(() => 0),
          borderColor: '#e53e3e',
          borderWidth: 1,
          borderDash: [2, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { filter: item => item.text !== '零线' } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ¥${c.parsed.y}` } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12, maxRotation: 45 } },
        y: { ticks: { callback: v => '¥' + v } },
      },
    },
  })
}

function runSim() {
  if (!simText.value.trim()) return
  store.simulate(simText.value.trim())
}
</script>
