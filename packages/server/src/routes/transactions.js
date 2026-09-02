const express = require('express');
const { getDb } = require('../config/database');
const { ACTIVE } = require('../services/accountBalances');

const router = express.Router();

// GET /api/transactions - 获取交易列表
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { type, startDate, endDate, category, limit = 100 } = req.query;

    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY date DESC, id DESC LIMIT ?';
    params.push(parseInt(limit));

    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/transactions - 添加交易（支持 收入/支出/转账；转账需 to_account）
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { date, type, name, category, amount, account, to_account, note, source, status } = req.body;

    if (!date || !type || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, error: 'date/type/amount 为必填' });
    }
    if (type === '转账') {
      if (!account || !to_account) {
        return res.status(400).json({ success: false, error: '转账必须提供 account（转出）和 to_account（转入）' });
      }
      if (account === to_account) {
        return res.status(400).json({ success: false, error: '转出与转入账户不能相同' });
      }
    }

    const result = db.prepare(`
      INSERT INTO transactions (date, type, name, category, amount, account, to_account, note, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      date, type, name || '', category || null, amount,
      account || '微信', to_account || null,
      note || '', source || '用户输入', status || '已到账'
    );

    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/transactions/:id - 更新交易（支持部分字段，常用于 待生效→已到账 转正）
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '记录不存在' });

    const fields = ['date', 'type', 'name', 'category', 'amount', 'account', 'to_account', 'note', 'source', 'status'];
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
    db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/transactions/planned?name=X&from=YYYY-MM-DD - 批量取消未来预计流水
// 注意：必须放在 DELETE /:id 之前，否则 "planned" 会被当成 id 匹配
router.delete('/planned', (req, res) => {
  try {
    const db = getDb();
    const { name, from } = req.query;
    if (!name) return res.status(400).json({ success: false, error: '缺少 name 参数' });

    let sql = "DELETE FROM transactions WHERE source='预计' AND name = ?";
    const params = [name];
    if (from) {
      sql += ' AND date >= ?';
      params.push(from);
    }
    const r = db.prepare(sql).run(...params);
    res.json({ success: true, deleted: r.changes });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/transactions/:id - 删除交易
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM transactions WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/transactions/stats/summary - 统计数据
router.get('/stats/summary', (req, res) => {
  try {
    const db = getDb();

    const income = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='收入' AND ${ACTIVE}`).get();
    const expense = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='支出' AND ${ACTIVE}`).get();

    res.json({
      success: true,
      data: {
        totalIncome: income.total,
        totalExpense: expense.total,
        net: income.total - expense.total,
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
