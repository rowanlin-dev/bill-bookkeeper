<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <h2 class="text-xl font-bold text-gray-800">⚙️ 设置</h2>

    <!-- 模式标识 -->
    <div v-if="isOffline" class="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
      🟢 当前为<strong>离线模式</strong>：所有数据保存在本机浏览器（IndexedDB），双击 HTML 即可使用，无需启动任何服务。
    </div>
    <div v-else class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
      💡 当前为<strong>在线模式</strong>：数据由后端服务与数据库统一管理。
    </div>

    <!-- 在线：账本数据导出/导入 -->
    <div v-if="!isOffline" class="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h3 class="font-medium text-gray-700 mb-2">📦 账本数据</h3>
        <p class="text-sm text-gray-500 leading-relaxed">
          导出：将当前在线账本（5 张表）存为 JSON 文件，可在离线版「设置 → 导入账本」中导入，实现账本迁移或备份。<br />
          导入：选择一份导出的 JSON（可来自在线版或离线版），按 <code>sync_id</code> 合并进在线库——已存在的更新、不存在的插入，不会删除在线已有数据。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="doOnlineExport"
          class="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          ⬇️ 导出账本（JSON）
        </button>
        <button
          @click="triggerOnlineImport"
          class="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700"
        >
          ⬆️ 导入账本（JSON）
        </button>
        <input ref="onlineFileInput" type="file" accept="application/json" class="hidden" @change="onOnlineFile" />
      </div>
      <p v-if="onlineMsg" class="text-sm" :class="onlineOk ? 'text-green-600' : 'text-red-600'">{{ onlineMsg }}</p>
    </div>

    <!-- 在线：演示数据 / 一键重置 -->
    <div v-if="!isOffline" class="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h3 class="font-medium text-gray-700 mb-2">🎬 演示数据</h3>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-3">
          ⚠️ 演示数据仅用于<strong>项目演示</strong>，不含任何真实财务信息，<strong>请勿用于真实记账</strong>。若误导入，可点击下方「重置所有数据」一键清空恢复初始状态。
        </div>
        <p class="text-sm text-gray-500 leading-relaxed">
          一键加载内置脱敏演示账本，自动<strong>先清空当前数据再导入</strong>，保证干净。覆盖收入 / 支出 / 转账 / 预计 / 待生效 / 已取消等全部使用场景。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="loadDemo"
          :disabled="loadingDemo"
          class="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {{ loadingDemo ? '加载中...' : '🎬 加载演示数据' }}
        </button>
      </div>
      <p v-if="demoMsg" class="text-sm" :class="demoOk ? 'text-green-600' : 'text-red-600'">{{ demoMsg }}</p>

      <!-- 危险操作区 -->
      <div class="pt-4 border-t border-red-100">
        <h4 class="font-medium text-red-600 mb-2">🗑️ 危险操作区</h4>
        <p class="text-sm text-gray-500 mb-3">
          将<strong>永久清空</strong>所有账本数据（交易 / 账户 / 固定支出 / 水电 / 负债），并恢复 5 个默认账户。此操作<strong>不可撤销</strong>。
        </p>
        <button
          @click="resetAll"
          :disabled="loadingReset"
          class="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {{ loadingReset ? '重置中...' : '🗑️ 重置所有数据' }}
        </button>
      </div>
    </div>

    <!-- 离线：本地数据管理 -->
    <div v-if="isOffline" class="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h3 class="font-medium text-gray-700 mb-2">📦 本地数据管理</h3>
        <p class="text-sm text-gray-500 leading-relaxed">
          数据仅存于当前浏览器。建议定期导出备份；导出的 JSON 可在重新打开本文件或在线版中导入，实现账本迁移。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="doExport"
          class="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          ⬇️ 导出现有账本
        </button>
        <button
          @click="triggerImport"
          class="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700"
        >
          ⬆️ 导入账本（JSON）
        </button>
        <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="onFile" />
      </div>
      <p v-if="ioMsg" class="text-sm" :class="ioOk ? 'text-green-600' : 'text-red-600'">{{ ioMsg }}</p>
    </div>

    <!-- 在线：AI 配置 -->
    <div v-if="!isOffline" class="bg-white rounded-xl shadow-sm p-6 space-y-6">
      <div>
        <h3 class="font-medium text-gray-700 mb-3">AI 配置</h3>

        <div v-if="loaded" class="mb-4 text-sm">
          <span v-if="hasApiKey" class="px-2 py-1 bg-green-100 text-green-700 rounded">
            ✅ 已配置（{{ maskedKey }}）
          </span>
          <span v-else class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
            ⚠️ 未配置 API Key，AI 功能不可用
          </span>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm text-gray-600 mb-1">API Key</label>
            <input
              type="password"
              v-model="form.aiApiKey"
              class="w-full border rounded-lg px-3 py-2"
              :placeholder="hasApiKey ? '已保存，输入新 Key 可替换' : '输入 Deepseek API Key'"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">模型</label>
            <select v-model="form.aiModel" class="w-full border rounded-lg px-3 py-2">
              <option value="deepseek-chat">deepseek-chat</option>
              <option value="deepseek-reasoner">deepseek-reasoner</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 视觉模型配置 -->
      <div class="pt-4 border-t">
        <div>
          <h3 class="font-medium text-gray-700 mb-3">视觉模型配置</h3>
          <p class="text-sm text-gray-500 leading-relaxed mb-3">
            用于「图片记账」：上传账单 / 付款截图后，由视觉模型识别为记账条目。
            智谱开放平台提供免费视觉模型，注册 open.bigmodel.cn 即可获取 Key。
          </p>

          <div v-if="loaded" class="mb-4 text-sm">
            <span v-if="hasVisionApiKey" class="px-2 py-1 bg-green-100 text-green-700 rounded">
              ✅ 已配置（{{ maskedVisionKey }}）
            </span>
            <span v-else class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
              ⚠️ 未配置视觉模型 Key，图片记账不可用
            </span>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-sm text-gray-600 mb-1">VISION_API_KEY</label>
              <input
                type="password"
                v-model="form.visionApiKey"
                class="w-full border rounded-lg px-3 py-2"
                :placeholder="hasVisionApiKey ? '已保存，输入新 Key 可替换' : '输入智谱 API Key'"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">VISION_MODEL</label>
              <select v-model="form.visionModel" class="w-full border rounded-lg px-3 py-2">
                <option value="glm-4.6v-flash">glm-4.6v-flash</option>
                <option value="glm-4.1v-thinking-flash">glm-4.1v-thinking-flash</option>
                <option value="glm-4v-flash">glm-4v-flash</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-4 border-t flex items-center gap-3">
        <button
          @click="saveConfig"
          :disabled="saving"
          class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
        <span v-if="message" class="text-sm" :class="messageOk ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </span>
      </div>
    </div>

    <!-- 在线：系统控制台 -->
    <div v-if="!isOffline" class="bg-white rounded-xl shadow-sm p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h3 class="font-medium text-gray-700">🖥️ 系统控制台</h3>
        <button @click="loadStatus" class="text-sm text-blue-500 hover:text-blue-700">刷新状态</button>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div
          v-for="s in services"
          :key="s.key"
          class="border rounded-lg p-3 text-center"
        >
          <div class="text-2xl">{{ s.running ? '🟢' : '🔴' }}</div>
          <div class="text-sm font-medium text-gray-700 mt-1">{{ s.name }}</div>
          <div class="text-xs text-gray-400">:{{ s.port }}{{ s.pid ? ` · PID ${s.pid}` : '' }}</div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="restartAll"
          :disabled="restarting"
          class="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
        >
          {{ restarting ? '重启中，请稍候...' : '🔁 重启全部服务' }}
        </button>

        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" :checked="autostart" @change="toggleAutostart" class="w-4 h-4" />
          开机自动启动
        </label>
      </div>
      <p v-if="systemMsg" class="text-sm" :class="systemMsgOk ? 'text-green-600' : 'text-red-600'">{{ systemMsg }}</p>

      <div>
        <div class="flex items-center gap-2 mb-2">
          <select v-model="logService" @change="loadLogs" class="border rounded-lg px-2 py-1.5 text-sm">
            <option value="server">后端服务</option>
            <option value="ai-service">AI 服务</option>
            <option value="frontend">前端界面</option>
          </select>
          <button @click="loadLogs" class="text-sm text-blue-500 hover:text-blue-700">刷新日志</button>
        </div>
        <pre class="bg-gray-900 text-gray-200 text-xs rounded-lg p-3 h-48 overflow-auto whitespace-pre-wrap">{{ logContent || '点击"刷新日志"查看' }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/client'
import { exportAll, importAll } from '../offline/importExport'
import { useAccountStore } from '../stores/accounts'
import { useTransactionStore } from '../stores/transactions'
import { useDashboardStore } from '../stores/dashboard'
import { useUtilityStore } from '../stores/utility'
import { useCashflowStore } from '../stores/cashflow'

const isOffline = import.meta.env.VITE_OFFLINE === 'true'

const form = ref({ aiApiKey: '', aiModel: 'deepseek-chat', visionApiKey: '', visionModel: 'glm-4.6v-flash' })
const loaded = ref(false)
const hasApiKey = ref(false)
const maskedKey = ref('')
const hasVisionApiKey = ref(false)
const maskedVisionKey = ref('')
const saving = ref(false)
const message = ref('')
const messageOk = ref(true)

const services = ref([])
const restarting = ref(false)
const autostart = ref(false)
const systemMsg = ref('')
const systemMsgOk = ref(true)
const logService = ref('server')
const logContent = ref('')

// 离线：导入导出
const fileInput = ref(null)
const ioMsg = ref('')
const ioOk = ref(true)

// 在线：导出账本
const onlineMsg = ref('')
const onlineOk = ref(true)
const onlineFileInput = ref(null)

// 演示数据 / 重置
const loadingDemo = ref(false)
const demoMsg = ref('')
const demoOk = ref(true)
const loadingReset = ref(false)

onMounted(async () => {
  if (isOffline) return // 离线模式无需加载 server 配置
  try {
    const res = await api.get('/config')
    form.value.aiModel = res.data.aiModel || 'deepseek-chat'
    hasApiKey.value = res.data.hasApiKey
    maskedKey.value = res.data.aiApiKeyMasked
    form.value.visionModel = res.data.visionModel || 'glm-4.6v-flash'
    hasVisionApiKey.value = !!res.data.hasVisionApiKey
    maskedVisionKey.value = res.data.visionApiKeyMasked || ''
    loaded.value = true
  } catch (e) {
    message.value = '配置加载失败：' + e.message
    messageOk.value = false
  }
  loadStatus()
  loadAutostart()
})

async function saveConfig() {
  saving.value = true
  message.value = ''
  try {
    const payload = { aiModel: form.value.aiModel, aiApiKey: form.value.aiApiKey }
    // 视觉配置留空表示不修改，避免误清空已保存的 Key
    if (form.value.visionModel) payload.visionModel = form.value.visionModel
    if (form.value.visionApiKey) payload.visionApiKey = form.value.visionApiKey
    const res = await api.put('/config', payload)
    hasApiKey.value = res.data.hasApiKey
    maskedKey.value = res.data.aiApiKeyMasked
    hasVisionApiKey.value = !!res.data.hasVisionApiKey
    maskedVisionKey.value = res.data.visionApiKeyMasked || (hasVisionApiKey.value ? maskedVisionKey.value : '')
    form.value.aiApiKey = ''
    form.value.visionApiKey = ''
    message.value = '配置已保存'
    messageOk.value = true
  } catch (e) {
    message.value = '保存失败：' + e.message
    messageOk.value = false
  } finally {
    saving.value = false
  }
}

async function loadStatus() {
  try {
    const res = await api.get('/system/status')
    services.value = res.data
  } catch { /* 服务不可达时保持现状 */ }
}

async function loadAutostart() {
  try {
    const res = await api.get('/system/autostart')
    autostart.value = res.data.enabled
  } catch { /* ignore */ }
}

async function toggleAutostart(e) {
  const enabled = e.target.checked
  try {
    await api.post('/system/autostart', { enabled })
    autostart.value = enabled
    systemMsg.value = enabled ? '✅ 已开启开机自启动（登录 Windows 时自动拉起服务）' : '已关闭开机自启动'
    systemMsgOk.value = true
  } catch (err) {
    systemMsg.value = '设置失败：' + err.message
    systemMsgOk.value = false
    e.target.checked = !enabled
  }
}

async function restartAll() {
  if (!confirm('确定重启全部服务？页面会短暂失联，约 10 秒后自动刷新。')) return
  restarting.value = true
  systemMsg.value = ''
  try {
    await api.post('/system/restart')
  } catch { /* 重启过程中连接中断属正常 */ }
  setTimeout(() => location.reload(), 10000)
}

async function loadLogs() {
  try {
    const res = await api.get(`/system/logs?service=${logService.value}&lines=100`)
    logContent.value = res.data.content
  } catch (e) {
    logContent.value = '日志加载失败：' + e.message
  }
}

// ===== 离线导入/导出 =====
async function doExport() {
  ioMsg.value = ''
  try {
    const r = await exportAll()
    ioOk.value = true
    ioMsg.value = `已导出 ${r.count} 条记录。`
  } catch (e) {
    ioOk.value = false
    ioMsg.value = '导出失败：' + e.message
  }
}

function triggerImport() {
  fileInput.value?.click()
}

async function onFile(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  ioMsg.value = ''
  try {
    const r = await importAll(file)
    ioOk.value = true
    ioMsg.value = `导入成功，共写入 ${r.count} 条记录。刷新其他页面即可看到数据。`
  } catch (err) {
    ioOk.value = false
    ioMsg.value = '导入失败：' + err.message
  } finally {
    e.target.value = ''
  }
}

// 在线：导出账本为 JSON（供离线版「导入账本」消费）
async function doOnlineExport() {
  onlineMsg.value = ''
  try {
    const res = await fetch('/api/export')
    if (!res.ok) throw new Error('导出失败（HTTP ' + res.status + '）')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const disp = res.headers.get('Content-Disposition') || ''
    const m = disp.match(/filename="?([^"]+)"?/)
    a.download = m ? m[1] : `bill-bookkeeper-${new Date().toISOString().slice(0, 10)}.json`
    a.href = url
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    onlineOk.value = true
    onlineMsg.value = '已导出账本 JSON，可直接在离线版「设置 → 导入账本」中导入。'
  } catch (e) {
    onlineOk.value = false
    onlineMsg.value = '导出失败：' + e.message
  }
}

// 在线：导入账本（合并进在线 SQLite，按 sync_id / accounts.name upsert）
function triggerOnlineImport() {
  onlineFileInput.value?.click()
}

async function onOnlineFile(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  onlineMsg.value = ''
  try {
    const text = await file.text()
    const payload = JSON.parse(text)
    if (!payload || !payload.data) throw new Error('文件格式不正确：缺少 data 字段')
    const res = await api.post('/import', payload)
    onlineOk.value = true
    const r = (res && res.report) || {}
    const parts = Object.keys(r)
      .map((k) => `${k}: 新增${r[k].inserted || 0}/更新${r[k].updated || 0}${r[k].errors ? '/失败' + r[k].errors : ''}`)
      .join('  ')
    onlineMsg.value = `导入完成（合并模式）：${parts}`
  } catch (err) {
    onlineOk.value = false
    onlineMsg.value = '导入失败：' + err.message
  } finally {
    e.target.value = ''
  }
}

// 刷新所有相关 store，使各页面立即反映最新数据
async function refreshAllStores() {
  await Promise.all([
    useAccountStore().fetchAccounts(),
    useTransactionStore().fetchTransactions({ limit: 200 }),
    useDashboardStore().fetchDashboard(),
    useUtilityStore().fetchReadings(),
    useCashflowStore().fetchForecast(90),
  ])
}

// 加载内置脱敏演示数据：先重置（清空+恢复默认账户），再拉取并导入演示账本
async function loadDemo() {
  if (!confirm('加载演示数据会先清空当前账本、再导入脱敏示例数据，确定继续？\n（真实数据请提前用「导出账本」备份）')) return
  loadingDemo.value = true
  demoMsg.value = ''
  try {
    await api.post('/data/reset', { confirm: 'RESET' })
    const demo = await api.get('/data/demo')
    if (!demo || !demo.data) throw new Error('演示数据格式异常')
    const res = await api.post('/import', { data: demo.data })
    await refreshAllStores()
    demoOk.value = true
    const r = (res && res.report) || {}
    const parts = Object.keys(r)
      .map((k) => `${k}: 新增${r[k].inserted || 0}/更新${r[k].updated || 0}`)
      .join('  ')
    demoMsg.value = `✅ 演示数据已加载（${parts}）。可在首页 / 流水 / 仪表盘查看效果。`
  } catch (e) {
    demoOk.value = false
    demoMsg.value = '加载失败：' + e.message
  } finally {
    loadingDemo.value = false
  }
}

// 一键重置所有数据（清空 5 表 + 恢复 5 默认账户）
async function resetAll() {
  if (!confirm('⚠️ 确定重置所有数据？全部账本将被永久清空，仅保留 5 个默认账户！')) return
  if (!confirm('再次确认：此操作不可撤销，确定继续？')) return
  loadingReset.value = true
  demoMsg.value = ''
  try {
    await api.post('/data/reset', { confirm: 'RESET' })
    await refreshAllStores()
    demoOk.value = true
    demoMsg.value = '✅ 已重置：所有数据已清空，恢复 5 个默认账户（微信/银行卡/现金/支付宝/岭南通）。'
  } catch (e) {
    demoOk.value = false
    demoMsg.value = '重置失败：' + e.message
  } finally {
    loadingReset.value = false
  }
}
</script>
