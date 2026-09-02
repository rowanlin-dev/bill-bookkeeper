const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// 与 offline/importExport.js 及 export-to-offline.cjs 保持一致的 5 张表
const TABLES = ['transactions', 'accounts', 'fixed_expenses', 'utility_readings', 'liabilities'];

// GET /api/export - 将在线 SQLite 账本导出为离线版可导入的 JSON 并触发下载
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const data = {};
    for (const t of TABLES) {
      try {
        data[t] = db.prepare(`SELECT * FROM ${t}`).all();
      } catch (e) {
        // 表可能尚未创建（如用户从未录入某类数据），降级为空数组
        data[t] = [];
      }
    }

    const payload = {
      app: 'bill-bookkeeper',
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'online-sqlite',
      data,
    };

    const filename = `bill-bookkeeper-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
