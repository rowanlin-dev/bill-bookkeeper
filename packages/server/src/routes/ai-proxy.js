const express = require('express');
const config = require('../config');
const { loadUserConfig } = require('../config/user-config');

const router = express.Router();

// 读取用户 AI 配置并转换为 AI 服务所需的 provider_config 结构
async function loadProviderConfig() {
  const cfg = await loadUserConfig();
  return {
    provider: cfg.aiProvider,
    apiKey: cfg.aiApiKey,
    baseUrl: cfg.aiBaseUrl,
    model: cfg.aiModel,
  };
}

async function forward(res, url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.aiMasterKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`AI 服务错误（${response.status}）：${errorText.slice(0, 300)}`);
    err.status = response.status >= 500 ? 502 : response.status;
    throw err;
  }
  return response.json();
}

// POST /api/ai/chat - 统一 AI 对话入口
router.post('/chat', async (req, res) => {
  try {
    const { project, skill, messages, context, image } = req.body;
    const providerConfig = await loadProviderConfig();
    if (!providerConfig.apiKey) {
      return res.status(400).json({ success: false, error: '未配置 AI API Key，请先在「设置」页配置' });
    }

    const data = await forward(res, `${config.aiServiceUrl}/agent`, {
      project: project || 'bill',
      skill: skill || 'Chat',
      messages,
      context,
      image,
      provider_config: providerConfig,
    });
    res.json(data);
  } catch (e) {
    console.error('AI proxy error:', e);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
});

// POST /api/ai/analyze - 图片/文本分析
router.post('/analyze', async (req, res) => {
  try {
    const { image, text, project } = req.body;
    const providerConfig = await loadProviderConfig();
    if (!providerConfig.apiKey) {
      return res.status(400).json({ success: false, error: '未配置 AI API Key，请先在「设置」页配置' });
    }

    const data = await forward(res, `${config.aiServiceUrl}/analyze`, {
      project: project || 'bill',
      image,
      text,
      provider_config: providerConfig,
    });
    res.json(data);
  } catch (e) {
    console.error('AI analyze error:', e);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
});

module.exports = router;
