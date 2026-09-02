const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;

const config = require('./config');
const { getDb } = require('./config/database');

// 路由
const transactionsRouter = require('./routes/transactions');
const liabilitiesRouter = require('./routes/liabilities');
const fixedExpensesRouter = require('./routes/fixed-expenses');
const utilityRouter = require('./routes/utility');
const dashboardRouter = require('./routes/dashboard');
const aiRouter = require('./routes/ai-proxy');
const configRouter = require('./routes/config');
const cashflowRouter = require('./routes/cashflow');
const accountsRouter = require('./routes/accounts');
const systemRouter = require('./routes/system');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bill-server', version: '0.1.0' });
});

// API 路由
app.use('/api/transactions', transactionsRouter);
app.use('/api/liabilities', liabilitiesRouter);
app.use('/api/fixed-expenses', fixedExpensesRouter);
app.use('/api/utility', utilityRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);
app.use('/api/config', configRouter);
app.use('/api/cashflow', cashflowRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/system', systemRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

// API 404：未知接口统一返回 JSON，而不是 Express 默认 HTML
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `接口不存在：${req.method} ${req.path}` });
});

// 统一错误处理中间件
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ success: false, error: err.message || '服务器内部错误' });
});

// 数据初始化
async function initData() {
  try {
    await fs.mkdir(config.dataDir, { recursive: true });
    getDb();
    console.log('✅ Database initialized:', config.dbPath);
  } catch (e) {
    console.error('❌ Init error:', e);
    process.exit(1);
  }
}

// 启动
const PORT = config.port;
app.listen(PORT, async () => {
  await initData();
  console.log(`🚀 Bill Server running on http://localhost:${PORT}`);
});

module.exports = app;
