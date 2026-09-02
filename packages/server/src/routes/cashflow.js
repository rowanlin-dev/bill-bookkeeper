const express = require('express');
const { getDb } = require('../config/database');
const { getTotalCash, ACTIVE } = require('../services/accountBalances');

const router = express.Router();

/**
 * GET /api/cashflow/forecast?days=90
 * 确定性现金流预测（不依赖 AI，转账感知）：
 * - 起点：账户锚点校准后的总现金（转账不改变总额）
 * - 历史曲线：近 30 天每日余额（由当前现金倒推）
 * - 预测曲线：日均净额漂移 ± 预计收支事件 - 每月固定支出
 */
router.get('/forecast', (req, res) => {
  try {
    const db = getDb();
    const days = Math.min(parseInt(req.query.days, 10) || 90, 365);

    // 当前现金（锚点校准口径；转账天然不改变总额）
    const currentCash = getTotalCash(db);

    // 近 30 天日均收支与净额（预测按日均净额漂移，避免系统性偏悲观）
    const last30 = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type='收入' THEN amount END),0) AS inc,
        COALESCE(SUM(CASE WHEN type='支出' THEN amount END),0) AS exp
      FROM transactions
      WHERE ${ACTIVE} AND date >= date('now', '-30 day')
    `).get();
    const avgDailyExpense = last30.exp / 30;
    const avgDailyIncome = last30.inc / 30;
    const avgDailyNet = avgDailyIncome - avgDailyExpense;

    // 近 30 天每日净额 → 历史余额曲线（从今天倒推）
    const dailyNet = db.prepare(`
      SELECT date,
        SUM(CASE WHEN type='收入' THEN amount ELSE 0 END)
        - SUM(CASE WHEN type='支出' THEN amount ELSE 0 END) AS net
      FROM transactions
      WHERE ${ACTIVE} AND date >= date('now', '-30 day')
      GROUP BY date ORDER BY date ASC
    `).all();
    const netByDate = Object.fromEntries(dailyNet.map(r => [r.date, r.net]));

    const today = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    const history = [];
    let bal = currentCash;
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = iso(d);
      history.unshift({ date: key, balance: Math.round(bal * 100) / 100 });
      bal -= (netByDate[key] || 0); // 往前一天倒推
    }

    // 预计收支事件（未来日期；排除已取消）：
    // - 已确认的预计（status='已到账'）已计入当前现金，不再作为未来事件，避免重复计数
    // - 未确认的预计、待生效 仍作为未来事件参与预测
    const planned = db.prepare(`
      SELECT date, type, name, amount FROM transactions
      WHERE date >= date('now')
        AND status != '已取消'
        AND ((source='预计' AND status != '已到账') OR status='待生效')
      ORDER BY date ASC
    `).all();
    const plannedByDate = {};
    for (const p of planned) {
      (plannedByDate[p.date] = plannedByDate[p.date] || []).push(p);
    }

    // 每月固定支出
    const fixed = db.prepare('SELECT name, amount, cycle FROM fixed_expenses').all();
    const monthlyFixed = fixed.reduce((s, f) => s + f.amount, 0);

    // 未来预测
    const forecast = [];
    const events = [];
    let fBal = currentCash;
    let minBalance = currentCash;
    let minDate = iso(today);
    for (let i = 1; i <= days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = iso(d);

      fBal += avgDailyNet;
      if (d.getDate() === 1) fBal -= monthlyFixed;

      for (const p of (plannedByDate[key] || [])) {
        const signed = p.type === '收入' ? p.amount : -p.amount;
        fBal += signed;
        events.push({ date: key, name: p.name, type: p.type, amount: p.amount });
      }

      fBal = Math.round(fBal * 100) / 100;
      forecast.push({ date: key, balance: fBal });
      if (fBal < minBalance) { minBalance = fBal; minDate = key; }
    }

    res.json({
      success: true,
      data: {
        currentCash: Math.round(currentCash * 100) / 100,
        avgDailyExpense: Math.round(avgDailyExpense * 100) / 100,
        avgDailyIncome: Math.round(avgDailyIncome * 100) / 100,
        avgDailyNet: Math.round(avgDailyNet * 100) / 100,
        monthlyFixed,
        days,
        history,
        forecast,
        events,
        summary: {
          endBalance: forecast.length ? forecast[forecast.length - 1].balance : currentCash,
          minBalance,
          minDate,
          risk: minBalance < 0,
        },
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
