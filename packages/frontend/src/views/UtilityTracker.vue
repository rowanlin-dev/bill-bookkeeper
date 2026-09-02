<template>
  <div class="max-w-2xl mx-auto">
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">⚡ 水电记录</h2>
      
      <!-- 快速输入 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">类型</label>
          <select v-model="form.type" class="w-full border rounded-lg px-3 py-2">
            <option value="electric">电费</option>
            <option value="water">水费</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">日期</label>
          <input v-model="form.date" type="date" class="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">表读数</label>
          <input v-model="form.reading" type="number" step="0.1" placeholder="例如：1250.3" class="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">单价（元/度或元/吨）</label>
          <input v-model="form.price" type="number" step="0.01" placeholder="例如：0.6" class="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      
      <button
        @click="addReading"
        :disabled="submitting"
        class="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {{ submitting ? '保存中...' : '记录读数' }}
      </button>

      <!-- 统计卡片 -->
      <div v-if="stats" class="grid grid-cols-2 gap-4 mt-6">
        <div class="bg-blue-50 rounded-lg p-4">
          <div class="text-sm text-blue-600">本月电费</div>
          <div class="text-2xl font-bold text-blue-800">¥{{ stats.electricCost?.toFixed(2) || '0.00' }}</div>
          <div class="text-xs text-blue-500">{{ stats.electricUsage?.toFixed(1) || 0 }} 度</div>
        </div>
        <div class="bg-cyan-50 rounded-lg p-4">
          <div class="text-sm text-cyan-600">本月水费</div>
          <div class="text-2xl font-bold text-cyan-800">¥{{ stats.waterCost?.toFixed(2) || '0.00' }}</div>
          <div class="text-xs text-cyan-500">{{ stats.waterUsage?.toFixed(1) || 0 }} 吨</div>
        </div>
      </div>

      <!-- 历史记录 -->
      <div v-if="readings.length" class="mt-6">
        <h3 class="font-medium text-gray-700 mb-3">历史记录</h3>
        <div class="space-y-2">
          <div
            v-for="r in readings"
            :key="r.id"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
          >
            <div>
              <div class="font-medium">{{ r.type === 'electric' ? '⚡' : '💧' }} {{ r.date }}</div>
              <div class="text-gray-500">读数：{{ r.reading }}</div>
            </div>
            <div class="text-right">
              <div v-if="r.usage !== null" class="font-medium text-gray-800">
                {{ r.usage.toFixed(1) }} {{ r.type === 'electric' ? '度' : '吨' }}
              </div>
              <div v-if="r.cost !== null" class="text-gray-600">¥{{ r.cost.toFixed(2) }}</div>
              <div v-if="r.daily_avg" class="text-xs text-gray-400">
                日均 {{ r.daily_avg }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI建议 -->
      <div v-if="advice" class="mt-4 p-4 bg-green-50 rounded-lg">
        <div class="text-sm text-green-800">💡 {{ advice }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUtilityStore } from '../stores/utility'

const store = useUtilityStore()
const submitting = ref(false)
const advice = ref('')

const form = ref({
  type: 'electric',
  date: new Date().toISOString().split('T')[0],
  reading: '',
  price: '0.6',
})

const readings = computed(() => store.readings)

const stats = computed(() => {
  // 只统计本月有用量数据的记录
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const inMonth = r => (r.date || '').startsWith(monthPrefix) && r.usage != null
  const electric = readings.value.filter(r => r.type === 'electric' && inMonth(r))
  const water = readings.value.filter(r => r.type === 'water' && inMonth(r))

  return {
    electricUsage: electric.reduce((s, r) => s + (r.usage || 0), 0),
    electricCost: electric.reduce((s, r) => s + (r.cost || 0), 0),
    waterUsage: water.reduce((s, r) => s + (r.usage || 0), 0),
    waterCost: water.reduce((s, r) => s + (r.cost || 0), 0),
  }
})

onMounted(() => {
  store.fetchReadings()
})

async function addReading() {
  if (!form.value.reading || !form.value.price) {
    alert('请填写读数和单价')
    return
  }
  
  submitting.value = true
  try {
    await store.addReading({
      type: form.value.type,
      date: form.value.date,
      reading: parseFloat(form.value.reading),
      price_per_unit: parseFloat(form.value.price),
    })
    
    // 生成建议
    generateAdvice()
    
    form.value.reading = ''
    await store.fetchReadings()
  } catch (e) {
    alert('保存失败：' + e.message)
  } finally {
    submitting.value = false
  }
}

function generateAdvice() {
  const recent = readings.value.filter(r => r.type === form.value.type && r.daily_avg).slice(0, 3)
  if (!recent.length) {
    advice.value = '已记录初始读数，请继续记录以计算用量。'
    return
  }
  
  const avg = recent.reduce((s, r) => s + parseFloat(r.daily_avg), 0) / recent.length
  const typeName = form.value.type === 'electric' ? '用电' : '用水'
  
  if (form.value.type === 'electric') {
    if (avg > 2) advice.value = `日均用电${avg.toFixed(1)}度，偏高。建议检查空调温度设置（26°C为宜），随手关灯。`
    else if (avg > 1) advice.value = `日均用电${avg.toFixed(1)}度，正常范围。继续保持~`
    else advice.value = `日均用电${avg.toFixed(1)}度，非常节能！`
  } else {
    if (avg > 0.5) advice.value = `日均用水${avg.toFixed(2)}吨，注意节约用水。`
    else advice.value = `日均用水${avg.toFixed(2)}吨，用水正常。`
  }
}
</script>
