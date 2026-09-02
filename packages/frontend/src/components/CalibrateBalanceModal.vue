<!--
  校准余额对话框
  替换 window.prompt —— 后者默认行为不一致（默认全选 vs 光标在末尾），
  导致用户"输入新数字"实际是追加到旧值末尾，parseFloat 后看起来"没改"。
  自定义 input：自动聚焦 + 自动全选 + Enter 提交 / Esc 取消。
-->
<template>
  <Teleport to="body">
    <div
      v-if="show && account"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="onCancel"
    >
      <div class="bg-white rounded-xl shadow-xl p-6 w-[28rem] max-w-[92vw]">
        <h3 class="text-lg font-bold text-gray-800 mb-3">校准「{{ account.name }}」余额</h3>

        <div class="text-sm text-gray-600 mb-4 space-y-1">
          <div>账户类型：<span class="text-gray-800">{{ account.kind || '电子' }}</span></div>
          <div>
            当前系统计算：
            <span class="font-bold" :class="account.balance < 0 ? 'text-red-600' : 'text-gray-800'">
              ¥{{ formatBalance(account.balance) }}
            </span>
          </div>
          <div class="text-xs text-gray-500 pt-1">
            请输入你实际看到的余额（默认填入当前值，已自动选中，直接输入即可覆盖）。
          </div>
        </div>

        <input
          ref="inputRef"
          v-model="inputValue"
          type="number"
          step="0.01"
          inputmode="decimal"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="{ 'border-red-400': inputTouched && !isValid }"
          placeholder="0.00"
          @keyup.enter="onConfirm"
          @keyup.esc="onCancel"
          @blur="inputTouched = true"
        />
        <div v-if="inputTouched && !isValid" class="text-xs text-red-500 mt-1">
          请输入有效数字（可正可负，最多 2 位小数）
        </div>

        <div class="flex justify-end gap-2 mt-5">
          <button
            type="button"
            @click="onCancel"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            type="button"
            @click="onConfirm"
            :disabled="!isValid"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            确认校准
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  account: { type: Object, default: null }, // { id, name, kind, balance }
})

const emit = defineEmits(['confirm', 'cancel'])

const inputRef = ref(null)
const inputValue = ref('')
const inputTouched = ref(false)

const parsedBalance = computed(() => {
  const v = parseFloat(inputValue.value)
  return Number.isFinite(v) ? v : NaN
})
const isValid = computed(() => Number.isFinite(parsedBalance.value))

function formatBalance(n) {
  const v = Number(n) || 0
  return v.toFixed(2)
}

// show 由 false 变 true 时：填默认值 + 自动聚焦 + 全选
watch(
  () => props.show,
  async (v) => {
    if (v && props.account) {
      inputTouched.value = false
      inputValue.value = Number(props.account.balance).toFixed(2)
      await nextTick()
      const el = inputRef.value
      if (el) {
        el.focus()
        // select() 必须在 focus() 之后；某些浏览器需要 try/catch（inputmode/select 抛错罕见）
        try { el.select() } catch (_) { /* noop */ }
      }
    }
  }
)

function onConfirm() {
  if (!isValid.value) return
  emit('confirm', { id: props.account.id, balance: parsedBalance.value })
}

function onCancel() {
  emit('cancel')
}
</script>