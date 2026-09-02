import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

// 从 AI 返回文本中提取 JSON（容错 markdown 围栏与前后杂文本）
function extractJson(text) {
  if (!text || typeof text !== 'string') return null
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) } catch { /* fallthrough */ }
    }
    return null
  }
}

// 统一为操作列表格式（兼容旧版 transactions 输出）
function normalizeOperations(parsed) {
  if (!parsed) return null
  if (Array.isArray(parsed.operations)) return parsed
  if (Array.isArray(parsed.transactions)) {
    return {
      operations: parsed.transactions.map(t => ({ op: 'add', ...t })),
      summary: parsed.summary || '',
    }
  }
  return null
}

export const useTransactionStore = defineStore('transactions', () => {
  const transactions = ref([])
  const loading = ref(false)

  async function fetchTransactions(params = {}) {
    loading.value = true
    try {
      const query = new URLSearchParams(params).toString()
      const data = await api.get(`/transactions?${query}`)
      transactions.value = data.data
    } finally {
      loading.value = false
    }
  }

  async function addTransaction(transaction) {
    return api.post('/transactions', transaction)
  }

  async function updateTransaction(id, patch) {
    return api.put(`/transactions/${id}`, patch)
  }

  async function deleteTransaction(id) {
    return api.del(`/transactions/${id}`)
  }

  async function parseWithAI(text) {
    const data = await api.post('/ai/chat', {
      project: 'bill',
      skill: 'NLPParser',
      messages: [{ role: 'user', content: text }],
      context: {},
    })

    const parsed = normalizeOperations(extractJson(data.response))
    if (parsed) return parsed
    // AI 没按格式返回时，把原文作为摘要展示，不静默吞掉
    return { operations: [], summary: data.response || 'AI 未返回有效内容' }
  }

  return { transactions, loading, fetchTransactions, addTransaction, updateTransaction, deleteTransaction, parseWithAI }
})
