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

const isOffline = import.meta.env.VITE_OFFLINE === 'true'

const form = ref({ aiApiKey: '', aiModel: 'deepseek-chat' })
const loaded = ref(false)
const hasApiKey = ref(false)
const maskedKey = ref('')
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

onMounted(async () => {
  if (isOffline) return // 离线模式无需加载 server 配置
  try {
    const res = await api.get('/config')
    form.value.aiModel = res.data.aiModel || 'deepseek-chat'
    hasApiKey.value = res.data.hasApiKey
    maskedKey.value = res.data.aiApiKeyMasked
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
    const res = await api.put('/config', {
      aiModel: form.value.aiModel,
      aiApiKey: form.value.aiApiKey,
    })
    hasApiKey.value = res.data.hasApiKey
    maskedKey.value = res.data.aiApiKeyMasked
    form.value.aiApiKey = ''
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
</script>
