const express = require('express');
const registry = require('../ai/registry');

const router = express.Router();

// POST /api/ai/chat - 统一 AI 对话入口
// 说明：原先由 <aiServiceUrl>/agent 跨进程转发到 Python AI 服务（:5000），
// 现在改为进程内调用 src/ai/registry.js，对外契约保持不变。
router.post('/chat', async (req, res) => {
  try {
    const { project, skill, messages, context, image } = req.body || {};
    const data = await registry.execute({
      project: project || 'bill',
      skill,
      messages,
      context,
      image,
    });
    res.json(data);
  } catch (e) {
    console.error('AI chat error:', e);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
});

module.exports = router;
