const express = require('express');
const { getDb } = require('../config/database');
const { getAccountBalances } = require('../services/accountBalances');

const router = express.Router();

// GET /api/accounts - 全部账户（含计算余额）
router.get('/', (req, res) => {
  try {
    const db = getDb();
    res.json({ success: true, data: getAccountBalances(db) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/accounts - 新建账户
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, kind = '电子', anchor_balance = 0, anchor_date = null, note = '' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '账户名不能为空' });
    const r = db.prepare(
      'INSERT INTO accounts (name, kind, anchor_balance, anchor_date, note) VALUES (?, ?, ?, ?, ?)'
    ).run(name, kind, anchor_balance, anchor_date, note);
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) {
    const msg = String(e.message).includes('UNIQUE') ? '账户已存在' : e.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// PUT /api/accounts/:id - 更新账户（主要用于余额校准：传 anchor_balance + anchor_date）
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '账户不存在' });

    const { name, kind, anchor_balance, anchor_date, note } = req.body;
    // 校准余额时，同步把锚点ID固定为当前最大流水ID：
    // 已存在的同日记录视为"已包含在用户报告的余额里"，之后新记的账才会累加
    let anchorId = existing.anchor_id || 0;
    if (anchor_balance !== undefined || anchor_date !== undefined) {
      anchorId = db.prepare('SELECT COALESCE(MAX(id), 0) m FROM transactions').get().m;
    }
    db.prepare(`
      UPDATE accounts SET name=?, kind=?, anchor_balance=?, anchor_date=?, anchor_id=?, note=? WHERE id=?
    `).run(
      name ?? existing.name,
      kind ?? existing.kind,
      anchor_balance ?? existing.anchor_balance,
      anchor_date ?? existing.anchor_date,
      anchorId,
      note ?? existing.note,
      req.params.id
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
