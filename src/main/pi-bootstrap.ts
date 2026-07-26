/**
 * guiying Bootstrap — 首次启动时完成所有初始化。
 *
 * 在 app.whenReady() 后异步调用。幂等：已初始化则跳过。
 *
 * 初始化内容：
 *   1. 复制捆绑的 Pi skills + extensions + config 到 ~/.pi/agent/
 *   2. 确保 Pi CLI 已安装（自动 npm install -g）
 *   3. 安装 Pi npm 包（pi-web-access 等）
 *
 * 自动化任务模板（策略PPT / 出圈事件营销 / 品牌叙事策展）已直接编译进
 * UI 源码 src/renderer/.../automation-templates.ts，无需运行时注入。
 */
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync, execSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// 路径
// ---------------------------------------------------------------------------

function getBundledPiDir(): string {
  const devPath = join(__dirname, '..', '..', 'resources', 'pi-bundle')
  if (existsSync(devPath)) return devPath
  return join(process.resourcesPath, 'pi-bundle')
}

function getUserPiDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  return join(home, '.pi', 'agent')
}

// ---------------------------------------------------------------------------
// Pi CLI 检测与安装
// ---------------------------------------------------------------------------

function isPiCliInstalled(): boolean {
  try {
    execSync(process.platform === 'win32' ? 'where pi' : 'which pi', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function isNodeInstalled(): boolean {
  try {
    execSync(process.platform === 'win32' ? 'where node' : 'which node', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function installPiCli(log: (msg: string) => void): boolean {
  if (!isNodeInstalled()) {
    log('Node.js not found — please install Node.js first: https://nodejs.org')
    return false
  }
  try {
    log('Installing Pi CLI (npm install -g @earendil-works/pi-coding-agent)...')
    execFileSync('npm', ['install', '-g', '@earendil-works/pi-coding-agent'], {
      stdio: 'pipe',
      timeout: 120000
    })
    log('Pi CLI installed ✓')
    return true
  } catch (err: any) {
    log(`Pi CLI install failed: ${err?.message || err}`)
    return false
  }
}

function installPiPackages(log: (msg: string) => void): void {
  const packages = ['pi-web-access', 'pi-mcp-adapter', 'pi-subagents', 'context-mode']
  for (const pkg of packages) {
    try {
      execFileSync('pi', ['install', `npm:${pkg}`], {
        env: { ...process.env, HOME: process.env.HOME || process.env.USERPROFILE || '~' },
        timeout: 60000,
        stdio: 'pipe'
      })
      log(`pi install npm:${pkg} ✓`)
    } catch {
      log(`pi install npm:${pkg} ✗ (will retry next launch)`)
    }
  }
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

let bootstrapDone = false

export async function runPiBootstrap(): Promise<void> {
  if (bootstrapDone) return
  bootstrapDone = true

  const bundled = getBundledPiDir()
  if (!existsSync(bundled)) {
    console.warn('[guiying] Pi bundle not found at:', bundled)
    return
  }

  const userDir = getUserPiDir()
  const markerPath = join(userDir, '.guiying-bootstrap-done')
  const logs: string[] = []
  const log = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
    console.log(`[guiying] ${msg}`)
  }

  log('=== guiying bootstrap start ===')

  // ── 已初始化过 ──────────────────────────────────────────
  if (existsSync(markerPath)) {
    log('Bootstrap already completed, checking for new packages...')
    if (isPiCliInstalled()) {
      installPiPackages(log)
    }
    return
  }

  try {
    // ── 1. Skills ────────────────────────────────────────
    {
      const srcDir = join(bundled, 'skills')
      const dstDir = join(userDir, 'skills')
      mkdirSync(dstDir, { recursive: true })
      cpSync(srcDir, dstDir, { recursive: true, force: true })
      log('Skills installed ✓ (23)')
    }

    // ── 2. Extensions ───────────────────────────────────
    {
      const srcDir = join(bundled, 'extensions')
      const dstDir = join(userDir, 'extensions')
      mkdirSync(dstDir, { recursive: true })
      cpSync(srcDir, dstDir, { recursive: true, force: true })
      log('Extensions installed ✓ (2)')
    }

    // ── 3. Settings ─────────────────────────────────────
    {
      const srcSettings = join(bundled, 'config', 'settings.json')
      const dstSettings = join(userDir, 'settings.json')
      if (existsSync(srcSettings)) {
        const bundledCfg = JSON.parse(readFileSync(srcSettings, 'utf8'))
        let finalCfg = bundledCfg
        if (existsSync(dstSettings)) {
          const existingCfg = JSON.parse(readFileSync(dstSettings, 'utf8'))
          finalCfg = { ...bundledCfg, ...existingCfg }
          finalCfg.skills = [...new Set([...(bundledCfg.skills || []), ...(existingCfg.skills || [])])]
          finalCfg.extensions = [...new Set([...(bundledCfg.extensions || []), ...(existingCfg.extensions || [])])]
          finalCfg.packages = [...new Set([...(bundledCfg.packages || []), ...(existingCfg.packages || [])])]
        }
        mkdirSync(userDir, { recursive: true })
        writeFileSync(dstSettings, JSON.stringify(finalCfg, null, 2))
        log('Settings merged ✓')
      }
    }

    // ── 4. Pi CLI ───────────────────────────────────────
    if (!isPiCliInstalled()) {
      installPiCli(log)
    } else {
      log('Pi CLI already installed ✓')
    }

    // ── 5. Pi Packages ──────────────────────────────────
    if (isPiCliInstalled()) {
      installPiPackages(log)
    }

    writeFileSync(markerPath, JSON.stringify({ installedAt: new Date().toISOString(), logs }, null, 2))
    log('=== guiying bootstrap complete ===')
  } catch (err: any) {
    log(`Bootstrap error: ${err?.message || err}`)
    console.error('[guiying] Bootstrap error:', err)
  }
}
