/**
 * Forecast: 现金流预测解读
 * 移植自 packages/ai/skills/bill/forecast.py（纯文本返回，消息构造保持一致）。
 */
const { getAiSdk, getTextModel } = require('../client');

const SYSTEM_PROMPT = `你是一位个人财务分析师。用户会给你他/她的现金流数据快照（当前现金、日均支出、每月固定支出、未来预测余额、预计收支事件、负债等）。

请输出：
1. 现金流健康状况判断（1 句话）
2. 未来风险点：按时间顺序指出具体日期和金额缺口；如果没有风险，明确说"未来 90 天无断粮风险"
3. 3 条可执行建议（具体、量化、贴合数据）

要求：简洁、用中文、用数字说话，不要空泛的套话。`;

function lastUserContent(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  const last = messages[messages.length - 1];
  if (!last) return '';
  return typeof last.content === 'string' ? last.content : String(last.content ?? '');
}

async function run({ messages }) {
  const userContent = lastUserContent(messages);

  const model = await getTextModel();
  if (!model) {
    const err = new Error('未配置 AI API Key，请先在「设置」页配置后再使用现金流分析。');
    err.status = 400;
    throw err;
  }

  const { generateText } = await getAiSdk();
  const { text, usage } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  return {
    response: text,
    actions: [{ type: 'forecast', data: {} }],
    model_used: model.modelId || 'deepseek-chat',
    tokens_used: usage?.totalTokens || 0,
  };
}

module.exports = { run };
