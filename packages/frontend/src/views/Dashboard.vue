<template>
  <div class="space-y-6">
    <!-- KPI 卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="当前现金"
        :value="dashboardData?.kpi?.currentCash"
        prefix="¥"
        :color="dashboardData?.kpi?.currentCash >= 0 ? 'green' : 'red'"
      />
      <KpiCard
        title="总收入"
        :value="dashboardData?.kpi?.totalIncome"
        prefix="¥"
        color="green"
      />
      <KpiCard
        title="总支出"
        :value="dashboardData?.kpi?.totalExpense"
        prefix="¥"
        color="red"
      />
      <KpiCard
        title="月均固定"
        :value="dashboardData?.kpi?.monthlyFixed"
        prefix="¥"
        color="blue"
      />
    </div>

    <!-- 账户余额 -->
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h3 class="font-bold text-gray-800 mb-4">💼 账户余额</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          v-for="a in dashboardData?.accounts || []"
          :key="a.id"
          class="border rounded-lg p-3 hover:border-blue-300 transition-colors"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">{{ a.name }}</span>
            <span class="text-xs text-gray-400">{{ a.kind }}</span>
          </div>
          <div class="text-lg font-bold mt-1" :class="a.balance >= 0 ? 'text-gray-800' : 'text-red-600'">
            ¥{{ a.balance.toFixed(2) }}
          </div>
          <button @click="calibrate(a)" class="text-xs text-blue-500 hover:text-blue-700 mt-1">
            校准余额
          </button>
        </div>
      </div>
    </div>

    <!-- 待生效（先用后付等） -->
    <div v-if="dashboardData?.pending?.length" class="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
      <h3 class="font-bold text-yellow-800 mb-3">⏳ 待生效（未扣款，不计入统计）</h3>
      <div class="space-y-2">
        <div
          v-for="p in dashboardData.pending"
          :key="p.id"
          class="flex items-center justify-between text-sm bg-white rounded-lg p-3"
        >
          <div>
            <span class="font-medium">{{ p.name }}</span>
            <span class="text-gray-400 ml-2">{{ p.date }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-bold text-gray-700">¥{{ p.amount }}</span>
            <button @click="confirmPending(p)" class="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
              已扣款
            </button>
            <button @click="cancelPending(p)" class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-gray-300">
              已取消/退款
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-800 mb-4">📈 收支趋势</h3>
        <div class="h-64">
          <canvas ref="trendChart"></canvas>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-800 mb-4">📊 支出分类</h3>
        <div class="h-64">
          <canvas ref="categoryChart"></canvas>
        </div>
      </div>
    </div>

    <!-- 负债与固定支出 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <LiabilityTable :data="dashboardData?.liabilities" />
      <FixedExpenseTable :data="dashboardData?.fixedExpenses" @changed="refresh" />
    </div>

    <!-- 校准余额对话框（替换原 window.prompt，避免默认行为不一致导致"改不了数"） -->
    <CalibrateBalanceModal
      :show="!!calibratingAccount"
      :account="calibratingAccount"
      @confirm="confirmCalibrate"
      @cancel="cancelCalibrate"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useDashboardStore } from '../stores/dashboard'
import { api } from '../api/client'
import KpiCard from '../components/KpiCard.vue'
import LiabilityTable from '../components/LiabilityTable.vue'
import FixedExpenseTable from '../components/FixedExpenseTable.vue'
import CalibrateBalanceModal from '../components/CalibrateBalanceModal.vue'
import Chart from 'chart.js/auto'

const store = useDashboardStore()
const dashboardData = ref(null)
const calibratingAccount = ref(null)
const trendChart = ref(null)
const categoryChart = ref(null)

let trendInstance = null
let categoryInstance = null

onMounted(refresh)

watch(() => store.data, (newData) => {
  dashboardData.value = newData
  renderCharts()
})

async function refresh() {
  await store.fetchDashboard()
  dashboardData.value = store.data
  renderCharts()
}

// 余额校准：用户报告真实余额 → 更新锚点
// 用自定义模态对话框（CalibrateBalanceModal）替代 window.prompt：
// 不同浏览器 prompt 默认行为不一致（默认全选 vs 光标在末尾），用户想改数时
// 实际是"追加到原值末尾"，parseFloat 后看起来像没改。
function calibrate(account) {
  calibratingAccount.value = account
}

async function confirmCalibrate({ id, balance }) {
  const today = new Date().toISOString().slice(0, 10)
  await api.put(`/accounts/${id}`, { anchor_balance: balance, anchor_date: today })
  calibratingAccount.value = null
  await refresh()
}

function cancelCalibrate() {
  calibratingAccount.value = null
}

// 待生效 → 已到账
async function confirmPending(p) {
  await api.put(`/transactions/${p.id}`, { status: '已到账' })
  await refresh()
}

// 待生效 → 已取消（退货等，永远不计入）
async function cancelPending(p) {
  await api.put(`/transactions/${p.id}`, { status: '已取消' })
  await refresh()
}

function renderCharts() {
  if (!dashboardData.value) return

  // 趋势图
  if (trendInstance) trendInstance.destroy()
  if (trendChart.value) {
    const daily = dashboardData.value.daily?.slice().reverse() || []
    trendInstance = new Chart(trendChart.value, {
      type: 'line',
      data: {
        labels: daily.map(d => d.date),
        datasets: [
          {
            label: '收入',
            data: daily.map(d => d.income),
            borderColor: '#48bb78',
            backgroundColor: 'rgba(72,187,120,0.1)',
            fill: true,
          },
          {
            label: '支出',
            data: daily.map(d => d.expense),
            borderColor: '#f56565',
            backgroundColor: 'rgba(245,101,101,0.1)',
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => '¥' + v } },
        },
      },
    })
  }

  // 分类饼图
  if (categoryInstance) categoryInstance.destroy()
  if (categoryChart.value) {
    const cats = dashboardData.value.categories || []
    categoryInstance = new Chart(categoryChart.value, {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.category),
        datasets: [{
          data: cats.map(c => c.total),
          backgroundColor: ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#4299e1', '#667eea', '#9f7aea', '#38b2ac'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
      },
    })
  }
}
</script>
