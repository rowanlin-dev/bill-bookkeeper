/**
 * 离线本地规则记账解析（无 AI Key 时的回退）。
 * 对标 packages/frontend/src/offline/ruleParser.js（同一套规则，后端独立实现一份）。
 *
 * 输入：自由文本；输出：{ operations, summary }
 * operation 字段与在线版 NLPParser 同构，前端 executeOperation 可直接消费。
 *
 * 支持意图：
 *  - add（收入/支出）：如 "晚饭13" "饮料7" "工资5000"
 *  - transfer（转账/充值）：如 "充值岭南通20" "微信转支付宝100"
 *  - calibrate（余额校准）：如 "现在微信剩2156.33"
 *  - delete_fixed（取消固定支出）：如 "酷狗会员以后不每月扣了"
 */

const INCOME_KEYWORDS = [
  '工资',
  '收入',
  '收到',
  '到账',
  '报销',
  '退款',
  '返现',
  '利息',
  '兼职',
  '奖学金',
  '补助',
  '补贴',
  '分红',
  '收款',
  '收钱',
];

const CATEGORY_RULES = [
  ['餐饮', ['饭', '午饭', '午餐', '晚饭', '晚餐', '早餐', '早饭', '餐', '吃', '外卖', '零食', '饮料', '奶茶', '咖啡', '宵夜', '食堂', '聚餐']],
  ['交通', ['公交', '地铁', '打的', '打车', '出租', '高铁', '火车', '机票', '油', '停车', '岭南通', '充值', 'etc', 'ETC', '出行', '车票']],
  ['购物', ['买', '购', '淘宝', '京东', '拼多多', '衣服', '鞋', '包', '日用品', '超市']],
  ['娱乐', ['电影', '游戏', 'ktv', 'KTV', '唱', '视频', '网飞', '爱奇艺', '哔哩', 'b站', 'B站', '玩', '旅游', '演出']],
  ['住房', ['房租', '水电', '物业', '燃气', '居住', '住宿']],
  ['教育', ['书', '课', '培训', '学', '资料', '考试', '学费']],
  ['通讯', ['话费', '流量', '手机费', '宽带', '电话']],
  ['工具/会员', ['会员', 'vip', 'VIP', '订阅', '酷狗', '网易云', '网盘', '软件', 'app', 'App', '服务']],
  ['医疗', ['药', '医院', '看病', '诊', '体检', '诊所']],
  ['人情', ['红包', '礼', '份子', '随礼', '人情']],
];

const ACCOUNT_KEYWORDS = {
  微信: ['微信', 'wx', 'wechat'],
  支付宝: ['支付宝', 'zfb', 'alipay'],
  现金: ['现金', '钞票', '纸币'],
  岭南通: ['岭南通'],
  银行卡: ['银行卡', '储蓄卡'],
  信用卡: ['信用卡', '信用'],
};

// 「预计」语义：不计入现金，status 必须为待生效（见 nlpParser 状态铁律）
const ESTIMATE_PATTERN = /预计|预估|估计|大概(?:要|会)|下个月要|下个月将|还没扣|先用后付|待扣/;

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function extractAmount(text) {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function detectType(text) {
  return INCOME_KEYWORDS.some((k) => text.includes(k)) ? '收入' : '支出';
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_RULES) {
    if (kws.some((k) => lower.includes(k.toLowerCase()))) return cat;
  }
  return '其他支出';
}

function detectAccount(text) {
  const lower = text.toLowerCase();
  for (const [acc, kws] of Object.entries(ACCOUNT_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k.toLowerCase()))) return acc;
  }
  return null;
}

function cleanName(text) {
  return text
    .replace(/(\d+(?:\.\d+)?)/g, ' ')
    .replace(/[，,。；;、~～\s]+/g, ' ')
    .trim();
}

function parseSegment(seg) {
  const amount = extractAmount(seg);

  // 1) 余额校准：含 剩/余额/还有 等 且 有金额
  if (/(剩|余额|还有|结余)/.test(seg) && amount != null) {
    return { op: 'calibrate', account: detectAccount(seg) || '微信', balance: amount, date: todayIso() };
  }

  // 2) 转账：充值 X N
  const recharge = seg.match(/充值(.+?)\s*(\d+(?:\.\d+)?)/);
  if (recharge) {
    const to = recharge[1].trim() || '账户';
    return {
      op: 'transfer',
      name: `充值${to}`,
      amount: amount != null ? amount : parseFloat(recharge[2]),
      date: todayIso(),
      account: '微信', // 充值默认从微信转出
      to_account: to,
    };
  }

  // 转账：X 转(入/到/给) Y N
  const transfer = seg.match(/(\S+?)\s*转(?:入|到|给)?\s*(\S+?)\s*(\d+(?:\.\d+)?)/);
  if (transfer) {
    return {
      op: 'transfer',
      name: `${transfer[1]}转${transfer[2]}`,
      amount: parseFloat(transfer[3]),
      date: todayIso(),
      account: transfer[1],
      to_account: transfer[2],
    };
  }

  // 3) 取消固定支出：不每月 / 以后不 / 取消固定 / 别再
  if (/(不.{0,3}每月|以后不|取消固定|别再|停止|不再)/.test(seg)) {
    const name =
      seg
        .replace(/(以后不|不再|不每月|每月|扣了|取消固定|别再|停止|以后|自动|再|了|请|帮我|把)/g, '')
        .replace(/\s+/g, '')
        .trim() || '固定支出';
    return { op: 'delete_fixed', name, note: '已取消该固定支出（离线规则识别）' };
  }

  // 4) 收支（默认）
  if (amount == null) return null;
  const type = detectType(seg);
  const category = type === '收入' ? '其他收入' : detectCategory(seg);
  const account = detectAccount(seg) || '微信';
  const name = cleanName(seg) || category;
  const op = {
    op: 'add',
    type,
    name,
    amount,
    category,
    account,
    date: todayIso(),
  };

  // 状态铁律：含「预计」语义 → source 预计 + status 待生效；其余默认已到账
  if (ESTIMATE_PATTERN.test(seg)) {
    op.source = '预计';
    op.status = '待生效';
  } else {
    op.status = '已到账';
  }
  return op;
}

function describe(op) {
  switch (op.op) {
    case 'add':
      return `• [${op.type}] ${op.name} ¥${op.amount}（${op.category}｜${op.account}）`;
    case 'transfer':
      return `• [转账] ${op.account} → ${op.to_account} ¥${op.amount}`;
    case 'calibrate':
      return `• [校准] ${op.account} 余额 ¥${op.balance}`;
    case 'delete_fixed':
      return `• [移除固定支出] ${op.name}`;
    case 'add_fixed':
      return `• [固定支出] ${op.name} ¥${op.amount}`;
    case 'delete_planned':
      return `• [取消预计] ${op.name}`;
    default:
      return '• ' + JSON.stringify(op);
  }
}

function parse(text) {
  const ops = [];
  const lines = String(text || '')
    .split(/[\n。；;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const seg of line
      .split(/[，,、~～]+/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      const op = parseSegment(seg);
      if (op) ops.push(op);
    }
  }

  const summary = ops.length
    ? `已识别 ${ops.length} 项操作（离线规则解析）：\n${ops.map(describe).join('\n')}`
    : '未识别到记账信息，请检查输入格式（如：晚饭13，饮料7）。';

  return { operations: ops, summary };
}

module.exports = { parse };
