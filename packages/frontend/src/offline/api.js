/**
 * 离线「API」：模拟后端 REST 行为，数据落地浏览器 IndexedDB。
 * 接口契约与在线版一致：返回 { success:true, data } 或 { success:true, response }，
 * 失败时抛出带中文信息的 Error（由 client.request 统一包装）。
 * stores / components 无需改动，仅依赖 client.api 的 get/post/put/del 形态。
 */
import * as idb from './idb'
import { genId } from './idb'
import { computeDashboard, computeForecast, getAccountBalances, todayIso } from './aggregates'
import { parse as ruleParse } from './ruleParser'

const ok = (data) => ({ success: true, data })
const okRes = (response) => ({ success: true, response })

async function loadAll() {
  const [transactions, accounts, fixedExpenses, utility, liabilities] = await Promise.all([
    idb.getAll('transactions'),
    idb.getAll('accounts'),
    idb.getAll('fixed_expenses'),
    idb.getAll('utility_readings'),
    idb.getAll('liabilities'),
  ])
  return { transactions, accounts, fixedExpenses, utility, liabilities }
}

// 规整交易记录（对齐后端默认值与校验）
function normalizeTransaction(b) {
  const t = {
    date: b.date,
    type: b.type,
    name: b.name || '',
    category: b.category || null,
    amount: Number(b.amount),
    account: b.account || '微信',
    to_account: b.to_account || null,
    note: b.note || '',
    source: b.source || '用户输入',
    status: b.status || '已到账',
    sync_id: genId(),
  }
  if (b.id != null) t.id = b.id
  if (!t.date || !t.type || t.amount == null || isNaN(t.amount)) {
    throw new Error('date/type/amount 为必填')
  }
  if (t.type === '转账') {
    if (!t.account || !t.to_account) throw new Error('转账必须提供 account（转出）和 to_account（转入）')
    if (t.account === t.to_account) throw new Error('转出与转入账户不能相同')
  }
  return t
}

// ============ GET ============
async function handleGet(path) {
  if (path === '/transactions' || path.startsWith('/transactions?')) {
    const rows = await idb.getAll('transactions')
    rows.sort((a, b) => (a.date < b.date ? 1 : b.date < a.date ? -1 : (b.id || 0) - (a.id || 0)))
    return ok(rows)
  }
  if (path === '/accounts') {
    const { transactions, accounts } = await loadAll()
    return ok(getAccountBalances(accounts, transactions))
  }
  if (path === '/dashboard') {
    const { transactions, accounts, liabilities, fixedExpenses } = await loadAll()
    return ok(computeDashboard(transactions, accounts, liabilities, fixedExpenses))
  }
  if (path.startsWith('/cashflow/forecast')) {
    const days = new URLSearchParams(path.split('?')[1] || '').get('days') || 90
    const { transactions, accounts, fixedExpenses } = await loadAll()
    return ok(computeForecast(transactions, accounts, fixedExpenses, days))
  }
  if (path === '/utility') {
    const rows = await idb.getAll('utility_readings')
    const asc = [...rows].sort((a, b) => (a.date < b.date ? -1 : b.date < a.date ? 1 : (a.id || 0) - (b.id || 0)))
    const lastByType = {}
    const enriched = []
    for (const row of asc) {
      const r = { ...row }
      const prev = lastByType[r.type]
      if (prev) {
        r.usage = r.reading - prev.reading
        r.cost = r.usage * (r.price_per_unit || 0)
        r.days_diff = Math.round((new Date(r.date) - new Date(prev.date)) / 86400000)
        r.daily_avg = r.days_diff > 0 ? Number((r.usage / r.days_diff).toFixed(2)) : null
      } else {
        r.usage = null
        r.cost = null
        r.days_diff = null
        r.daily_avg = null
      }
      lastByType[r.type] = r
      enriched.push(r)
    }
    return ok(enriched.reverse())
  }
  if (path === '/fixed-expenses') {
    const rows = await idb.getAll('fixed_expenses')
    rows.sort((a, b) => b.amount - a.amount)
    return ok(rows)
  }
  if (path === '/config') {
    return ok({ aiModel: 'offline', hasApiKey: false, aiApiKeyMasked: '' })
  }
  if (path === '/system/status') return ok([])
  if (path === '/system/autostart') return ok({ enabled: false })
  if (path === '/system/logs') return ok({ content: '离线模式无日志' })
  throw new Error('离线版不支持该请求：' + path)
}

// ============ POST ============
async function handlePost(path, body) {
  body = body || {}
  if (path === '/transactions') {
    const rec = normalizeTransaction(body)
    const { id } = await idb.add('transactions', rec)
    return ok({ id })
  }
  if (path === '/accounts') {
    if (!body.name) throw new Error('账户名不能为空')
    const rec = {
      name: body.name,
      kind: body.kind || '电子',
      anchor_balance: Number(body.anchor_balance) || 0,
      anchor_date: body.anchor_date || null,
      anchor_id: Number(body.anchor_id) || 0,
      note: body.note || '',
      sync_id: genId(),
    }
    const { id } = await idb.add('accounts', rec)
    return ok({ id })
  }
  if (path === '/utility' || path === '/utility/readings') {
    const prev = (await idb.getAll('utility_readings'))
      .filter((r) => r.type === body.type)
      .sort((a, b) => (a.date < b.date ? 1 : b.date < a.date ? -1 : 0))[0]
    let usage = null
    let cost = null
    if (prev) {
      usage = body.reading - prev.reading
      cost = usage * (body.price_per_unit || 0)
    }
    const rec = {
      type: body.type,
      date: body.date,
      reading: Number(body.reading),
      price_per_unit: Number(body.price_per_unit) || 0,
      usage,
      cost,
      note: body.note || '',
      sync_id: genId(),
    }
    const { id } = await idb.add('utility_readings', rec)
    return ok({ id, usage, cost })
  }
  if (path === '/fixed-expenses') {
    const rec = {
      name: body.name,
      amount: Number(body.amount),
      cycle: body.cycle || '月付',
      method: body.method || '微信',
      note: body.note || '',
      sync_id: genId(),
    }
    const { id } = await idb.add('fixed_expenses', rec)
    return ok({ id })
  }
  if (path === '/ai/chat') {
    const skill = body.skill
    const text = (body.messages && body.messages[0] && body.messages[0].content) || ''
    if (skill === 'NLPParser') {
      return okRes(JSON.stringify(ruleParse(text)))
    }
    if (skill === 'Forecast') return okRes(offlineForecastAnalysis(text))
    if (skill === 'Simulator') return okRes(offlineSimulate(text))
    return okRes('离线版不支持该 AI 技能（' + skill + '），请使用在线版获得 AI 能力。')
  }
  if (path === '/config') return ok({ hasApiKey: false, aiApiKeyMasked: '' })
  if (path === '/system/restart') return ok({})
  if (path === '/system/autostart') return ok({})
  throw new Error('离线版不支持该请求：' + path)
}

// ============ PUT ============
async function handlePut(path, body) {
  body = body || {}

  let m = path.match(/^\/accounts\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const existing = await idb.get('accounts', id)
    if (!existing) throw new Error('账户不存在')
    let anchorId = existing.anchor_id || 0
    if (body.anchor_balance !== undefined || body.anchor_date !== undefined) {
      const all = await idb.getAll('transactions')
      anchorId = all.reduce((mx, t) => Math.max(mx, Number(t.id) || 0), 0)
    }
    const rec = {
      ...existing,
      id,
      name: body.name ?? existing.name,
      kind: body.kind ?? existing.kind,
      anchor_balance: body.anchor_balance ?? existing.anchor_balance,
      anchor_date: body.anchor_date ?? existing.anchor_date,
      anchor_id: anchorId,
      note: body.note ?? existing.note,
    }
    await idb.put('accounts', rec)
    return ok({})
  }

  m = path.match(/^\/transactions\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const existing = await idb.get('transactions', id)
    if (!existing) throw new Error('记录不存在')
    const fields = ['date', 'type', 'name', 'category', 'amount', 'account', 'to_account', 'note', 'source', 'status']
    const rec = { ...existing, id }
    let has = false
    for (const f of fields) {
      if (body[f] !== undefined) {
        rec[f] = body[f]
        has = true
      }
    }
    if (!has) throw new Error('没有要更新的字段')
    await idb.put('transactions', rec)
    return ok({})
  }

  m = path.match(/^\/fixed-expenses\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const existing = await idb.get('fixed_expenses', id)
    if (!existing) throw new Error('记录不存在')
    const fields = ['name', 'amount', 'cycle', 'method', 'note']
    const rec = { ...existing, id }
    let has = false
    for (const f of fields) {
      if (body[f] !== undefined) {
        rec[f] = body[f]
        has = true
      }
    }
    if (!has) throw new Error('没有要更新的字段')
    await idb.put('fixed_expenses', rec)
    return ok({})
  }

  throw new Error('离线版不支持该请求：' + path)
}

// ============ DELETE ============
async function handleDelete(path) {
  let m = path.match(/^\/transactions\/planned/)
  if (m) {
    const q = new URLSearchParams(path.split('?')[1] || '')
    const name = q.get('name')
    if (!name) throw new Error('缺少 name 参数')
    const from = q.get('from')
    const all = await idb.getAll('transactions')
    const toDel = all.filter((t) => t.source === '预计' && t.name === name && (!from || t.date >= from))
    for (const t of toDel) await idb.remove('transactions', t.id)
    return ok({ deleted: toDel.length })
  }

  m = path.match(/^\/transactions\/(\d+)$/)
  if (m) {
    await idb.remove('transactions', Number(m[1]))
    return ok({})
  }

  m = path.match(/^\/accounts\/(\d+)$/)
  if (m) {
    await idb.remove('accounts', Number(m[1]))
    return ok({})
  }

  m = path.match(/^\/fixed-expenses\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const existing = await idb.get('fixed_expenses', id)
    if (!existing) throw new Error('记录不存在')
    await idb.remove('fixed_expenses', id)
    const q = new URLSearchParams(path.split('?')[1] || '')
    let deletedPlanned = 0
    if (q.get('cleanupPlanned') === '1') {
      const all = await idb.getAll('transactions')
      const todayStr = todayIso()
      const toDel = all.filter((t) => t.source === '预计' && t.name === existing.name && t.date >= todayStr)
      for (const t of toDel) await idb.remove('transactions', t.id)
      deletedPlanned = toDel.length
    }
    return ok({ deletedPlanned })
  }

  throw new Error('离线版不支持该请求：' + path)
}

// 离线版现金流解读（确定性文本，无 AI）
function offlineForecastAnalysis(snapshot) {
  const balMatch = String(snapshot || '').match(/当前现金：¥([\d.]+)/)
  const endMatch = String(snapshot || '').match(/预测期末余额：¥([\d.]+)/)
  const minMatch = String(snapshot || '').match(/最低余额：¥([-\d.]+)（([\d-]+)）/)
  const cur = balMatch ? Number(balMatch[1]) : 0
  const end = endMatch ? Number(endMatch[1]) : cur
  const delta = end - cur
  const lines = []
  lines.push('📊 离线现金流解读（基于本地规则，无 AI）：')
  lines.push(
    `• 当前现金约 ¥${cur.toFixed(2)}，预测期末约 ¥${end.toFixed(2)}，期间净变化 ${delta >= 0 ? '+' : ''}¥${delta.toFixed(2)}。`
  )
  if (minMatch && Number(minMatch[1]) < 0) {
    lines.push(`• ⚠️ 预测期内可能出现负余额（最低约 ¥${minMatch[1]} 于 ${minMatch[2]}），建议提前预留资金或压缩固定支出。`)
  } else {
    lines.push('• 预测期内余额始终为正，现金流健康。')
  }
  lines.push('• 提示：以上为按近 30 天日均净额的线性外推，不含突发大额支出，仅供参考。')
  return lines.join('\n')
}

// 离线版情景模拟（规则估算，无 AI）
function offlineSimulate(text) {
  const nums = String(text || '').match(/(\d+(?:\.\d+)?)/g) || []
  const amt = nums.length ? Number(nums[0]) : 0
  return (
    '🧮 离线模拟（规则估算，无 AI）：\n' +
    `• 你描述的金额约 ¥${amt}。\n` +
    '• 在「现金流」页可查看该笔收支对未来余额曲线的实际影响（请先以"预计"形式记账后查看预测）。\n' +
    '• 离线版不调用 AI，无法做复杂情景推演，建议联网版获得更智能的模拟。'
  )
}

export const offlineApi = {
  async get(path) {
    return handleGet(path)
  },
  async post(path, body) {
    return handlePost(path, body || {})
  },
  async put(path, body) {
    return handlePut(path, body || {})
  },
  async del(path) {
    return handleDelete(path)
  },
}
