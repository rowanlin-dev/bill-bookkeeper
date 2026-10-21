/**
 * 模型调用出口（双 provider）：文本走 DeepSeek，视觉走智谱 GLM。
 *
 * ⚠️ `ai` 与 `@ai-sdk/openai-compatible` 都是纯 ESM（package.json 的 exports 只有 "import"），
 * 而后 packages/server 是 CommonJS（`require`），直接 require('ai') 会抛 ERR_REQUIRE_ESM。
 * 因此这里不使用静态 require，而是在 async 函数内动态 import()，避免把整个后端改成 ESM。
 *
 * 任一 Key 缺失时返回 null，由调用方（skill）自行走本地回退或给出明确提示。
 */
const { loadUserConfig } = require('../config/user-config');

const VISION_DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const VISION_DEFAULT_MODEL = 'glm-4.6v-flash';

let sdkPromise = null;

// 动态加载 AI SDK（带缓存，避免每次请求重复 import）
async function getAiSdk() {
  if (!sdkPromise) {
    const p = Promise.all([import('ai'), import('@ai-sdk/openai-compatible')]).then(
      ([ai, compat]) => ({
        generateObject: ai.generateObject,
        generateText: ai.generateText,
        createOpenAICompatible: compat.createOpenAICompatible,
      }),
    );
    // 加载失败不缓存，保留重试空间
    p.catch(() => {
      sdkPromise = null;
    });
    sdkPromise = p;
  }
  return sdkPromise;
}

// DeepSeek：文本主模型（AI_API_KEY / AI_BASE_URL / AI_MODEL）
async function getTextModel() {
  const cfg = await loadUserConfig();
  if (!cfg.aiApiKey) return null;
  const { createOpenAICompatible } = await getAiSdk();
  const provider = createOpenAICompatible({
    name: 'deepseek',
    baseURL: cfg.aiBaseUrl,
    apiKey: cfg.aiApiKey,
  });
  return provider(cfg.aiModel);
}

// 智谱 GLM：视觉模型（VISION_API_KEY / VISION_BASE_URL / VISION_MODEL）
async function getVisionModel() {
  const cfg = await loadUserConfig();
  if (!cfg.visionApiKey) return null;
  const { createOpenAICompatible } = await getAiSdk();
  const provider = createOpenAICompatible({
    name: 'glm',
    baseURL: cfg.visionBaseUrl || VISION_DEFAULT_BASE_URL,
    apiKey: cfg.visionApiKey,
  });
  return provider(cfg.visionModel || VISION_DEFAULT_MODEL);
}

module.exports = { getAiSdk, getTextModel, getVisionModel };
