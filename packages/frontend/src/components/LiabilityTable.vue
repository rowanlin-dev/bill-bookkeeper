<template>
  <div class="bg-white rounded-xl shadow-sm p-6">
    <h3 class="font-bold text-gray-800 mb-4">💳 负债明细</h3>
    <div class="space-y-2">
      <div
        v-for="l in data"
        :key="l.id"
        class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
      >
        <div>
          <div class="font-medium">{{ l.name }}</div>
          <div class="text-sm text-gray-500">{{ l.creditor }} | {{ l.due_date }}</div>
        </div>
        <div class="text-right">
          <div class="font-bold text-gray-800">¥{{ l.amount?.toLocaleString() }}</div>
          <span
            :class="l.status === '已还' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
            class="text-xs px-2 py-0.5 rounded"
          >
            {{ l.status }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ data: { type: Array, default: () => [] } })
</script>
