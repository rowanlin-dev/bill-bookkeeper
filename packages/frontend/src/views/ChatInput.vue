<template>
  <div class="max-w-2xl mx-auto">
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">🤖 AI 智能记账</h2>

      <!-- 输入框 -->
      <div class="space-y-4">
        <textarea
          v-model="inputText"
          placeholder="支持记账、转账、报余额、取消固定支出，例如：&#10;晚饭13，饮料7&#10;充值岭南通20（自动识别为转账）&#10;现在微信剩2156.33（自动校准余额）&#10;酷狗会员以后不每月扣了（自动取消固定支出）"
          class="w-full h-32 p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div class="flex gap-3">
          <button
            @click="parseText"
            :disabled="loading || !inputText.trim()"
            class="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ loading ? '解析中...' : 'AI 解析' }}
          </button>
          <button
            @click="inputText = ''"
            class="px-4 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50"
          >
            清空
          </button>
        </div>
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

const checkedCount = computed(() =>
  (parsedData.value?.operations || []).filter(o => o.selected).length
)

onMounted(async () => {
  await Promise.all([store.fetchTransactions({ limit: 200 }), accountStore.fetchAccounts()])
  recentTransactions.value = store.transactions.slice(0, 10)
})

async function parseText() {
  if (!inputText.value.trim()) return

  loading.value = true
  try {
    const result = await store.parseWithAI(inputText.value)
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
  } catch (e) {
    alert('解析失败：' + e.message)
  } finally {
    loading.value = false
  }
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
