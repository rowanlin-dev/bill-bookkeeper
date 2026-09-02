/**
 * 离线聚合逻辑：把后端 SQL 逻辑移植为纯 JS 数组运算。
 * 输入均为从 IndexedDB 读取的数组（与后端表对齐）。
 * 仅依赖纯 JS，无网络、无 Node 原生模块，可运行于浏览器（含 file://）。
 */

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function pad(n) {
  return String(n).padStart(2, '0')
}

// 本地日期 YYYY-MM-DD（与后端日期字符串格式一致，避免使用 UTC 的 toISOString）
export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 实际流水过滤：
// - 已取消：永远不计入
// - 预计（固定支出）：仅当已确认（status=已到账）才计入现金；未确认/已取消均不计入
// - 普通流水：status 为空或已到账 计入，待生效 等其它状态不计入
function isActive(t) {
  if (t.status === '已取消') return false
  if (t.source === '预计') return t.status === '已到账'
  if (t.status && t.status !== '已到账') return false
  return true
}

// 某条流水是否发生在锚点之后：(date>锚点日期) 或 (date=锚点日期 且 id>锚点ID)
function isAfterAnchor(t, anchorDate, anchorId) {
  if (!anchorDate) return true
  if (t.date > anchorDate) return true
  if (t.date === anchorDate && Number(t.id) > Number(anchorId || 0)) return true
  return false
}

/**
 * 账户余额（转账感知）
 * balance = 锚点余额 + 锚点日期之后净流（收入−支出+转入−转出）
 */
export function getAccountBalances(accounts, transactions) {
  return accounts.map((a) => {
    const anchorDate = a.anchor_date || '0000-00-00'
    const anchorId = a.anchor_id || 0
    const after = transactions.filter((t) => isAfterAnchor(t, anchorDate, anchorId))

    const flow = after
      .filter((t) => t.account === a.name && isActive(t))
      .reduce(
        (s, t) => s + (t.type === '收入' ? Number(t.amount) : t.type === '支出' ? -Number(t.amount) : 0),
        0
      )

    const transferIn = after
      .filter((t) => t.type === '转账' && t.to_account === a.name && isActive(t))
      .reduce((s, t) => s + Number(t.amount), 0)

    const transferOut = after
      .filter((t) => t.type === '转账' && t.account === a.name && isActive(t))
      .reduce((s, t) => s + Number(t.amount), 0)

    const balance = round2((Number(a.anchor_balance) || 0) + flow + transferIn - transferOut)
    return { ...a, balance }
  })
}

// 总现金 = 非信用类账户余额合计
export function getTotalCash(accountBalances) {
  return round2(
    accountBalances.filter((a) => a.kind !== '信用').reduce((s, a) => s + (a.balance || 0), 0)
  )
}

/**
 * 看板数据聚合
 * @param {Array} transactions
 * @param {Array} accounts
 * @param {Array} liabilities
 * @param {Array} fixedExpenses
 */
export function computeDashboard(transactions, accounts, liabilities, fixedExpenses) {
  const active = transactions.filter(isActive)

  const income = round2(active.filter((t) => t.type === '收入').reduce((s, t) => s + Number(t.amount), 0))
  const expense = round2(active.filter((t) => t.type === '支出').reduce((s, t) => s + Number(t.amount), 0))

  const accountBalances = getAccountBalances(accounts, transactions)
  const currentCash = getTotalCash(accountBalances)

  // 分类统计（支出）
  const catMap = new Map()
  for (const t of active) {
    if (t.type !== '支出' || t.category == null) continue
    catMap.set(t.category, round2((catMap.get(t.category) || 0) + Number(t.amount)))
  }
  const categories = [...catMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  // 日统计（近 30 天，倒序）
  const dailyMap = new Map()
  for (const t of active) {
    const cur = dailyMap.get(t.date) || { date: t.date, income: 0, expense: 0 }
    if (t.type === '收入') cur.income = round2(cur.income + Number(t.amount))
    if (t.type === '支出') cur.expense = round2(cur.expense + Number(t.amount))
    dailyMap.set(t.date, cur)
  }
  const daily = [...dailyMap.values()].sort((a, b) => (a.date < b.date ? 1 : b.date < a.date ? -1 : 0)).slice(0, 30)

  const liabSorted = [...(liabilities || [])].sort((a, b) => b.amount - a.amount)
  const personalLiab = round2(
    liabSorted
      .filter((l) => l.status !== '已还' && !(l.name || '').includes('助学贷款'))
      .reduce((s, l) => s + Number(l.amount), 0)
  )

  const monthlyFixed = round2((fixedExpenses || []).reduce((s, f) => s + Number(f.amount), 0))

  const pending = transactions
    .filter((t) => t.status === '待生效')
    .sort((a, b) => (a.date < b.date ? 1 : b.date < a.date ? -1 : 0))

  return {
    kpi: {
      currentCash,
      totalIncome: income,
      totalExpense: expense,
      monthlyFixed,
      personalLiabilities: personalLiab,
    },
    accounts: accountBalances,
    categories,
    daily,
    liabilities: liabSorted,
    fixedExpenses: fixedExpenses || [],
    pending,
  }
}

/**
 * 确定性现金流预测（不依赖 AI，转账感知）
 * @param {Array} transactions
 * @param {Array} accounts
 * @param {Array} fixedExpenses
 * @param {number} days
 */
export function computeForecast(transactions, accounts, fixedExpenses, days = 90) {
  days = Math.min(parseInt(days, 10) || 90, 365)
  const currentCash = getTotalCash(getAccountBalances(accounts, transactions))

  const today = new Date()
  const cutoff = isoDate(addDays(today, -30))

  const last30 = transactions.filter((t) => isActive(t) && t.date >= cutoff)
  const totalInc = last30.filter((t) => t.type === '收入').reduce((s, t) => s + Number(t.amount), 0)
  const totalExp = last30.filter((t) => t.type === '支出').reduce((s, t) => s + Number(t.amount), 0)
  const avgDailyIncome = round2(totalInc / 30)
  const avgDailyExpense = round2(totalExp / 30)
  const avgDailyNet = round2(avgDailyIncome - avgDailyExpense)

  // 近 30 天每日净额
  const netByDate = {}
  for (const t of last30) {
    const v = t.type === '收入' ? Number(t.amount) : t.type === '支出' ? -Number(t.amount) : 0
    netByDate[t.date] = round2((netByDate[t.date] || 0) + v)
  }

  // 历史曲线：从今天倒推 30 天
  const history = []
  let bal = currentCash
  for (let i = 0; i <= 30; i++) {
    const d = addDays(today, -i)
    const key = isoDate(d)
    history.unshift({ date: key, balance: round2(bal) })
    bal -= netByDate[key] || 0
  }

  // 预计收支事件（未来日期；排除已取消）：
  // - 已确认的预计（status=已到账）已计入当前现金，不再作为未来事件，避免重复计数
  // - 未确认的预计、待生效 仍作为未来事件参与预测
  const todayIsoStr = isoDate(today)
  const planned = transactions
    .filter((t) => {
      if (t.status === '已取消') return false
      if (t.date < todayIsoStr) return false
      if (t.source === '预计') return t.status !== '已到账'
      if (t.status === '待生效') return true
      return false
    })
    .sort((a, b) => (a.date < b.date ? -1 : b.date < a.date ? 1 : 0))
  const plannedByDate = {}
  for (const p of planned) (plannedByDate[p.date] = plannedByDate[p.date] || []).push(p)

  const monthlyFixed = round2((fixedExpenses || []).reduce((s, f) => s + Number(f.amount), 0))

  const forecast = []
  const events = []
  let fBal = currentCash
  let minBalance = currentCash
  let minDate = todayIsoStr
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, i)
    const key = isoDate(d)
    fBal += avgDailyNet
    if (d.getDate() === 1) fBal -= monthlyFixed
    for (const p of plannedByDate[key] || []) {
      const signed = p.type === '收入' ? Number(p.amount) : -Number(p.amount)
      fBal += signed
      events.push({ date: key, name: p.name, type: p.type, amount: Number(p.amount) })
    }
    fBal = round2(fBal)
    forecast.push({ date: key, balance: fBal })
    if (fBal < minBalance) {
      minBalance = fBal
      minDate = key
    }
  }

  return {
    currentCash: round2(currentCash),
    avgDailyIncome,
    avgDailyExpense,
    avgDailyNet,
    monthlyFixed,
    days,
    history,
    forecast,
    events,
    summary: {
      endBalance: forecast.length ? forecast[forecast.length - 1].balance : round2(currentCash),
      minBalance: round2(minBalance),
      minDate,
      risk: minBalance < 0,
    },
  }
}
