/**
 * NLPParser: 自然语言 → 结构化记账操作（核心）
 *
 * 移植自 packages/ai/skills/bill/nlp_parser.py：
 *  - SYSTEM_PROMPT 逐字照搬 py:14-51（含「预计→待生效」状态铁律与分期展开规则）
 *  - 在线用 generateObject + OpsSchema 结构化输出（替代旧的 extractJson 文本抠取）
 *  - 无 AI Key 时走本地规则回退（skills/offlineParser.js）
 *
 * 出参除 response（JSON 字符串，兼容旧消费方）外，额外给 operations 对象数组。
 */
const { getAiSdk, getTextModel } = require('../client');
const { OpsSchema } = require('../schemas');
const offlineParser = require('./offlineParser');

// ↓↓↓ 逐字移植自 packages/ai/skills/bill/nlp_parser.py:14-51，禁止改动措辞 ↓↓↓
const SYSTEM_PROMPT = "你是一个财务记账解析助手。把用户的自然语言解析为【操作列表】，只输出 JSON。\n\n支持的操作（op 字段）：\n1. add —— 普通收支流水\n   {op, date, type(收入/支出), name, category, amount, account, status, note}\n2. transfer —— 账户间转账/充值（钱从一个账户搬到另一个账户，不是消费！）\n   {op, date, name, amount, account(转出), to_account(转入), note}\n3. calibrate —— 用户报告某账户当前余额（如\"现在微信剩2156\"）\n   {op, account, balance, date, note}\n4. delete_planned —— 取消某项目未来的预计流水（如\"酷狗以后不每月扣了\"）\n   {op, name, from_date, note}\n5. delete_fixed —— 从固定支出中移除某项目\n   {op, name, note}\n6. add_fixed —— 新增每月固定支出\n   {op, name, amount, cycle(月付/年付), method, note}\n\n解析规则：\n- 日期缺省用今天；用户说\"7.12\"指 2026-07-12\n- 分类：餐饮、交通、购物、娱乐、住房、教育、通讯、工具/会员、医疗、人情、其他支出、其他收入、家庭资助、家庭借款、奖学金、工资\n- \"充值岭南通/充话费到某卡\"等账户间搬钱 = transfer（账户→岭南通），**不要再生成对应的支出流水**\n- 刷岭南通乘车/消费 = 普通支出，account 记为\"岭南通\"\n- \"先用后付/还没扣钱/可能退货\" = add，status 记\"待生效\"；其余默认\"已到账\"\n- **分期付款**（如\"119块分3期付款/免息分期\"）：不要记成一笔！展开为 N 条 add：\n  * 第 1 期：购买日，status\"已到账\"（首付已扣）\n  * 第 2~N 期：日期逐月 +1，status\"待生效\"（平台届时自动扣，用户看到扣款后转正）\n  * name 带期数，如\"多功能电炒锅（分期1/3）\"；note 记\"分3期免息，共119，每期39.67\"\n  * 每期金额 = 总额/N 保留两位小数，**最后一期兜底零头，各期之和必须精确等于总额**（如 119 分 3 期 = 39.67 + 39.67 + 39.66）\n  * 若用户说明了不同的首付金额或手续费：首付按实际记第 1 期（手续费并入第 1 期），剩余金额均分到后续各期\n- \"借款\"类同时给 add（收入，分类 家庭借款）和负债说明放在 note\n- \"预计/下个月要...\" = add，source 字段记\"预计\"，**status 字段必须记\"待生效\"**（预计代表尚未发生，由用户在账本中点击「确认」才转为\"已到账\"计入现金；默认\"已到账\"是错的）\n- 用户报告余额（\"现在XX剩YY\"）= calibrate，不要生成收支流水\n- 账户名从上下文识别：微信、银行卡、现金、支付宝、岭南通；未指明时用\"微信\"\n\n输出格式（只输出 JSON，不要任何解释）：\n{\n  \"operations\": [ ... ],\n  \"summary\": \"一句话概括解析结果\"\n}";
// ↑↑↑ 移植结束 ↑↑↑

/**
 * ⚠️ 唯一一处刻意偏离「逐字移植」的改动（bug 修复，非措辞调整）：
 * 原提示词写的是「日期缺省用今天；用户说"7.12"指 2026-07-12」——
 * 它**从未真正告诉模型今天是几号**，只给了一个带年份的示例。
 * 模型无从得知当前日期，于是锚定到示例日期 → 实测 2026-10-22 解析出 2026-07-12。
 * （该缺陷在 Python 原版同样存在，只是当年数据集中在 2026-07 才没暴露。）
 * 这里把日期规则动态化：注入真实今天，并让示例年份跟随当前年份。
 */
function buildSystemPrompt() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const year = now.getFullYear();
  return SYSTEM_PROMPT.replace(
    '- 日期缺省用今天；用户说"7.12"指 2026-07-12',
    `- 今天是 ${today}。日期缺省用今天（即 ${today}）；用户说"7.12"指 ${year}-07-12`
  );
}

function lastUserContent(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  const last = messages[messages.length - 1];
  if (!last) return '';
  return typeof last.content === 'string' ? last.content : String(last.content ?? '');
}

/**
 * 状态铁律兜底：含「预计」语义必须为 待生效，避免把未发生的钱计入现金。
 * LLM 偶尔漏给 status，这里做最后一道保险（前端 ChatInput.vue 还有一道）。
 */
function enforceEstimatedStatus(object) {
  const operations = Array.isArray(object?.operations) ? object.operations : [];
  const normalized = operations.map((op) => {
    if (op.source === '预计' && (!op.status || op.status === '已到账')) {
      return { ...op, status: '待生效' };
    }
    return op;
  });
  return { operations: normalized, summary: object?.summary ?? '' };
}

async function run({ messages }) {
  const userContent = lastUserContent(messages);

  // 无 AI Key → 本地规则回退（不报错，保证离线可用）
  const model = await getTextModel();
  if (!model) {
    const offline = offlineParser.parse(userContent);
    return {
      response: JSON.stringify(offline),
      operations: offline.operations,
      summary: offline.summary,
      actions: [{ type: 'parse_operations', data: offline }],
      model_used: 'local-offline',
      tokens_used: 0,
    };
  }

  const { generateObject } = await getAiSdk();
  // ⚠️ AI SDK v7：system 提示词只能放 system 选项（放 messages 会抛 InvalidPromptError）
  const { object, usage } = await generateObject({
    model,
    schema: OpsSchema,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: `请解析以下记账内容：\n\n${userContent}` }],
  });

  const normalized = enforceEstimatedStatus(object);

  return {
    response: JSON.stringify(normalized),
    operations: normalized.operations,
    summary: normalized.summary,
    actions: [{ type: 'parse_operations', data: normalized }],
    model_used: model.modelId || 'deepseek-chat',
    tokens_used: usage?.totalTokens || 0,
  };
}

module.exports = { run, SYSTEM_PROMPT };
