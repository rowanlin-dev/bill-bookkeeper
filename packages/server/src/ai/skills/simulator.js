/**
 * Simulator: 情景模拟
 * 移植自 packages/ai/skills/bill/simulator.py（纯文本返回，消息构造保持一致）。
 */
const { getAiSdk, getTextModel } = require('../client');

const SYSTEM_PROMPT = `你是一个财务情景模拟器。请基于用户提供的参数，模拟未来资金走势。

参数：
- 当前资金
- 月收入
- 月支出
- 入职时间
- 特殊支出（学费、还款等）

输出：逐月资金预测表，标注风险点。`;

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
    const err = new Error('未配置 AI API Key，请先在「设置」页配置后再使用情景模拟。');
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
    actions: [{ type: 'simulate', data: {} }],
    model_used: model.modelId || 'deepseek-chat',
    tokens_used: usage?.totalTokens || 0,
  };
}

module.exports = { run };
