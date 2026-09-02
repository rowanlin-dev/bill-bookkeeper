<template>
  <div class="bg-white rounded-xl shadow-sm p-6">
    <div class="text-sm text-gray-500 mb-1">{{ title }}</div>
    <div class="text-3xl font-bold" :class="colorClass">
      {{ prefix }}{{ formattedValue }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: String,
  value: Number,
  prefix: { type: String, default: '' },
  color: { type: String, default: 'gray' },
})

const colorClass = computed(() => {
  const map = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    gray: 'text-gray-800',
  }
  return map[props.color] || map.gray
})

const formattedValue = computed(() => {
  if (props.value === undefined || props.value === null) return '0.00'
  return props.value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
})
</script>
