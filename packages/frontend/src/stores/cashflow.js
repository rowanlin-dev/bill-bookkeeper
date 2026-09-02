import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export const useCashflowStore = defineStore('cashflow', () => {
  const forecastData = ref(null)
  const loading = ref(false)
  const error = ref('')

  const aiAnalysis = ref('')
  const aiLoading = ref(false)
  const simResult = ref('')
  const simLoading = ref(false)

  async function fetchForecast(days = 90) {
    loading.value = true
    error.value = ''
    try {
      const res = await api.get(`/cashflow/forecast?days=${days}`)
      forecastData.value = res.data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // 把确定性预测数据拼成快照，交给 Forecast skill 做 AI 解读
  async function analyze() {
    if (!forecastData.value) return
    const d = forecastData.value
    const snapshot = [
      `当前现金：¥${d.currentCash}`,
      `近30天日均收入：¥${d.avgDailyIncome}，日均支出：¥${d.avgDailyExpense}，日均净额：¥${d.avgDailyNet}`,
      `每月固定支出：¥${d.monthlyFixed}`,
      `未来${d.days}天预测期末余额：¥${d.summary.endBalance}`,
      `预测期内最低余额：¥${d.summary.minBalance}（${d.summary.minDate}）`,
      d.events.length
        ? `预计收支事件：${d.events.map(e => `${e.date} ${e.type === '收入' ? '+' : '-'}¥${e.amount}（${e.name}）`).join('；')}`
        : '预计收支事件：无',
    ].join('\n')

    aiLoading.value = true
    aiAnalysis.value = ''
    try {
      const res = await api.post('/ai/chat', {
        project: 'bill',
        skill: 'Forecast',
        messages: [{ role: 'user', content: `这是我的现金流数据快照，请分析：\n${snapshot}` }],
        context: {},
      })
      aiAnalysis.value = res.response || 'AI 未返回内容'
    } catch (e) {
      aiAnalysis.value = '分析失败：' + e.message
    } finally {
      aiLoading.value = false
    }
  }

  async function simulate(text) {
    simLoading.value = true
    simResult.value = ''
    try {
      const res = await api.post('/ai/chat', {
        project: 'bill',
        skill: 'Simulator',
        messages: [{ role: 'user', content: text }],
        context: {},
      })
      simResult.value = res.response || 'AI 未返回内容'
    } catch (e) {
      simResult.value = '模拟失败：' + e.message
    } finally {
      simLoading.value = false
    }
  }

  return { forecastData, loading, error, aiAnalysis, aiLoading, simResult, simLoading, fetchForecast, analyze, simulate }
})
