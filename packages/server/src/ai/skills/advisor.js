/**
 * Advisor: 支出分析与建议
 * 移植自 packages/ai/skills/bill/advisor.py：本地统计（本周支出/Top3 分类/待还负债）
 * + LLM 解读 + 无 Key 时的 generate_offline_advice 兜底。
 */
const { getAiSdk, getTextModel } = require('../client');

const SYSTEM_PROMPT = `你是一个温和的财务顾问。请基于用户的支出数据给出洞察和建议。

原则：
1. 只展示积极面，不指责
2. 建议要具体可操作
3. 语气像朋友聊天
4. 如果数据不足，诚实说明`;

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildAnalysis(context = {}) {
  const transactions = Array.isArray(context.transactions) ? context.transactions : [];
  const liabilities = Array.isArray(context.liabilities) ? context.liabilities : [];

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = isoDate(weekAgo);

  const weekExpenses = transactions.filter(
    (t) => t?.type === '支出' && (t?.date || '') >= weekStart && t?.source !== '预计',
  );

  const weekTotal = weekExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const weekDailyAvg = weekExpenses.length ? weekTotal / 7 : 0;

  const byCategory = new Map();
  for (const t of weekExpenses) {
    const cat = t.category || '';
    byCategory.set(cat, (byCategory.get(cat) || 0) + (Number(t.amount) || 0));
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return {
    week_total: Math.round(weekTotal * 100) / 100,
    week_daily_avg: Math.round(weekDailyAvg * 100) / 100,
    expense_count: weekExpenses.length,
    top_categories: topCategories,
    upcoming_liabilities: liabilities.filter((l) => l?.status !== '已还'),
  };
}

// 离线兜底（对应 advisor.py:generate_offline_advice）
function generateOfflineAdvice(data) {
  const lines = ['📊 本周支出分析', ''];
  lines.push(`本周共支出 ¥${data.week_total.toFixed(2)}，日均 ¥${data.week_daily_avg.toFixed(2)}`);

  if (data.top_categories.length) {
    const [cat, amt] = data.top_categories[0];
    lines.push(`\n主要支出：${cat} ¥${amt.toFixed(2)}`);
  }

  if (data.upcoming_liabilities.length) {
    lines.push(`\n⚠️ 待还负债 ${data.upcoming_liabilities.length} 笔`);
  }

  lines.push('\n💡 建议：');
  if (data.week_daily_avg > 100) {
    lines.push('- 日均支出偏高，建议控制非必要消费');
  } else {
    lines.push('- 支出控制在合理范围，继续保持');
  }
  lines.push('- 记录每笔支出，养成记账习惯');

  return lines.join('\n');
}

function buildUserPrompt(data) {
  const categories = data.top_categories.map(([cat, amt]) => `- ${cat}: ¥${amt.toFixed(2)}`).join('\n');
  const debts = data.upcoming_liabilities
    .map((l) => `- ${l.name || ''}: ¥${Number(l.amount) || 0}`)
    .join('\n');

  return `请分析我的本周支出：

本周支出：¥${data.week_total}（${data.expense_count}笔）
日均：¥${data.week_daily_avg}

主要分类：
${categories}

待还负债：
${debts}

请给出建议。`;
}

async function run({ context }) {
  const analysis = buildAnalysis(context);

  const model = await getTextModel();
  if (!model) {
    return {
      response: generateOfflineAdvice(analysis),
      actions: [{ type: 'advice', data: analysis }],
      model_used: 'local',
      tokens_used: 0,
    };
  }

  const { generateText } = await getAiSdk();
  const { text, usage } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(analysis) }],
  });

  return {
    response: text,
    actions: [{ type: 'advice', data: analysis }],
    model_used: model.modelId || 'deepseek-chat',
    tokens_used: usage?.totalTokens || 0,
  };
}

module.exports = { run, buildAnalysis, generateOfflineAdvice };
