/**
 * VisionParser: 图片账单识别（真实视觉能力）
 *
 * 接入智谱 GLM 视觉模型（OpenAI 兼容端点），用与 NLPParser 同一份 OpsSchema 做结构化输出，
 * 使图片识别结果与文字记账结果形状一致。
 *
 * ⚠️ 图片绝不截断：base64 超过 ~2MB 直接返回友好错误（旧 Python 实现把图片截断成前 100 字符
 *    当文本发送，模型收不到真实图像，必然幻觉）。
 */
const { getAiSdk, getVisionModel } = require('../client');
const { OpsSchema } = require('../schemas');

// base64 字符数上限（约 2MB，对应原始图片约 1.5MB）
const MAX_IMAGE_BASE64_CHARS = 2 * 1024 * 1024;

// 剥离 data URL 前缀，只保留纯 base64
function stripDataUrl(image) {
  const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/s.exec(String(image || '').trim());
  return m ? m[1] : String(image || '');
}

async function run({ image }) {
  if (!image) {
    return {
      response: '请上传账单截图，AI 将自动识别交易信息。',
      actions: [{ type: 'vision_parse', data: {} }],
      model_used: 'local',
      tokens_used: 0,
    };
  }

  const base64 = stripDataUrl(image);
  if (base64.length > MAX_IMAGE_BASE64_CHARS) {
    const approxMb = (base64.length / 1024 / 1024).toFixed(2);
    const err = new Error(
      `图片过大（约 ${approxMb}MB，上限 1.5MB），AI 无法识别。请压缩到长边 1024px 以内后重试。`,
    );
    err.status = 400;
    throw err;
  }

  const model = await getVisionModel();
  if (!model) {
    return {
      response:
        '未配置视觉模型 API Key（智谱 GLM），暂无法识别图片。请改用文字记账，或在「设置」配置后再试。',
      actions: [{ type: 'vision_parse', data: {} }],
      model_used: 'local',
      tokens_used: 0,
    };
  }

  const { generateObject } = await getAiSdk();
  const { object, usage } = await generateObject({
    model,
    schema: OpsSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请识别这张账单/票据中的交易信息，输出结构化操作列表。日期缺省用今天；无法判断的字段留空，不要编造金额。',
          },
          { type: 'image', image: base64 },
        ],
      },
    ],
  });

  const operations = Array.isArray(object?.operations) ? object.operations : [];
  const normalized = { operations, summary: object?.summary ?? '' };

  return {
    response: JSON.stringify(normalized),
    operations,
    summary: normalized.summary,
    actions: [{ type: 'vision_parse', data: normalized }],
    model_used: model.modelId || 'glm-4.6v-flash',
    tokens_used: usage?.totalTokens || 0,
  };
}

module.exports = { run, stripDataUrl, MAX_IMAGE_BASE64_CHARS };
