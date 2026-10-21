#!/usr/bin/env node
/**
 * Bill-Bookkeeper Core Stop
 * Cross-platform
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const IS_WIN = os.platform() === 'win32';
const ROOT = path.resolve(__dirname, '..');
const PID_DIR = path.join(ROOT, '.pids');

const ALL_SERVICES = [
  { key: 'server', name: 'Server', port: 3000 },
  { key: 'frontend', name: 'Frontend', port: 5173 },
];

function log(msg) { console.log(msg); }

function killByPidFile(key) {
  const pidFile = path.join(PID_DIR, `${key}.pid`);
  if (!fs.existsSync(pidFile)) return { success: false, reason: 'no-pid' };
  const pid = fs.readFileSync(pidFile, 'utf8').trim();
  try {
    if (IS_WIN) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      try { process.kill(parseInt(pid), 'SIGTERM'); } catch {}
      try { execSync(`sleep 2 && kill -9 ${pid} 2>/dev/null || true`, { stdio: 'ignore' }); } catch {}
    }
    fs.unlinkSync(pidFile);
    return { success: true, pid };
  } catch (e) {
    fs.unlinkSync(pidFile);
    return { success: false, reason: 'dead', pid };
  }
}

function killByPort(port) {
  try {
    if (IS_WIN) {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = result.split('\n').filter(l => l.includes('LISTENING'));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid))) {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
          return { success: true, pid };
        }
      }
    } else {
      const result = execSync(`lsof -ti:${port} 2>/dev/null || echo ""`, { encoding: 'utf8' });
      const pids = result.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: 'ignore' });
      }
      return { success: true, pid: pids.join(',') };
    }
    return { success: false, reason: 'no-process' };
  } catch {
    return { success: false, reason: 'no-process' };
  }
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ALL_SERVICES.map(s => s.key);

  log('');
  log('========================================');
  log('  Bill-Bookkeeper Stop');
  log('========================================');
  log('');

  let stopped = 0;
  let notFound = 0;

  for (const key of targets) {
    const svc = ALL_SERVICES.find(s => s.key === key);
    const svcName = svc ? svc.name : key;
    const result = killByPidFile(key);
    if (result.success) {
      log(`[OK] ${svcName} stopped (PID: ${result.pid})`);
      stopped++;
    } else if (result.reason === 'no-pid') {
      const portResult = killByPort(svc?.port || 0);
      if (portResult.success) {
        log(`[OK] ${svcName} stopped (port: ${svc?.port})`);
        stopped++;
      } else {
        log(`[INFO] ${svcName} not running`);
        notFound++;
      }
    } else {
      log(`[OK] ${svcName} stopped (process exited)`);
      stopped++;
    }
  }

  if (fs.existsSync(PID_DIR)) {
    const files = fs.readdirSync(PID_DIR).filter(f => f.endsWith('.pid'));
    if (files.length === 0) {
      try { fs.rmdirSync(PID_DIR); } catch {}
    }
  }

  log('');
  log(`Stopped: ${stopped} / ${targets.length}`);
  log('All services stopped');
  log('');
}

main();
