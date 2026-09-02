/**
 * 统一 API 客户端
 * - 在线模式：走相对路径 /api，由 vite proxy 转发到后端（见 vite.config.js）
 * - 离线模式（VITE_OFFLINE=true）：切换到 offlineApi，数据落地浏览器 IndexedDB，无需任何服务
 * 两套适配器对外暴露完全相同的 get/post/put/del 形态，stores/components 代码零改动。
 */
import { offlineApi } from '@/offline/api'

const isOffline = import.meta.env.VITE_OFFLINE === 'true'
const BASE = '/api'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('无法连接服务器，请确认后端已启动')
  }

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(`服务器响应异常（HTTP ${res.status}）`)
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `请求失败（HTTP ${res.status}）`)
  }
  return data
}

const httpApi = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
}

export const api = isOffline ? offlineApi : httpApi
