const express = require('express');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const config = require('../config');

const router = express.Router();

const PID_DIR = path.join(config.rootDir, '.pids');
const LOG_DIR = path.join(config.rootDir, 'data', 'logs');
// 开机自启动：Startup 文件夹中的隐藏启动 VBS（无需管理员权限）
const STARTUP_DIR = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const AUTOSTART_VBS = path.join(STARTUP_DIR, 'bill-bookkeeper.vbs');

// 优先用用户自己的 Node（nvm），其次用当前进程 Node——node:sqlite 下两者均可
function pickNodeExe() {
  const nvmNode = 'C:\\nvm4w\\nodejs\\node.exe';
  return fs.existsSync(nvmNode) ? nvmNode : process.execPath;
}

// AI 能力已在 server 进程内实现（src/ai/），不再作为独立服务单列
const SERVICES = [
  { key: 'server', name: '后端服务', port: 3000, health: '/health' },
  { key: 'frontend', name: '前端界面', port: 5173, health: null },
];

function tcpCheck(port, timeout = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

function httpCheck(port, path_, timeout = 2000) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: path_, timeout }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function readPid(key) {
  try {
    return parseInt(fs.readFileSync(path.join(PID_DIR, `${key}.pid`), 'utf8').trim(), 10) || null;
  } catch {
    return null;
  }
}

// GET /api/system/status - 两服务状态
router.get('/status', async (req, res) => {
  const services = await Promise.all(SERVICES.map(async (s) => {
    const up = s.health ? await httpCheck(s.port, s.health) : await tcpCheck(s.port);
    return { key: s.key, name: s.name, port: s.port, running: up, pid: readPid(s.key) };
  }));
  res.json({ success: true, data: services });
});

// POST /api/system/restart - 重启全部服务（先应答，再自杀式重启）
router.post('/restart', (req, res) => {
  res.json({ success: true, message: '正在重启，约 10 秒后刷新页面' });
  const script = `"${process.execPath}" "${path.join(config.rootDir, 'scripts', '_core-stop.js')}" && "${process.execPath}" "${path.join(config.rootDir, 'scripts', '_core-start.js')}"`;
  const child = spawn(process.env.COMSPEC || 'cmd.exe', ['/c', script], {
    cwd: config.rootDir,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  child.unref();
});

// GET /api/system/autostart - 查询开机自启动状态
router.get('/autostart', (req, res) => {
  res.json({ success: true, data: { enabled: fs.existsSync(AUTOSTART_VBS) } });
});

// POST /api/system/autostart {enabled} - 开关开机自启动（Startup 文件夹 VBS，免管理员）
router.post('/autostart', (req, res) => {
  const enabled = Boolean(req.body && req.body.enabled);
  try {
    if (enabled) {
      const nodeExe = pickNodeExe();
      const startScript = path.join(config.rootDir, 'scripts', '_core-start.js');
      const vbs = `Set ws = CreateObject("Wscript.Shell")\nws.CurrentDirectory = "${config.rootDir}"\nws.Run """${nodeExe}"" ""${startScript}""", 0, False\n`;
      fs.mkdirSync(STARTUP_DIR, { recursive: true });
      fs.writeFileSync(AUTOSTART_VBS, vbs, 'utf8');
    } else if (fs.existsSync(AUTOSTART_VBS)) {
      fs.unlinkSync(AUTOSTART_VBS);
    }
    res.json({ success: true, data: { enabled } });
  } catch (e) {
    res.status(500).json({ success: false, error: `自启动设置失败：${e.message}` });
  }
});

// GET /api/system/logs?service=server&lines=100 - 查看服务日志尾部
router.get('/logs', (req, res) => {
  const allowed = ['server', 'frontend'];
  const service = allowed.includes(req.query.service) ? req.query.service : 'server';
  const lines = Math.min(parseInt(req.query.lines, 10) || 100, 500);
  try {
    const logFile = path.join(LOG_DIR, `${service}.log`);
    if (!fs.existsSync(logFile)) {
      return res.json({ success: true, data: { service, content: '（暂无日志）' } });
    }
    const content = fs.readFileSync(logFile, 'utf8');
    const tail = content.split(/\r?\n/).slice(-lines).join('\n');
    res.json({ success: true, data: { service, content: tail } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
