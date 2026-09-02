const path = require('path');

// __dirname 是 packages/server/src/config/，需 4 层回溯才能到项目根目录
const ROOT = path.resolve(__dirname, '../../../../');

// 加载项目根目录 .env（敏感配置的唯一真相源，见 .env.example）
require('dotenv').config({ path: path.join(ROOT, '.env') });

module.exports = {
  port: process.env.PORT || 3000,
  rootDir: ROOT,
  dataDir: path.join(ROOT, 'data'),
  envPath: path.join(ROOT, '.env'),
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:5000',
  aiMasterKey: process.env.AI_MASTER_KEY || 'bill-local-key',
  dbPath: path.join(ROOT, 'data', 'ledger.db'),
  excelPath: path.join(ROOT, 'data', '个人财务账本_2026.xlsx'),
};
