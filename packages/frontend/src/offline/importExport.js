/**
 * 离线版数据导入/导出
 * - 导出：将 IndexedDB 中 5 个集合全量打包为 JSON 并触发浏览器下载
 * - 导入：读取 JSON 文件，按集合 bulkReplace（保留既有 id），实现账本迁移与备份
 */
import * as idb from './idb'
import { genId } from './idb'

const STORES = ['transactions', 'accounts', 'fixed_expenses', 'utility_readings', 'liabilities']

export async function exportAll() {
  const data = {}
  for (const s of STORES) {
    data[s] = await idb.getAll(s)
  }
  const payload = {
    app: 'bill-bookkeeper',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bill-bookkeeper-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { count: STORES.reduce((n, s) => n + (data[s] || []).length, 0) }
}

export async function importAll(file) {
  const text = await file.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法的 JSON')
  }
  if (!payload || !payload.data) throw new Error('文件格式不正确：缺少 data 字段')

  let total = 0
  for (const s of STORES) {
    const arr = payload.data[s]
    if (!Array.isArray(arr)) continue
    // 合并键：accounts 用 name，其余用 sync_id（UUID）
    const conflictKey = s === 'accounts' ? 'name' : 'sync_id'
    const existing = await idb.getAll(s)
    const byKey = new Map(existing.map((r) => [r[conflictKey], r]))
    for (const raw of arr) {
      const row = { ...raw }
      if (row.id != null) delete row.id // 主键由本库自管
      if (!row.sync_id) row.sync_id = genId()
      const keyVal = row[conflictKey]
      const exist = keyVal != null ? byKey.get(keyVal) : undefined
      if (exist) {
        // 合并：以导入字段覆盖本地，保留本地 id 与合并键
        await idb.put(s, { ...exist, ...row, id: exist.id })
      } else {
        await idb.add(s, row)
      }
      total += 1
    }
  }
  return { count: total }
}
