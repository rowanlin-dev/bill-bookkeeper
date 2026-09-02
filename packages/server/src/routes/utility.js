const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// GET /api/utility - 获取水电读数
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { type } = req.query;
    
    let sql = 'SELECT * FROM utility_readings WHERE 1=1';
    const params = [];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY date ASC, id ASC';
    const rows = db.prepare(sql).all(...params);

    // 按类型分组计算用量：每条记录对比上一条【同类型】记录
    const lastByType = {};
    for (const row of rows) {
      const prev = lastByType[row.type];
      if (prev) {
        row.usage = row.reading - prev.reading;
        row.cost = row.usage * row.price_per_unit;
        row.days_diff = Math.round((new Date(row.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24));
        row.daily_avg = row.days_diff > 0 ? Number((row.usage / row.days_diff).toFixed(2)) : null;
      } else {
        row.usage = null;
        row.cost = null;
        row.days_diff = null;
        row.daily_avg = null;
      }
      lastByType[row.type] = row;
    }

    // 返回时按日期倒序
    res.json({ success: true, data: rows.reverse() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/utility - 添加读数
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { type, date, reading, price_per_unit, note } = req.body;
    
    // 查找上一条同类型记录
    const prev = db.prepare('SELECT * FROM utility_readings WHERE type=? ORDER BY date DESC LIMIT 1').get(type);
    
    let usage = null;
    let cost = null;
    if (prev) {
      usage = reading - prev.reading;
      cost = usage * price_per_unit;
    }
    
    const result = db.prepare(`
      INSERT INTO utility_readings (type, date, reading, price_per_unit, usage, cost, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(type, date, reading, price_per_unit, usage, cost, note || '');
    
    res.json({ 
      success: true, 
      id: Number(result.lastInsertRowid),
      usage,
      cost
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
