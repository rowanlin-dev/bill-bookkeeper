const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// GET /api/fixed-expenses - 获取固定支出
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM fixed_expenses ORDER BY amount DESC').all();
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/fixed-expenses - 添加固定支出
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, amount, cycle, method, note } = req.body;
    
    const result = db.prepare(`
      INSERT INTO fixed_expenses (name, amount, cycle, method, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, amount, cycle || '月付', method || '微信', note || '');
    
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/fixed-expenses/:id - 修改固定支出（部分字段）
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '记录不存在' });

    const fields = ['name', 'amount', 'cycle', 'method', 'note'];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }
    if (!sets.length) return res.status(400).json({ success: false, error: '没有要更新的字段' });

    params.push(req.params.id);
    db.prepare(`UPDATE fixed_expenses SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/fixed-expenses/:id - 删除固定支出（可选同时清理未来预计流水）
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '记录不存在' });

    db.prepare('DELETE FROM fixed_expenses WHERE id = ?').run(req.params.id);

    let deletedPlanned = 0;
    if (req.query.cleanupPlanned === '1') {
      deletedPlanned = db.prepare(
        "DELETE FROM transactions WHERE source='预计' AND name = ? AND date >= date('now')"
      ).run(existing.name).changes;
    }
    res.json({ success: true, deletedPlanned });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
