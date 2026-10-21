/**
 * 用户配置统一读写（AI 配置等）
 * 唯一真相源：项目根目录 .env（已被 .gitignore 忽略，模板见 .env.example）
 * 前端 Settings 页与 ai-proxy 都通过此模块读写，禁止再使用 localStorage。
 */
const fs = require('fs').promises;
const config = require('./index');

const KEY_MAP = {
  aiProvider: 'AI_PROVIDER',
  aiApiKey: 'AI_API_KEY',
  aiBaseUrl: 'AI_BASE_URL',
  aiModel: 'AI_MODEL',
  // 视觉模型（智谱 GLM）：新增，详见 src/ai/client.js
  visionApiKey: 'VISION_API_KEY',
  visionBaseUrl: 'VISION_BASE_URL',
  visionModel: 'VISION_MODEL',
};

const DEFAULTS = {
  aiProvider: 'deepseek',
  aiApiKey: '',
  aiBaseUrl: 'https://api.deepseek.com/v1',
  aiModel: 'deepseek-chat',
  visionApiKey: '',
  visionBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  visionModel: 'glm-4.6v-flash',
};

// 解析 .env 文本为键值对（支持注释与空行，值不含引号）
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2];
  }
  return out;
}

async function loadUserConfig() {
  let env = {};
  try {
    env = parseEnv(await fs.readFile(config.envPath, 'utf-8'));
  } catch {
    // .env 不存在时回退到进程环境变量
  }
  const merged = { ...DEFAULTS };
  for (const [field, envKey] of Object.entries(KEY_MAP)) {
    const v = env[envKey] !== undefined ? env[envKey] : process.env[envKey];
    if (v) merged[field] = v;
  }
  return merged;
}

async function saveUserConfig(patch) {
  let text = '';
  try {
    text = await fs.readFile(config.envPath, 'utf-8');
  } catch {
    text = '';
  }
  const lines = text.split(/\r?\n/);
  const seen = new Set();

  const updated = lines.map((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m) return line;
    const field = Object.keys(KEY_MAP).find((f) => KEY_MAP[f] === m[1]);
    if (field && patch[field] !== undefined) {
      seen.add(field);
      return `${m[1]}=${patch[field]}`;
    }
    return line;
  });

  // .env 中不存在的键追加到末尾
  for (const [field, envKey] of Object.entries(KEY_MAP)) {
    if (patch[field] !== undefined && !seen.has(field)) {
      updated.push(`${envKey}=${patch[field]}`);
    }
  }

  await fs.writeFile(config.envPath, updated.join('\n'), 'utf-8');
  // 同步刷新进程环境，保证本进程内立即生效
  for (const [field, envKey] of Object.entries(KEY_MAP)) {
    if (patch[field] !== undefined) process.env[envKey] = patch[field];
  }
  return loadUserConfig();
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

module.exports = { loadUserConfig, saveUserConfig, maskKey };
