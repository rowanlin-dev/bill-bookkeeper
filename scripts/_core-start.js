#!/usr/bin/env node
/**
 * Bill-Bookkeeper Core Startup
 * Cross-platform: Windows / macOS / Linux
 * Encoding-safe: No Chinese characters in .bat files
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES = path.join(ROOT, 'packages');
const PID_DIR = path.join(ROOT, '.pids');
const LOG_DIR = path.join(ROOT, 'data', 'logs');

const IS_WIN = os.platform() === 'win32';

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function styled(text, color) { return `${color}${text}${C.reset}`; }
function log(msg) { console.log(msg); }
function ok(msg) { console.log(`[OK] ${msg}`); }
function error(msg) { console.error(`[ERR] ${msg}`); }
function warn(msg) { console.log(`[!] ${msg}`); }
function info(msg) { console.log(`[i] ${msg}`); }

function printTitle(title) {
  const line = '='.repeat(50);
  log('');
  log(styled(line, C.cyan));
  log(styled(`  ${title}`, C.bold + C.cyan));
  log(styled(line, C.cyan));
  log('');
}

function getPythonPath() {
  return IS_WIN
    ? path.join(PACKAGES, 'ai', 'venv', 'Scripts', 'python.exe')
    : path.join(PACKAGES, 'ai', 'venv', 'bin', 'python');
}

// node:sqlite 在 Node 22.5~23.3 需要 --experimental-sqlite 标志，23.4+ 内置稳定
function sqliteFlagArg() {
  const [maj, min] = process.versions.node.split('.').map(Number);
  return (maj < 23 || (maj === 23 && min < 4)) ? ['--experimental-sqlite'] : [];
}

const SERVICES = [
  {
    name: 'AI Service',
    key: 'ai-service',
    cwd: path.join(PACKAGES, 'ai'),
    getCmd: () => getPythonPath(),
    args: ['main.py'],
    port: 5000,
    env: { ...process.env, PORT: '5000', PYTHONIOENCODING: 'utf-8' },
  },
  {
    name: 'Server',
    key: 'server',
    cwd: path.join(PACKAGES, 'server'),
    getCmd: () => process.execPath,
    getArgs: () => [...sqliteFlagArg(), path.join('src', 'app.js')],
    port: 3000,
    env: { ...process.env, PORT: '3000' },
  },
  {
    name: 'Frontend',
    key: 'frontend',
    cwd: path.join(PACKAGES, 'frontend'),
    getCmd: () => process.execPath,
    args: [path.join('node_modules', 'vite', 'bin', 'vite.js')],
    port: 5173,
    env: { ...process.env, PORT: '5173' },
  },
];

function checkPort(port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

// 检查端口上是否已是可共享的健康 AI 服务（任何项目的 AI 都可以，project 字段在请求体里区分）
function checkServiceHealth(svc, timeout = 3000) {
  return new Promise((resolve) => {
    if (svc.key !== 'ai-service') {
      // 后端/前端服务不可跨项目复用（数据不同）
      resolve(false);
      return;
    }
    const req = require('http').get(
      { host: '127.0.0.1', port: svc.port, path: '/health', timeout },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve(res.statusCode === 200 && body.includes('"ok"')));
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForPort(port, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await checkPort(port)) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function checkEnv() {
  const checks = [];
  try {
    const v = execSync('node -v', { encoding: 'utf8' }).trim();
    const major = parseInt(v.slice(1).split('.')[0]);
    checks.push({ name: 'Node.js', ok: major >= 18, version: v, fix: 'https://nodejs.org/' });
  } catch {
    checks.push({ name: 'Node.js', ok: false, version: 'not found', fix: 'https://nodejs.org/' });
  }
  try {
    const v = execSync('python --version', { encoding: 'utf8' }).trim();
    checks.push({ name: 'Python', ok: true, version: v, fix: '' });
  } catch {
    try {
      const v = execSync('python3 --version', { encoding: 'utf8' }).trim();
      checks.push({ name: 'Python', ok: true, version: v, fix: '' });
    } catch {
      checks.push({ name: 'Python', ok: false, version: 'not found', fix: 'https://python.org/' });
    }
  }
  try {
    const v = execSync('pnpm -v', { encoding: 'utf8' }).trim();
    checks.push({ name: 'pnpm', ok: true, version: v, fix: '', optional: true });
  } catch {
    // pnpm 仅用于手动安装依赖，启动不再依赖它
    checks.push({ name: 'pnpm (可选)', ok: true, version: 'not found', fix: '', optional: true });
  }
  return checks;
}

function checkInstallStatus() {
  const status = {
    aiVenv: fs.existsSync(path.join(PACKAGES, 'ai', 'venv')),
    aiDeps: false,
    serverDeps: fs.existsSync(path.join(PACKAGES, 'server', 'node_modules')),
    frontendDeps: fs.existsSync(path.join(PACKAGES, 'frontend', 'node_modules')),
    config: fs.existsSync(path.join(ROOT, '.env')),
  };
  if (status.aiVenv) {
    try {
      const py = getPythonPath();
      execSync(`"${py}" -c "import fastapi"`, { stdio: 'pipe' });
      status.aiDeps = true;
    } catch {
      status.aiDeps = false;
    }
  }
  return status;
}

function startService(svc) {
  return new Promise(async (resolve) => {
    log(`[>] Starting ${svc.name}...`);
    const pidFile = path.join(PID_DIR, `${svc.key}.pid`);
    if (fs.existsSync(pidFile)) {
      const oldPid = fs.readFileSync(pidFile, 'utf8').trim();
      try {
        process.kill(parseInt(oldPid), 0);
        warn(`${svc.name} already running (PID: ${oldPid})`);
        resolve({ service: svc, status: 'already-running', pid: oldPid });
        return;
      } catch {
        fs.unlinkSync(pidFile);
      }
    }

    // 端口已被占用时：如果是我们自己同类的健康服务（如另一项目已启动的共享 AI），直接复用
    if (await checkPort(svc.port, 1500)) {
      if (await checkServiceHealth(svc)) {
        ok(`${svc.name} already running on :${svc.port} (shared), reusing`);
        resolve({ service: svc, status: 'shared', pid: null });
        return;
      }
      warn(`Port ${svc.port} is occupied by an unknown process; ${svc.name} may fail to start`);
    }

    const cmd = svc.getCmd();
    const args = svc.getArgs ? svc.getArgs() : svc.args;
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const logFile = path.join(LOG_DIR, `${svc.key}.log`);
    // 日志直接写入文件句柄，配合 detached + unref：
    // 父脚本退出后服务进程继续运行，日志持续追加，且 PID 文件记录的是真实进程
    const outFd = fs.openSync(logFile, 'a');
    const spawnOpts = {
      cwd: svc.cwd,
      env: svc.env,
      stdio: ['ignore', outFd, outFd],
      detached: true,
      windowsHide: IS_WIN,
      shell: false,
    };
    const proc = spawn(cmd, args, spawnOpts);
    fs.closeSync(outFd);

    // 防御：检查proc.pid是否存在
    if (!proc.pid) {
      error(`${svc.name} spawn failed: proc.pid is undefined`);
      error(`  Command: ${cmd} ${args.join(' ')}`);
      error(`  CWD: ${svc.cwd}`);
      resolve({ service: svc, status: 'failed', pid: null });
      return;
    }

    fs.writeFileSync(pidFile, proc.pid.toString());
    proc.unref();
    waitForPort(svc.port, 60000).then((ready) => {
      if (ready) {
        ok(`${svc.name} ready at http://localhost:${svc.port}`);
        resolve({ service: svc, status: 'ready', pid: proc.pid });
      } else {
        warn(`${svc.name} starting, may need more time`);
        resolve({ service: svc, status: 'starting', pid: proc.pid });
      }
    });
    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        error(`${svc.name} exited with code ${code}`);
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      }
    });
  });
}

async function main() {
  printTitle('Bill-Bookkeeper Start');
  if (!fs.existsSync(PID_DIR)) fs.mkdirSync(PID_DIR, { recursive: true });
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  info('Checking environment...');
  const envChecks = checkEnv();
  const allOk = envChecks.every(c => c.ok);
  for (const c of envChecks) {
    if (c.ok) ok(`${c.name}: ${c.version}`);
    else { error(`${c.name}: ${c.version}`); if (c.fix) log(`   Fix: ${c.fix}`); }
  }
  if (!allOk) { error('Environment check failed'); process.exit(1); }

  const installStatus = checkInstallStatus();
  if (!installStatus.aiVenv || !installStatus.aiDeps || !installStatus.serverDeps || !installStatus.frontendDeps) {
    warn('Dependencies not fully installed');
    log('');
    log('Please run install script:');
    log(IS_WIN ? '   Double-click install.bat' : '   bash install.sh');
    process.exit(1);
  }
  if (!installStatus.config) {
    warn('AI config not set');
    log('');
    log('Please run config script:');
    log(IS_WIN ? '   Double-click config.bat' : '   bash config.sh');
    process.exit(1);
  }
  ok('Environment check passed');
  log('');

  const results = [];
  for (const svc of SERVICES) {
    const result = await startService(svc);
    results.push(result);
  }

  log('');
  log(styled('Service Status:', C.bold));
  for (const r of results) {
    const statusText = r.status === 'ready' ? styled('READY', C.green) : r.status === 'shared' ? styled('SHARED', C.cyan) : r.status === 'already-running' ? styled('RUNNING', C.yellow) : styled('STARTING', C.yellow);
    log(`  [OK] ${r.service.name}: ${statusText} (PID: ${r.pid})`);
  }

  log('');
  log(styled('URLs:', C.bold));
  log(`  Frontend: ${styled('http://localhost:5173', C.cyan)}`);
  log(`  API:      ${styled('http://localhost:3000', C.cyan)}`);
  log(`  AI:       ${styled('http://localhost:5000', C.cyan)}`);

  log('');
  log(styled('Logs:', C.bold) + ` ${LOG_DIR}`);
  log('');
  log(`Stop: ${styled(IS_WIN ? 'Double-click stop.bat' : 'bash stop.sh', C.yellow)}`);
}

main().catch(e => {
  error(`Start failed: ${e.message}`);
  process.exit(1);
});
