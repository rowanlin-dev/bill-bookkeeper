const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// GET /api/liabilities - 获取负债列表
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM liabilities ORDER BY amount DESC').all();
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/liabilities - 添加负债
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, amount, creditor, due_date, rate, status, note } = req.body;
    
    const result = db.prepare(`
      INSERT INTO liabilities (name, amount, creditor, due_date, rate, status, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, amount, creditor, due_date, rate || '0%', status || '未还', note || '');
    
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/liabilities/:id - 更新负债状态
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { status, note } = req.body;
    
    db.prepare('UPDATE liabilities SET status=?, note=? WHERE id=?')
      .run(status, note, req.params.id);
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
