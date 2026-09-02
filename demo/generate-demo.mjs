// 生成脱敏、通用化的演示数据集（bill-bookkeeper）
// 用法：node demo/generate-demo.mjs  ->  写出 demo/demo-data.json
//
// 设计原则：
//  - 全部为虚构人物「小账」的示例数据，不含任何真实个人财务信息
//  - 账户用标准名（微信/银行卡/现金/支付宝/岭南通），靠「重置→导入」保证干净
//  - 账户 anchor_balance=0、anchor_date=2026-06-30，使余额 = 全部交易净流（自动一致）
//  - 覆盖：收入/支出/转账/预计(source=预计,status=已到账)/待生效(status=待生效)/已取消(status=已取消)
//         固定支出(月付+年付)、水电读数(电/水)、负债
import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NOW = '2026-09-01 09:00:00'

// ---------- 交易 ----------
let _id = 0
const txns = []
function t(date, type, name, category, amount, account, opt = {}) {
  _id += 1
  txns.push({
    id: _id,
    date,
    type,
    name,
    category: category ?? null,
    amount,
    account: account ?? '微信',
    note: opt.note ?? '',
    source: opt.source ?? '用户输入',
    created_at: (opt.created_at ?? date) + ' 09:30:00',
    status: opt.status ?? '已到账',
    to_account: opt.to_account ?? null,
    sync_id: randomUUID(),
  })
}

// ===== 7 月（实际）=====
t('2026-07-01', '收入', '月度工资', '工资', 6000, '银行卡', { note: '单位代发' })
t('2026-07-01', '支出', '房租', '住房', 1300, '微信', { note: '月租' })
t('2026-07-02', '支出', '早餐', '餐饮', 6, '微信')
t('2026-07-02', '支出', '午餐', '餐饮', 18, '微信')
t('2026-07-02', '支出', '晚餐', '餐饮', 22, '微信')
t('2026-07-03', '支出', '地铁', '交通', 5, '岭南通')
t('2026-07-03', '支出', '饮料', '餐饮', 7, '微信')
t('2026-07-04', '收入', '兼职收入', '其他收入', 800, '微信', { note: '周末兼职' })
t('2026-07-05', '支出', '手机话费', '通讯', 59, '微信', { note: '每月固定' })
t('2026-07-06', '支出', '买菜', '餐饮', 35, '微信')
t('2026-07-07', '支出', '打车', '交通', 28, '微信', { note: '下雨打车' })
t('2026-07-08', '收入', '亲友红包', '其他收入', 200, '微信')
t('2026-07-09', '支出', '视频会员', '工具/会员', 25, '微信', { note: '月付' })
t('2026-07-10', '支出', '网购日用品', '购物', 120, '支付宝')
t('2026-07-11', '转账', '充值交通卡', null, 30, '微信', { to_account: '岭南通' })
t('2026-07-12', '支出', '公交', '交通', 5, '岭南通')
t('2026-07-13', '支出', 'KTV', '娱乐', 90, '微信', { note: '朋友聚会' })
t('2026-07-14', '支出', '晚餐', '餐饮', 26, '微信')
t('2026-07-15', '收入', '父母资助', '父母资助', 1500, '微信', { note: '月度资助' })
t('2026-07-16', '支出', '教材', '教育', 68, '微信')
t('2026-07-17', '支出', '感冒药', '医疗', 23, '微信')
t('2026-07-18', '支出', '晚餐', '餐饮', 19, '银行卡')
t('2026-07-19', '支出', '地铁', '交通', 5, '岭南通')
t('2026-07-20', '收入', '存款利息', '其他收入', 12, '银行卡')
t('2026-07-20', '收入', '长辈给零花钱', '其他收入', 300, '现金')
t('2026-07-21', '支出', '夏季衣物', '购物', 159, '支付宝')
t('2026-07-22', '支出', '宵夜', '餐饮', 15, '微信')
t('2026-07-23', '支出', 'VPN 会员', '工具/会员', 18, '微信', { note: '月付' })
t('2026-07-24', '支出', '电影', '娱乐', 45, '微信')
t('2026-07-25', '收入', '兼职收入', '其他收入', 400, '微信')
t('2026-07-26', '支出', '早餐', '餐饮', 5, '现金')
t('2026-07-27', '支出', '午餐', '餐饮', 16, '微信')
t('2026-07-28', '支出', '公交', '交通', 5, '岭南通')
t('2026-07-29', '支出', '零食', '餐饮', 9, '微信')
t('2026-07-30', '支出', '晚餐', '餐饮', 21, '微信')
t('2026-07-31', '支出', '水电费', '水电煤', 75, '微信', { note: '水+电合并' })
// 7 月误记一笔，已取消（用于演示「取消」）
t('2026-07-15', '支出', '冲动购物(已取消)', '购物', 299, '微信', { status: '已取消', note: '下单后退款' })

// ===== 8 月（实际）=====
t('2026-08-01', '收入', '月度工资', '工资', 6000, '银行卡')
t('2026-08-01', '支出', '房租', '住房', 1300, '微信')
t('2026-08-03', '支出', '早餐', '餐饮', 6, '微信')
t('2026-08-04', '支出', '午餐', '餐饮', 20, '微信')
t('2026-08-05', '收入', '奖学金', '其他收入', 2000, '银行卡', { note: '校级奖学金' })
t('2026-08-05', '支出', '晚餐', '餐饮', 24, '微信')
t('2026-08-06', '支出', '地铁', '交通', 5, '岭南通')
t('2026-08-07', '收入', '父母资助', '父母资助', 1500, '微信')
t('2026-08-08', '支出', '手机话费', '通讯', 59, '微信')
t('2026-08-09', '支出', '买菜', '餐饮', 40, '微信')
t('2026-08-10', '支出', '网购数码', '购物', 200, '支付宝')
t('2026-08-11', '转账', '充值交通卡', null, 20, '微信', { to_account: '岭南通' })
t('2026-08-12', '支出', '公交', '交通', 5, '岭南通')
t('2026-08-13', '支出', '视频会员', '工具/会员', 25, '微信')
t('2026-08-14', '支出', '打车', '交通', 32, '微信')
t('2026-08-15', '收入', '亲友红包', '其他收入', 100, '支付宝')
t('2026-08-16', '支出', '晚餐', '餐饮', 27, '微信')
t('2026-08-17', '支出', '教材', '教育', 55, '微信')
t('2026-08-18', '支出', '肠胃药', '医疗', 18, '微信')
t('2026-08-19', '支出', '宵夜', '餐饮', 14, '微信')
t('2026-08-20', '支出', 'VPN 会员', '工具/会员', 18, '微信')
t('2026-08-21', '支出', '电影', '娱乐', 45, '微信')
t('2026-08-22', '收入', '兼职收入', '其他收入', 500, '支付宝')
t('2026-08-23', '支出', '早餐', '餐饮', 5, '现金')
t('2026-08-24', '支出', '午餐', '餐饮', 17, '微信')
t('2026-08-25', '支出', '公交', '交通', 5, '岭南通')
t('2026-08-26', '支出', '零食', '餐饮', 8, '微信')
t('2026-08-27', '支出', '晚餐', '餐饮', 22, '微信')
t('2026-08-28', '支出', '意外险(年付)', '其他支出', 600, '银行卡', { note: '年度缴费' })
t('2026-08-29', '支出', '水电费', '水电煤', 80, '微信')
t('2026-08-30', '收入', '存款利息', '其他收入', 10, '银行卡')
t('2026-08-31', '支出', '秋冬衣物', '购物', 139, '支付宝')
t('2026-09-01', '收入', '网购退款', '其他收入', 50, '支付宝', { note: '退货退款' })

// ===== 9 月（实际，少量）=====
t('2026-09-01', '收入', '月度工资', '工资', 6000, '银行卡')
t('2026-09-01', '支出', '房租', '住房', 1300, '微信')
t('2026-09-02', '支出', '早餐', '餐饮', 6, '微信')
t('2026-09-02', '支出', '午餐', '餐饮', 19, '微信')
t('2026-09-03', '支出', '晚餐', '餐饮', 23, '微信')

// 生活费：银行卡每月转入微信用于日常开销（演示「转账」进/出相抵）
t('2026-07-01', '转账', '生活费转入', null, 2000, '银行卡', { to_account: '微信', note: '月度生活费' })
t('2026-08-01', '转账', '生活费转入', null, 2000, '银行卡', { to_account: '微信', note: '月度生活费' })
t('2026-09-01', '转账', '生活费转入', null, 2000, '银行卡', { to_account: '微信', note: '月度生活费' })

// ===== 预计（source=预计, status=已到账，计入统计/余额，演示「 upcoming」）=====
t('2026-09-30', '支出', '房租', '住房', 1300, '微信', { source: '预计' })
t('2026-09-30', '支出', '手机话费', '通讯', 59, '微信', { source: '预计' })
t('2026-09-30', '支出', '视频会员', '工具/会员', 25, '微信', { source: '预计' })
t('2026-10-01', '收入', '月度工资(预计)', '工资', 6000, '银行卡', { source: '预计' })
t('2026-10-01', '支出', '房租', '住房', 1300, '微信', { source: '预计' })
t('2026-10-05', '支出', 'VPN 会员', '工具/会员', 18, '微信', { source: '预计' })

// ===== 待生效（status=待生效，不计入，演示「计划确认」）=====
t('2026-09-15', '支出', '数码分期(2/3)', '购物', 199, '微信', { status: '待生效', note: '分期免息' })
t('2026-10-15', '支出', '数码分期(3/3)', '购物', 199, '微信', { status: '待生效', note: '分期免息' })

// ---------- 账户 ----------
const accounts = [
  { id: 1, name: '微信',   kind: '电子',   anchor_balance: 0, anchor_date: '2026-06-30', note: '', created_at: NOW, anchor_id: 0, sync_id: 'demo-acct-wechat' },
  { id: 2, name: '银行卡', kind: '银行卡', anchor_balance: 0, anchor_date: '2026-06-30', note: '', created_at: NOW, anchor_id: 0, sync_id: 'demo-acct-bank' },
  { id: 3, name: '现金',   kind: '现金',   anchor_balance: 0, anchor_date: '2026-06-30', note: '', created_at: NOW, anchor_id: 0, sync_id: 'demo-acct-cash' },
  { id: 4, name: '支付宝', kind: '电子',   anchor_balance: 0, anchor_date: '2026-06-30', note: '', created_at: NOW, anchor_id: 0, sync_id: 'demo-acct-alipay' },
  { id: 5, name: '岭南通', kind: '交通卡', anchor_balance: 0, anchor_date: '2026-06-30', note: '交通卡', created_at: NOW, anchor_id: 0, sync_id: 'demo-acct-lingnan' },
]

// ---------- 固定支出 ----------
const fixed_expenses = [
  { id: 1, name: '房租',     amount: 1300, cycle: '月付', method: '微信', note: '每月固定', created_at: NOW, sync_id: randomUUID() },
  { id: 2, name: '手机话费', amount: 59,   cycle: '月付', method: '微信', note: '每月固定', created_at: NOW, sync_id: randomUUID() },
  { id: 3, name: '视频会员', amount: 25,   cycle: '月付', method: '微信', note: '每月固定', created_at: NOW, sync_id: randomUUID() },
  { id: 4, name: '意外险',   amount: 600,  cycle: '年付', method: '银行卡', note: '年度缴费', created_at: NOW, sync_id: randomUUID() },
]

// ---------- 水电读数 ----------
const utility_readings = [
  { id: 1, type: 'electric', date: '2026-07-01', reading: 5232, price_per_unit: 0.89, usage: null, cost: null, note: '', created_at: NOW, sync_id: randomUUID() },
  { id: 2, type: 'electric', date: '2026-08-01', reading: 5480, price_per_unit: 0.89, usage: 248, cost: 220.72, note: '', created_at: NOW, sync_id: randomUUID() },
  { id: 3, type: 'electric', date: '2026-09-01', reading: 5716, price_per_unit: 0.89, usage: 236, cost: 210.04, note: '', created_at: NOW, sync_id: randomUUID() },
  { id: 4, type: 'water', date: '2026-07-01', reading: 209, price_per_unit: 5, usage: null, cost: null, note: '', created_at: NOW, sync_id: randomUUID() },
  { id: 5, type: 'water', date: '2026-08-01', reading: 213, price_per_unit: 5, usage: 4, cost: 20, note: '', created_at: NOW, sync_id: randomUUID() },
  { id: 6, type: 'water', date: '2026-09-01', reading: 218, price_per_unit: 5, usage: 5, cost: 25, note: '', created_at: NOW, sync_id: randomUUID() },
]

// ---------- 负债 ----------
const liabilities = [
  { id: 1, name: '信用卡(某银行)', amount: 4800, creditor: '某银行', due_date: '2026-09-15', rate: '0%', status: '未还', note: '本月账单', created_at: NOW, sync_id: randomUUID() },
  { id: 2, name: '消费分期(某平台)', amount: 3000, creditor: '某分期平台', due_date: '2026-10-01', rate: '0%', status: '未还', note: '12 期免息', created_at: NOW, sync_id: randomUUID() },
  { id: 3, name: '借朋友小王', amount: 2000, creditor: '小王', due_date: '无期限', rate: '0%', status: '未还', note: '无息', created_at: NOW, sync_id: randomUUID() },
  { id: 4, name: '装修贷', amount: 20000, creditor: '某银行', due_date: '毕业后', rate: '优惠利率', status: '未还', note: '低息', created_at: NOW, sync_id: randomUUID() },
]

const dataset = {
  app: 'bill-bookkeeper',
  version: 1,
  exportedAt: '2026-09-01T09:00:00.000Z',
  source: 'demo-seed',
  data: {
    transactions: txns,
    accounts,
    fixed_expenses,
    utility_readings,
    liabilities,
  },
}

const outPath = join(__dirname, 'demo-data.json')
writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf8')

// ---------- 自检：各账户余额（严格对齐 app 的 SQL 口径）----------
// 参考 packages/server/src/services/accountBalances.js
// balance = anchor_balance + flow + transferIn - transferOut
//   flow: 收入(+) 支出(-) 转账(0)
//   transferIn:  type=转账 且 to_account=本账户 的 amount 之和
//   transferOut: type=转账 且 account=本账户 的 amount 之和
// ACTIVE: 已取消 不计；source=预计 仅 status=已到账 计；其余仅 status 为 NULL 或 已到账 计
const ACTIVE = (r) => {
  if (r.status === '已取消') return false
  if (r.source === '预计') return r.status === '已到账'
  return r.status === null || r.status === '已到账'
}
const flow = {}, tIn = {}, tOut = {}
for (const r of txns) {
  if (!ACTIVE(r)) continue
  const sign = r.type === '收入' ? 1 : r.type === '支出' ? -1 : 0
  flow[r.account] = (flow[r.account] || 0) + sign * r.amount
  if (r.type === '转账' && r.to_account) {
    tIn[r.to_account] = (tIn[r.to_account] || 0) + r.amount
    tOut[r.account] = (tOut[r.account] || 0) + r.amount
  }
}
const bal = {}
for (const a of accounts) {
  const n = a.name
  const b = (a.anchor_balance || 0) + (flow[n] || 0) + (tIn[n] || 0) - (tOut[n] || 0)
  bal[n] = Math.round(b * 100) / 100
}
console.log('✅ 已生成', outPath)
console.log('   交易条数:', txns.length, '| 账户:', accounts.length, '| 固定支出:', fixed_expenses.length, '| 水电:', utility_readings.length, '| 负债:', liabilities.length)
console.log('   各账户演示余额(对齐 app 口径):')
for (const [k, v] of Object.entries(bal)) console.log(`     ${k}: ${v.toFixed(2)}`)
const neg = Object.entries(bal).filter(([, v]) => v < 0)
console.log(neg.length ? '   ⚠️ 存在负余额账户: ' + neg.map(([k]) => k).join(',') : '   ✅ 所有账户余额为正')
