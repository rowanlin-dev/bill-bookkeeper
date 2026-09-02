/**
 * 账户余额计算（转账感知）
 * 余额 = 锚点余额 + 锚点日期之后的净流（收入−支出+转入−转出）
 * 只统计实际流水：
 * - 已取消 不计入
 * - 预计（固定支出）仅当已确认（status='已到账'）才计入现金；未确认/已取消的预计不计入
 * - 普通流水：status 为空或 已到账 计入；待生效 等其它状态不计入
 */
const ACTIVE = "((source != '预计' AND (status IS NULL OR status = '已到账')) OR (source = '预计' AND status = '已到账')) AND status != '已取消'";

function getAccountBalances(db) {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY id').all();
  return accounts.map((a) => {
    const anchorDate = a.anchor_date || '0000-00-00';
    const anchorId = a.anchor_id || 0;
    // 锚点之后的流水：(date > 锚点日期) 或 (date = 锚点日期 且 id > 锚点ID)
    const afterAnchor = `(date > ? OR (date = ? AND id > ?))`;
    const args = [a.name, anchorDate, anchorDate, anchorId];

    const flow = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type='收入' THEN amount WHEN type='支出' THEN -amount ELSE 0 END), 0) AS net
      FROM transactions
      WHERE account = ? AND ${ACTIVE} AND ${afterAnchor}
    `).get(...args).net;

    const transferIn = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
      WHERE type='转账' AND to_account = ? AND ${ACTIVE} AND ${afterAnchor}
    `).get(...args).s;

    const transferOut = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
      WHERE type='转账' AND account = ? AND ${ACTIVE} AND ${afterAnchor}
    `).get(...args).s;

    const balance = (a.anchor_balance || 0) + flow + transferIn - transferOut;
    return {
      ...a,
      balance: Math.round(balance * 100) / 100,
    };
  });
}

// 总现金 = 非信用类账户余额合计
function getTotalCash(db) {
  return getAccountBalances(db)
    .filter((a) => a.kind !== '信用')
    .reduce((s, a) => s + a.balance, 0);
}

module.exports = { getAccountBalances, getTotalCash, ACTIVE };
