/**
 * IndexedDB 封装（离线版本地存储）
 * collections 与后端表对齐：transactions / accounts / fixed_expenses / utility_readings / liabilities
 * id 采用自增主键；导入时用 bulkReplace 直接写入既有 id，保证迁移一致。
 */
const DB_NAME = 'bill-bookkeeper-offline'
const DB_VERSION = 1
const STORES = ['transactions', 'accounts', 'fixed_expenses', 'utility_readings', 'liabilities']

let dbPromise = null

// 生成 UUID（使用 crypto.getRandomValues，可在 file:// 离线页直接运行，无需安全上下文）
export function genId() {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`
}

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id', autoIncrement: true })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function getStore(store, mode) {
  return openDB().then((db) => {
    const tx = db.transaction(store, mode)
    return { tx, os: tx.objectStore(store) }
  })
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getAll(store) {
  const { os } = await getStore(store, 'readonly')
  return reqToPromise(os.getAll())
}

export async function add(store, record) {
  const { os } = await getStore(store, 'readwrite')
  // record 不含 id 时由 autoIncrement 分配；含 id 时（如显式指定）沿用
  const id = await reqToPromise(os.add(record))
  return { id }
}

export async function put(store, record) {
  const { os } = await getStore(store, 'readwrite')
  await reqToPromise(os.put(record))
  return { success: true }
}

export async function get(store, id) {
  const { os } = await getStore(store, 'readonly')
  return reqToPromise(os.get(id))
}

export async function remove(store, id) {
  const { os } = await getStore(store, 'readwrite')
  await reqToPromise(os.delete(id))
  return { success: true }
}

export async function clear(store) {
  const { os } = await getStore(store, 'readwrite')
  await reqToPromise(os.clear())
  return { success: true }
}

// 全量替换某个集合（先清空再按既有 id 写入），用于导入
export async function bulkReplace(store, records) {
  const { tx, os } = await getStore(store, 'readwrite')
  os.clear()
  const puts = []
  for (const r of records || []) {
    puts.push(reqToPromise(os.put(r)))
  }
  await Promise.all(puts)
  await txDone(tx)
  return { success: true, count: (records || []).length }
}

// 批量新增（用于一次性多写，如导入后追加）
export async function bulkAdd(store, records) {
  const { tx, os } = await getStore(store, 'readwrite')
  const ids = []
  for (const r of records || []) {
    ids.push(await reqToPromise(os.add(r)))
  }
  await txDone(tx)
  return { ids }
}
