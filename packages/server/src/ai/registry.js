/**
 * AI skill 分发表（替代 Python 侧的 skills/registry.py）
 *
 * 统一出参形状：{ project, skill, response, actions, model_used, tokens_used }
 * NLPParser / VisionParser 另返回顶层 operations（结构化对象），便于前端直接消费。
 */
const SKILLS = {
  bill: {
    NLPParser: require('./skills/nlpParser'),
    Forecast: require('./skills/forecast'),
    Simulator: require('./skills/simulator'),
    Advisor: require('./skills/advisor'),
    VisionParser: require('./skills/visionParser'),
  },
};

function availableSkills(project) {
  return Object.keys(SKILLS[project] || {});
}

async function execute({ project = 'bill', skill, messages = [], context = {}, image = null } = {}) {
  const impl = SKILLS[project] ? SKILLS[project][skill] : null;
  if (!impl) {
    const err = new Error(
      `未知的 AI skill：'${skill}'（project='${project}'）。可用 skill：${availableSkills(project).join('、') || '（无）'}`,
    );
    err.status = 400;
    throw err;
  }

  let result;
  try {
    result = await impl.run({ project, skill, messages, context, image });
  } catch (e) {
    // 上游（模型/网络）故障统一映射为 502，skill 自己指定的 400 语义保留
    if (e.status === undefined || e.status === null) e.status = 502;
    throw e;
  }

  const extra = {};
  if (result.operations !== undefined) extra.operations = result.operations;
  if (result.summary !== undefined) extra.summary = result.summary;

  return {
    project,
    skill,
    response: result.response || '',
    actions: result.actions || [],
    model_used: result.model_used || 'unknown',
    tokens_used: result.tokens_used || 0,
    ...extra,
  };
}

module.exports = { execute, availableSkills, skills: SKILLS };
