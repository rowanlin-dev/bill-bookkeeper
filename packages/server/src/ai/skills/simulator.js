/**
 * Simulator: 情景模拟
 * 移植自 packages/ai/skills/bill/simulator.py（纯文本返回，消息构造保持一致）。
 */
const { getAiSdk, getTextModel } = require('../client');

const SYSTEM_PROMPT = `你是一个财务情景模拟器。用户会提供两部分内容：
1. 【我的账本快照】——来自其记账系统的真实数据（当前现金、近 30 天日均收支、每月固定支出、预测余额、预计收支事件）；
2. 【模拟请求】——一条"如果……"形式的假设。

核心规则：
1. **快照中的数据视为事实**，直接作为模拟基线。用户已经长期使用该账本，这些系统里全都有，
   **严禁向用户索要快照中已有的数据**（当前资金、收入水平、支出水平、固定支出、预计事件等）。
   索要这些是严重错误。
2. 月度口径换算：月收入 ≈ 日均收入 × 30，月支出 ≈ 日均支出 × 30，换算时简要说明依据。
3. 模拟起点：未指明时间的假设（如"下个月涨薪500"）从**下一个完整月份**起应用；
   假设自带时间点（如"转正后""明年3月起"）则按假设的时间。
4. 每月固定支出逐月扣减；快照中的预计收支事件按其日期计入对应月份，不得重复计入当前现金。

输出格式：
- 先给一段 2~3 句的结论（这个假设带来的核心变化）。
- 再给逐月资金预测表：月份 / 收入 / 支出 / 净额 / 期末余额。
- 最后标注风险点：现金见底月份、大额支出叠加月份、安全垫厚度（余额可支撑几个月）。

提问原则：仅当假设所需的关键参数在快照中确实无法推导时才可提问（例如涨薪后实际到手税额、
新增支出的具体金额），一次最多一项，且必须**先给出基于合理假设的初步结论**再追问。`;

// 注入真实日期：模拟依赖"下个月"等相对时间，不告知今天会导致月份算错
function buildSystemPrompt() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nextMonth = `${now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()}-${pad((now.getMonth() + 1) % 12 + 1)}`;
  return `${SYSTEM_PROMPT}\n\n【当前日期】今天是 ${today}，"下个月"指 ${nextMonth}。`;
}

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
    system: buildSystemPrompt(),
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
