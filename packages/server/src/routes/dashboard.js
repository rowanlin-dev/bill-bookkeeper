const express = require('express');
const { getDb } = require('../config/database');
const { getAccountBalances, getTotalCash, ACTIVE } = require('../services/accountBalances');

const router = express.Router();

// GET /api/dashboard - 获取看板数据
router.get('/', async (req, res) => {
  try {
    const db = getDb();

    // 核心指标（按 ACTIVE 口径：排除未确认预计、待生效、已取消；已确认预计计入统计）
    const income = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='收入' AND ${ACTIVE}`).get();
    const expense = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='支出' AND ${ACTIVE}`).get();

    // 当前现金：以账户锚点校准后的合计为准
    const accounts = getAccountBalances(db);
    const currentCash = Math.round(getTotalCash(db) * 100) / 100;

    // 分类统计
    const categories = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE type='支出' AND ${ACTIVE} AND category IS NOT NULL
      GROUP BY category
      ORDER BY total DESC
    `).all();

    // 日统计
    const daily = db.prepare(`
      SELECT date,
        SUM(CASE WHEN type='收入' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='支出' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE ${ACTIVE}
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `).all();

    // 负债
    const liabilities = db.prepare('SELECT * FROM liabilities ORDER BY amount DESC').all();
    const personalLiab = liabilities
      .filter(l => l.status !== '已还' && !l.name.includes('助学贷款'))
      .reduce((sum, l) => sum + l.amount, 0);

    // 固定支出
    const fixed = db.prepare('SELECT * FROM fixed_expenses').all();
    const monthlyFixed = fixed.reduce((sum, f) => sum + f.amount, 0);

    // 待生效（先用后付等承诺类）
    const pending = db.prepare(`
      SELECT * FROM transactions WHERE status = '待生效' ORDER BY date DESC
    `).all();

    const dashboardData = {
      kpi: {
        currentCash,
        totalIncome: Math.round(income.total * 100) / 100,
        totalExpense: Math.round(expense.total * 100) / 100,
        monthlyFixed: Math.round(monthlyFixed * 100) / 100,
        personalLiabilities: Math.round(personalLiab * 100) / 100,
      },
      accounts,
      categories,
      daily,
      liabilities,
      fixedExpenses: fixed,
      pending,
    };

    res.json({ success: true, data: dashboardData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
