<template>
  <div class="max-w-2xl mx-auto">
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">🤖 AI 智能记账</h2>

      <!-- 输入框 -->
      <div
        class="space-y-4"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <!-- 图片预览：仅存在于组件内存（ref），不写 localStorage / IndexedDB / 服务端 -->
        <div v-if="imageDataUrl" class="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <img
            :src="imageDataUrl"
            alt="待识别图片"
            style="width:120px;height:120px"
            class="object-contain bg-white rounded border border-blue-100"
          />
          <div class="flex-1 text-sm text-blue-800">
            <div>已选图片，发送后将由 AI 识别为记账条目</div>
            <div v-if="imageSizeText" class="mt-1 text-xs text-blue-600">{{ imageSizeText }}</div>
          </div>
          <button
            type="button"
            @click="clearImage"
            title="移除图片"
            class="px-1 text-gray-500 hover:text-red-600"
          >❌</button>
        </div>

        <p v-if="imageError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {{ imageError }}
          <button type="button" @click="openImagePicker" class="ml-2 text-blue-600 underline">重新上传</button>
        </p>

        <textarea
          v-model="inputText"
          @paste="onPaste"
          placeholder="支持记账、转账、报余额、取消固定支出，例如：&#10;晚饭13，饮料7&#10;充值岭南通20（自动识别为转账）&#10;现在微信剩2156.33（自动校准余额）&#10;酷狗会员以后不每月扣了（自动取消固定支出）"
          class="w-full h-32 p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          :class="dragActive ? 'ring-2 ring-blue-400 border-transparent' : ''"
        />
        <div class="flex gap-3">
          <button
            v-if="!isOffline"
            type="button"
            @click="openImagePicker"
            :disabled="loading"
            title="选择图片，由 AI 识别为记账条目"
            class="px-4 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🖼️
          </button>
          <button
            @click="submit"
            :disabled="loading || (!inputText.trim() && !imageBase64)"
            class="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ loading ? (imageBase64 ? '识别中...' : '解析中...') : (imageBase64 ? 'AI 识别图片' : 'AI 解析') }}
          </button>
          <button
            @click="clearAll"
            class="px-4 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50"
          >
            清空
          </button>
        </div>

        <p v-if="isOffline" class="text-xs text-gray-500">图片识别需要调用云端视觉模型，仅在在线模式可用。</p>
        <p v-else class="text-xs text-gray-500">也可粘贴（Ctrl/Cmd+V）或拖拽账单截图到输入框，由 AI 识别为记账条目；图片用完即弃，不会保存。</p>

        <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="onImagePicked" />
      </div>

      <!-- 解析结果 -->
      <div v-if="parsedData" class="mt-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-gray-700">解析结果（{{ checkedCount }}/{{ parsedData.operations.length }} 项待执行）</h3>
          <span class="text-sm text-gray-500">请核对后确认</span>
        </div>

        <div v-if="parsedData.summary" class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3" v-html="renderMarkdown(parsedData.summary)">
        </div>

        <!-- 操作列表 -->
        <div class="space-y-2">
          <div
            v-for="(op, index) in parsedData.operations"
            :key="index"
            class="flex items-center gap-3 p-3 rounded-lg"
            :class="opCardClass(op)"
          >
            <input type="checkbox" v-model="op.selected" class="w-4 h-4" />
            <div class="flex-1">
              <!-- 收支 -->
              <template v-if="op.op === 'add'">
                <div class="flex items-center gap-2">
                  <span :class="op.type === '收入' ? 'text-green-600' : 'text-red-600'" class="font-medium">{{ op.type }}</span>
                  <span class="font-bold">¥{{ op.amount }}</span>
                  <span class="text-gray-600">{{ op.name }}</span>
                  <span v-if="op.status === '待生效'" class="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">待生效</span>
                  <span v-if="op.source === '预计'" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">预计</span>
                  <span v-if="op.dup" class="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">疑似重复</span>
                </div>
                <div class="text-sm text-gray-500">{{ op.date }} | {{ op.category }} | {{ op.account }}</div>
              </template>

              <!-- 转账 -->
              <template v-else-if="op.op === 'transfer'">
                <div class="flex items-center gap-2">
                  <span class="text-blue-600 font-medium">转账</span>
                  <span class="font-bold">¥{{ op.amount }}</span>
                  <span class="text-gray-600">{{ op.name }}</span>
                </div>
                <div class="text-sm text-gray-500">{{ op.date }} | {{ op.account }} → {{ op.to_account }}</div>
              </template>

              <!-- 余额校准 -->
              <template v-else-if="op.op === 'calibrate'">
                <div class="flex items-center gap-2">
                  <span class="text-purple-600 font-medium">余额校准</span>
                  <span class="font-bold">{{ op.account }} = ¥{{ op.balance }}</span>
                </div>
                <div class="text-sm text-gray-500">锚点日期 {{ op.date }}</div>
              </template>

              <!-- 取消预计流水 -->
              <template v-else-if="op.op === 'delete_planned'">
                <div class="flex items-center gap-2">
                  <span class="text-orange-600 font-medium">取消预计</span>
                  <span class="text-gray-700">「{{ op.name }}」{{ op.from_date }} 起的预计流水</span>
                </div>
                <div v-if="op.note" class="text-sm text-gray-500">{{ op.note }}</div>
              </template>

              <!-- 删除固定支出 -->
              <template v-else-if="op.op === 'delete_fixed'">
                <div class="flex items-center gap-2">
                  <span class="text-orange-600 font-medium">移除固定支出</span>
                  <span class="text-gray-700">「{{ op.name }}」</span>
                </div>
                <div v-if="op.note" class="text-sm text-gray-500">{{ op.note }}</div>
              </template>

              <!-- 新增固定支出 -->
              <template v-else-if="op.op === 'add_fixed'">
                <div class="flex items-center gap-2">
                  <span class="text-indigo-600 font-medium">固定支出</span>
                  <span class="font-bold">¥{{ op.amount }}</span>
                  <span class="text-gray-700">{{ op.name }}（{{ op.cycle || '月付' }}）</span>
                </div>
              </template>

              <!-- 未知操作 -->
              <template v-else>
                <div class="text-gray-500 text-sm">未知操作：{{ op.op }}</div>
              </template>
            </div>

            <select v-if="op.op === 'add'" v-model="op.category" class="text-sm border rounded px-2 py-1">
              <option>餐饮</option>
              <option>交通</option>
              <option>购物</option>
              <option>娱乐</option>
              <option>住房</option>
              <option>教育</option>
              <option>通讯</option>
              <option>工具/会员</option>
              <option>医疗</option>
              <option>人情</option>
              <option>其他支出</option>
              <option>其他收入</option>
              <option>家庭资助</option>
              <option>家庭借款</option>
            </select>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-3 pt-2">
          <button
            @click="confirmAdd"
            :disabled="submitting || checkedCount === 0"
            class="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {{ submitting ? `执行中 ${doneCount}/${checkedCount}...` : `确认执行（${checkedCount} 项）` }}
          </button>
          <button
            @click="parsedData = null"
            class="px-4 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      </div>

      <!-- 最近记录 -->
      <div v-if="recentTransactions.length" class="mt-8">
        <h3 class="font-medium text-gray-700 mb-3">最近记录</h3>
        <div class="space-y-2">
          <div
            v-for="t in recentTransactions"
            :key="t.id"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
          >
            <div class="flex items-center gap-2">
              <span :class="t.type === '收入' ? 'text-green-600' : t.type === '转账' ? 'text-blue-600' : 'text-red-600'">
                {{ t.type === '收入' ? '+' : t.type === '转账' ? '⇄' : '-' }}¥{{ t.amount }}
              </span>
              <span class="text-gray-600">{{ t.name }}</span>
            </div>
            <span class="text-gray-400">{{ t.date }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTransactionStore } from '../stores/transactions'
import { useAccountStore } from '../stores/accounts'
import { api } from '../api/client'
import { renderMarkdown } from '../utils/markdown'

const store = useTransactionStore()
const accountStore = useAccountStore()
const inputText = ref('')
const loading = ref(false)
const submitting = ref(false)
const doneCount = ref(0)
const parsedData = ref(null)
const recentTransactions = ref([])

// 离线模式禁用图片入口：视觉解析只走 Node 后端，避免 Key 暴露在浏览器
const isOffline = import.meta.env.VITE_OFFLINE === 'true'
const OFFLINE_IMAGE_HINT = '图片识别需要调用云端视觉模型，仅在在线模式可用。'
const MAX_EDGE = 1024
const MAX_IMAGE_BYTES = Math.round(1.5 * 1024 * 1024)

// 图片只存在于组件内存：预览用 dataUrl，发送用压缩后的 base64，均不落任何持久化存储
const imageInput = ref(null)
const imageDataUrl = ref('')
const imageBase64 = ref('')
const imageSizeText = ref('')
const imageError = ref('')
const dragActive = ref(false)

const checkedCount = computed(() =>
  (parsedData.value?.operations || []).filter(o => o.selected).length
)

function clearImage() {
  imageDataUrl.value = ''
  imageBase64.value = ''
  imageSizeText.value = ''
  if (imageInput.value) imageInput.value.value = ''
}

function clearAll() {
  inputText.value = ''
  clearImage()
}

function openImagePicker() {
  if (isOffline) {
    imageError.value = OFFLINE_IMAGE_HINT
    return
  }
  imageError.value = ''
  imageInput.value?.click()
}

// 压缩：长边 ≤1024px、JPEG 质量 0.8，返回待发送的 base64（dataUrl 仅用于预览）
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败，请重试'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片无法解析，请换一张'))
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const base64 = dataUrl.split(',')[1] || ''
        resolve({ base64, dataUrl, bytes: base64.length })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

async function attachImageFile(file) {
  if (!file) return
  if (isOffline) {
    imageError.value = OFFLINE_IMAGE_HINT
    return
  }
  if (!String(file.type || '').startsWith('image/')) {
    imageError.value = '只支持图片文件（image/*）'
    return
  }
  imageError.value = ''
  try {
    const { base64, dataUrl, bytes } = await compressImage(file)
    // 超过硬上限直接阻止发送，不静默截断
    if (bytes > MAX_IMAGE_BYTES) {
      imageError.value = `图片过大（压缩后约 ${(bytes / 1024 / 1024).toFixed(2)}MB，上限 1.5MB），请换一张或裁剪后重试`
      return
    }
    imageBase64.value = base64
    imageDataUrl.value = dataUrl
    imageSizeText.value = `压缩后约 ${Math.round(bytes / 1024)} KB · 长边 ≤ ${MAX_EDGE}px`
  } catch (e) {
    imageError.value = e.message || '图片处理失败，请重试'
  }
}

function onImagePicked(e) {
  const file = e.target.files && e.target.files[0]
  attachImageFile(file)
  e.target.value = ''
}

function onPaste(e) {
  if (isOffline) return
  const items = e.clipboardData && e.clipboardData.items
  if (!items) return
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        e.preventDefault()
        attachImageFile(file)
      }
      return
    }
  }
}

function onDragOver() {
  if (!isOffline) dragActive.value = true
}

function onDragLeave() {
  dragActive.value = false
}

function onDrop(e) {
  dragActive.value = false
  if (isOffline) {
    imageError.value = OFFLINE_IMAGE_HINT
    return
  }
  const files = e.dataTransfer && e.dataTransfer.files
  const file = Array.from(files || []).find(f => String(f.type || '').startsWith('image/'))
  if (file) attachImageFile(file)
}

onMounted(async () => {
  await Promise.all([store.fetchTransactions({ limit: 200 }), accountStore.fetchAccounts()])
  recentTransactions.value = store.transactions.slice(0, 10)
})

function submit() {
  return imageBase64.value ? parseImage() : parseText()
}

async function parseText() {
  if (!inputText.value.trim()) return

  loading.value = true
  try {
    const result = await store.parseWithAI(inputText.value)
    applyResult(result)
  } catch (e) {
    alert('解析失败：' + e.message)
  } finally {
    loading.value = false
  }
}

// 有图走 VisionParser，识别结果与文字解析同构，复用下方同一套清单渲染与落库链路
async function parseImage() {
  if (!imageBase64.value) return

  loading.value = true
  imageError.value = ''
  try {
    const result = await store.parseImageWithAI(imageBase64.value)
    applyResult(result)
    clearImage() // 发送成功后立即清空预览：图片用完即弃
  } catch (e) {
    imageError.value = '识别失败：' + e.message
  } finally {
    loading.value = false
  }
}

function applyResult(result) {
  const ops = result.operations || []
  ops.forEach(o => {
    o.selected = true
    o.dup = false
    // 疑似重复检测：同日期 + 同名称 + 同金额 已存在
    if (o.op === 'add') {
      const dup = store.transactions.some(t =>
        t.date === o.date && t.name === o.name && Number(t.amount) === Number(o.amount)
      )
      if (dup) {
        o.dup = true
        o.selected = false
      }
    }
  })
  parsedData.value = { operations: ops, summary: result.summary }
}

function opCardClass(op) {
  if (op.dup) return 'bg-red-50'
  switch (op.op) {
    case 'transfer': return 'bg-blue-50'
    case 'calibrate': return 'bg-purple-50'
    case 'delete_planned':
    case 'delete_fixed': return 'bg-orange-50'
    case 'add_fixed': return 'bg-indigo-50'
    default: return 'bg-gray-50'
  }
}

// 逐个执行操作
async function executeOperation(op) {
  switch (op.op) {
    case 'add': {
      // 兜底：source==='预计' 且 AI 未显式指定 status 时，强制 '待生效'。
      // 防止 NLP 漏写 status 导致预计行被默认成"已到账"误计入现金。
      const status = op.source === '预计' && !op.status ? '待生效' : (op.status || '已到账')
      return api.post('/transactions', {
        date: op.date, type: op.type, name: op.name, category: op.category,
        amount: op.amount, account: op.account, status,
        source: op.source || '用户输入', note: op.note,
      })
    }
    case 'transfer':
      return api.post('/transactions', {
        date: op.date, type: '转账', name: op.name, amount: op.amount,
        account: op.account, to_account: op.to_account, note: op.note,
      })
    case 'calibrate': {
      const account = accountStore.accounts.find(a => a.name === op.account)
      if (account) {
        return accountStore.calibrate(account.id, op.balance, op.date)
      }
      return accountStore.addAccount({
        name: op.account, kind: '电子', anchor_balance: op.balance, anchor_date: op.date, note: 'AI 校准创建',
      })
    }
    case 'delete_planned':
      return api.del(`/transactions/planned?name=${encodeURIComponent(op.name)}${op.from_date ? `&from=${op.from_date}` : ''}`)
    case 'delete_fixed': {
      const list = (await api.get('/fixed-expenses')).data
      const target = list.find(f => f.name === op.name)
      if (!target) return { success: true, skipped: '固定支出不存在' }
      return api.del(`/fixed-expenses/${target.id}?cleanupPlanned=1`)
    }
    case 'add_fixed':
      return api.post('/fixed-expenses', {
        name: op.name, amount: op.amount, cycle: op.cycle || '月付', method: op.method || '微信', note: op.note,
      })
    default:
      throw new Error(`不支持的操作类型：${op.op}`)
  }
}

async function confirmAdd() {
  const selected = parsedData.value.operations.filter(o => o.selected)
  if (!selected.length) return

  submitting.value = true
  doneCount.value = 0
  const errors = []
  try {
    for (const op of selected) {
      try {
        await executeOperation(op)
      } catch (e) {
        errors.push(`${op.name || op.op}：${e.message}`)
      }
      doneCount.value++
    }

    parsedData.value = null
    inputText.value = ''
    await Promise.all([store.fetchTransactions({ limit: 200 }), accountStore.fetchAccounts()])
    recentTransactions.value = store.transactions.slice(0, 10)

    if (errors.length) {
      alert(`完成，但有 ${errors.length} 项失败：\n${errors.join('\n')}`)
    } else {
      alert(`全部 ${selected.length} 项执行成功！`)
    }
  } finally {
    submitting.value = false
  }
}
</script>
