<template>
  <div class="bg-white rounded-xl shadow-sm p-6">
    <h3 class="font-bold text-gray-800 mb-4">📋 固定支出</h3>
    <div class="space-y-2">
      <div
        v-for="f in data"
        :key="f.id"
        class="flex items-center justify-between p-3 bg-gray-50 rounded-lg group"
      >
        <div class="flex items-center gap-2">
          <span class="text-gray-600">{{ f.name }}</span>
          <span class="text-xs text-gray-400">{{ f.cycle }}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="font-bold text-gray-800">¥{{ f.amount?.toFixed(0) }}</div>
          <button
            @click="editItem(f)"
            class="text-xs text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
            title="修改金额"
          >改</button>
          <button
            @click="removeItem(f)"
            class="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title="删除（同时取消未来预计流水）"
          >删</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { api } from '../api/client'

defineProps({ data: { type: Array, default: () => [] } })
const emit = defineEmits(['changed'])

async function editItem(f) {
  const input = window.prompt(`修改「${f.name}」的金额（当前 ¥${f.amount}）：`, f.amount)
  if (input === null) return
  const amount = parseFloat(input)
  if (!Number.isFinite(amount) || amount < 0) {
    alert('金额无效')
    return
  }
  await api.put(`/fixed-expenses/${f.id}`, { amount })
  emit('changed')
}

async function removeItem(f) {
  if (!window.confirm(`删除固定支出「${f.name}」？\n同时会取消它未来的"预计"流水（已发生的历史记录保留）。`)) return
  await api.del(`/fixed-expenses/${f.id}?cleanupPlanned=1`)
  emit('changed')
}
</script>
