// 使用 Node 内置 SQLite（Node 22.5+，启动脚本对旧版本自动加 --experimental-sqlite）
// 彻底摆脱 better-sqlite3 原生模块的 Node ABI 版本绑定问题
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const config = require('../config');

let db = null;

function getDb() {
  if (!db) {
    db = new DatabaseSync(config.dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    // 注册 uuid_v4() 供列默认值与迁移回填使用
    db.function('uuid_v4', () => randomUUID());
    initTables(db);
    migrate(db);
  }
  return db;
}

function initTables(db) {
  // 交易流水
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT,
      category TEXT,
      amount REAL NOT NULL,
      account TEXT DEFAULT '微信',
      note TEXT,
      source TEXT DEFAULT '用户输入',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 负债明细
  db.exec(`
    CREATE TABLE IF NOT EXISTS liabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      creditor TEXT,
      due_date TEXT,
      rate TEXT,
      status TEXT DEFAULT '未还',
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 固定支出
  db.exec(`
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      cycle TEXT DEFAULT '月付',
      method TEXT DEFAULT '微信',
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 水电读数
  db.exec(`
    CREATE TABLE IF NOT EXISTS utility_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      reading REAL NOT NULL,
      price_per_unit REAL NOT NULL,
      usage REAL,
      cost REAL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 账户体系：锚点余额 + 锚点日期 + 锚点流水ID
  // 余额 = 锚点 + (date > 锚点日期) 或 (date = 锚点日期 且 id > 锚点ID) 的净流
  // 锚点ID 解决"校准当天又记新账"被漏算的问题
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kind TEXT DEFAULT '电子',
      anchor_balance REAL DEFAULT 0,
      anchor_date TEXT,
      anchor_id INTEGER DEFAULT 0,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// 轻量迁移：为旧库补列 / 播种账户
function migrate(db) {
  const cols = db.prepare("SELECT name FROM pragma_table_info('transactions')").all().map(r => r.name);
  if (!cols.includes('status')) {
    db.exec("ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT '已到账'");
  }
  if (!cols.includes('to_account')) {
    db.exec('ALTER TABLE transactions ADD COLUMN to_account TEXT');
  }

  // accounts 表补 anchor_id 列（老库）
  const accCols = db.prepare("SELECT name FROM pragma_table_info('accounts')").all().map(r => r.name);
  if (!accCols.includes('anchor_id')) {
    db.exec('ALTER TABLE accounts ADD COLUMN anchor_id INTEGER DEFAULT 0');
    // 已有锚点统一回填为当前最大流水ID，保证校准日当天之前的记录不重复计入
    const maxId = db.prepare('SELECT COALESCE(MAX(id), 0) m FROM transactions').get().m;
    db.prepare('UPDATE accounts SET anchor_id = ? WHERE anchor_date IS NOT NULL').run(maxId);
  }

  // 为所有表补 sync_id（双向同步合并键）；accounts 以 name 为合并键，sync_id 作冗余标识
  const syncTables = {
    transactions: true,
    fixed_expenses: true,
    utility_readings: true,
    liabilities: true,
    accounts: false,
  };
  for (const [t, unique] of Object.entries(syncTables)) {
    const tcols = db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map((r) => r.name);
    if (!tcols.includes('sync_id')) {
      db.exec(`ALTER TABLE ${t} ADD COLUMN sync_id TEXT`);
      db.exec(`UPDATE ${t} SET sync_id = uuid_v4() WHERE sync_id IS NULL`);
      if (unique) db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${t}_sync_uid ON ${t}(sync_id)`);
    }
  }

  const accountCount = db.prepare('SELECT COUNT(*) c FROM accounts').get().c;
  if (accountCount === 0) {
    const maxId = db.prepare('SELECT COALESCE(MAX(id), 0) m FROM transactions').get().m;
    const seed = db.prepare('INSERT INTO accounts (name, kind, anchor_balance, anchor_date, anchor_id, note, sync_id) VALUES (?, ?, ?, ?, ?, ?, uuid_v4())');
    // 用户在 2026-07-18 报告的真实余额，直接作为锚点
    const defaults = [
      ['微信', '电子', 2156.33, '2026-07-18', maxId, '用户报告余额锚定'],
      ['银行卡', '银行卡', 488.6, '2026-07-18', maxId, '用户报告余额锚定'],
      ['现金', '现金', 500.0, '2026-07-18', maxId, '用户报告余额锚定'],
      ['支付宝', '电子', 0, null, 0, ''],
      ['岭南通', '交通卡', 0, null, 0, '初始余额未知，可在界面校准'],
    ];
    for (const row of defaults) seed.run(...row);
  }
}

module.exports = { getDb, initTables };
