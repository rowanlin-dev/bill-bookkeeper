<template>
  <div>
    <h2 class="text-xl font-bold text-gray-800 mb-4">📒 账本明细</h2>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-gray-600">日期</th>
            <th class="px-4 py-3 text-left font-medium text-gray-600">类型</th>
            <th class="px-4 py-3 text-left font-medium text-gray-600">名称</th>
            <th class="px-4 py-3 text-left font-medium text-gray-600">分类</th>
            <th class="px-4 py-3 text-right font-medium text-gray-600">金额</th>
            <th class="px-4 py-3 text-left font-medium text-gray-600">账户</th>
            <th class="px-4 py-3 text-left font-medium text-gray-600">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="t in transactions"
            :key="t.id"
            class="hover:bg-gray-50"
            :class="{ 'opacity-50': t.status === '已取消' }"
          >
            <td class="px-4 py-3 text-gray-600">{{ t.date }}</td>
            <td class="px-4 py-3">
              <span
                :class="t.type === '收入' ? 'text-green-600' : t.type === '转账' ? 'text-blue-600' : 'text-red-600'"
                class="font-medium"
              >
                {{ t.type }}
              </span>
            </td>
            <td class="px-4 py-3">{{ t.name }}</td>
            <td class="px-4 py-3">
              <span v-if="t.category" class="px-2 py-1 bg-gray-100 rounded text-xs">{{ t.category }}</span>
            </td>
            <td class="px-4 py-3 text-right font-medium" :class="t.type === '收入' ? 'text-green-600' : t.type === '转账' ? 'text-blue-600' : 'text-red-600'">
              {{ t.type === '收入' ? '+' : t.type === '转账' ? '⇄' : '-' }}¥{{ t.amount?.toFixed(2) }}
            </td>
            <td class="px-4 py-3 text-gray-500">
              {{ t.type === '转账' ? `${t.account} → ${t.to_account}` : t.account }}
            </td>
            <td class="px-4 py-3">
              <!-- 预计（固定支出）行：可 确认 / 取消 -->
              <template v-if="t.source === '预计'">
                <span v-if="t.status === '已取消'" class="px-2 py-1 bg-gray-100 text-gray-400 rounded text-xs">已取消</span>
                <span
                  v-else-if="t.status === '已到账'"
                  class="inline-flex items-center gap-1"
                >
                  <span
                    class="px-2 py-1 bg-green-50 text-green-600 rounded text-xs"
                    title="已确认支出，已计入现金"
                  >预计·已确认</span>
                  <button
                    @click="revertConfirmed(t)"
                    class="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                    title="撤销确认：改回「待生效」（不再计入现金，保留固定支出模板，后续月份继续预计）"
                  >撤销确认</button>
                </span>
                <span v-else class="inline-flex gap-1">
                  <button
                    @click="confirmPlanned(t)"
                    class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                    title="确认已支出，计入现金"
                  >确认</button>
                  <button
                    @click="cancelPlanned(t)"
                    class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                    title="取消：未支出，且停止后续月份的预计"
                  >取消</button>
                </span>
              </template>
              <!-- 待生效（先用后付等）行 -->
              <button
                v-else-if="t.status === '待生效'"
                @click="activate(t)"
                class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
                title="点击确认已扣款"
              >待生效</button>
              <span v-else-if="t.status === '已取消'" class="px-2 py-1 bg-gray-100 text-gray-400 rounded text-xs">已取消</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTransactionStore } from '../stores/transactions'
import { api } from '../api/client'

const store = useTransactionStore()
const { transactions } = storeToRefs(store)

function todayLocal() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

onMounted(() => {
  store.fetchTransactions({ limit: 200 })
})

async function activate(t) {
  await store.updateTransaction(t.id, { status: '已到账' })
  await store.fetchTransactions({ limit: 200 })
}

// 确认预计：已支出，计入现金（status→已到账，isActive 现将其计入余额与统计）
async function confirmPlanned(t) {
  await store.updateTransaction(t.id, { status: '已到账' })
  await store.fetchTransactions({ limit: 200 })
}

// 撤销确认：把误确认的预计行改回「待生效」（不再计入现金，保留固定支出模板，后续月份继续预计）
async function revertConfirmed(t) {
  await store.updateTransaction(t.id, { status: '待生效' })
  await store.fetchTransactions({ limit: 200 })
}

// 取消预计：未支出（status→已取消，不计入现金），并停止后续月份预计
// （删除对应固定支出模板 + 清理未来预计流水；无模板则按名称清理未来预计）
async function cancelPlanned(t) {
  const ok = window.confirm(
    `确认取消「${t.name}」这笔预计？\n` +
      '• 本条标记为「已取消」，不计入现金\n' +
      '• 同时停止后续月份的预计（删除对应固定支出模板，未来预计流水一并清除）'
  )
  if (!ok) return
  const tId = t.id
  try {
    const res = await api.get('/fixed-expenses')
    const list = (res && res.data) || []
    const fe = list.find((f) => f.name === t.name)
    if (fe) {
      await api.del(`/fixed-expenses/${fe.id}?cleanupPlanned=1`)
    } else {
      await api.del(`/transactions/planned?name=${encodeURIComponent(t.name)}&from=${todayLocal()}`)
    }
    // 当前这条标记为已取消（若已被 cleanup 删除则忽略）
    try {
      await store.updateTransaction(tId, { status: '已取消' })
    } catch (_) { /* 已被清理，忽略 */ }
  } finally {
    await store.fetchTransactions({ limit: 200 })
  }
}
</script>
