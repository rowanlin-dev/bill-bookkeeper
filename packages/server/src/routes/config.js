const express = require('express');
const { loadUserConfig, saveUserConfig, maskKey } = require('../config/user-config');

const router = express.Router();

// GET /api/config - 读取配置（API Key 打码返回）
router.get('/', async (req, res) => {
  try {
    const cfg = await loadUserConfig();
    res.json({
      success: true,
      data: {
        aiProvider: cfg.aiProvider,
        aiBaseUrl: cfg.aiBaseUrl,
        aiModel: cfg.aiModel,
        hasApiKey: Boolean(cfg.aiApiKey),
        aiApiKeyMasked: maskKey(cfg.aiApiKey),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/config - 更新配置（apiKey 传空字符串表示保持原值不变）
router.put('/', async (req, res) => {
  try {
    const { aiProvider, aiBaseUrl, aiModel, aiApiKey } = req.body || {};
    const patch = {};
    if (aiProvider !== undefined) patch.aiProvider = aiProvider;
    if (aiBaseUrl !== undefined) patch.aiBaseUrl = aiBaseUrl;
    if (aiModel !== undefined) patch.aiModel = aiModel;
    if (aiApiKey) patch.aiApiKey = aiApiKey; // 空值不覆盖，避免误清空

    const merged = await saveUserConfig(patch);
    res.json({
      success: true,
      data: {
        aiProvider: merged.aiProvider,
        aiBaseUrl: merged.aiBaseUrl,
        aiModel: merged.aiModel,
        hasApiKey: Boolean(merged.aiApiKey),
        aiApiKeyMasked: maskKey(merged.aiApiKey),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
