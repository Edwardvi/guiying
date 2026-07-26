/**
 * guiying Bootstrap — 首次启动时完成所有初始化。
 *
 * 在 app.whenReady() 后异步调用。幂等：已初始化则跳过。
 *
 * 初始化内容：
 *   1. 复制捆绑的 Pi skills + extensions + config 到 ~/.pi/agent/
 *   2. 确保 Pi CLI 已安装（自动 npm install -g）
 *   3. 安装 Pi npm 包（pi-web-access 等）
 *   4. 注入预设自动化模板（策略PPT、出圈事件等）
 */
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync, execSync } from 'node:child_process'
import { app } from 'electron'

// ---------------------------------------------------------------------------
// 路径解析
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

function getOrcaDataDir(): string {
  // Orca 用户数据目录（用于注入 automations）
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  // macOS: ~/Library/Application Support/Orca
  // Windows: %APPDATA%/Orca
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'guiying')
  } else if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'guiying')
  }
  return join(home, '.config', 'guiying')
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function isPiCliInstalled(): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where pi' : 'which pi'
    execSync(cmd, { stdio: 'ignore' })
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
    log('Node.js not found — user must install Node.js first')
    log('Download from https://nodejs.org')
    return false
  }
  try {
    log('Installing Pi CLI...')
    execFileSync('npm', ['install', '-g', '@earendil-works/pi-coding-agent'], {
      stdio: 'pipe',
      timeout: 120000
    })
    log('Pi CLI installed successfully')
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
      log(`pi install npm:${pkg} ✗ (retry next launch)`)
    }
  }
}

/**
 * 把 automation 模板注入到 Orca 的 Store 中。
 * Orca 通过 Store 持久化 automations；我们先读取现有 automations，
 * 合并模板（按 id 去重），再写回。
 */
function injectAutomationTemplates(
  bundledDir: string,
  orcaDataDir: string,
  log: (msg: string) => void
): void {
  const templatesPath = join(bundledDir, 'automations', 'templates.json')
  if (!existsSync(templatesPath)) {
    log('No automation templates found')
    return
  }

  try {
    const templates = JSON.parse(readFileSync(templatesPath, 'utf8'))

    // Orca 用 electron-store 持久化数据，存储文件通常是 config.json 或 store.json
    // 在不同平台路径不同。我们直接操作 Orca 的 Store 文件。
    const storePaths = [
      join(orcaDataDir, 'config.json'),
      join(orcaDataDir, 'store.json'),
      join(orcaDataDir, 'data.json')
    ]
    let storePath = storePaths.find((p) => existsSync(p))

    if (!storePath) {
      // Store 还不存在（Orca 还没运行过），创建初始 store
      storePath = join(orcaDataDir, 'config.json')
      mkdirSync(orcaDataDir, { recursive: true })
    }

    let store: any = {}
    if (existsSync(storePath)) {
      try {
        store = JSON.parse(readFileSync(storePath, 'utf8'))
      } catch {
        store = {}
      }
    }

    // 确保 automations 数组存在
    if (!store.automations) store.automations = []

    // 合并模板（按 id 去重）
    const existingIds = new Set(store.automations.map((a: any) => a.id))
    const newAutomations = templates.filter((t: any) => !existingIds.has(t.id))

    if (newAutomations.length > 0) {
      store.automations.push(...newAutomations)
      writeFileSync(storePath, JSON.stringify(store, null, 2))
      log(`Injected ${newAutomations.length} automation templates: ${newAutomations.map((a: any) => a.name).join(', ')}`)
    } else {
      log('All automation templates already present')
    }
  } catch (err: any) {
    log(`Automation injection failed: ${err?.message || err}`)
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

  // ── 幂等检查 ──────────────────────────────────────────────
  if (existsSync(markerPath)) {
    // 已初始化过，但仍然尝试注入可能新增的 automations
    const orcaDir = getOrcaDataDir()
    injectAutomationTemplates(bundled, orcaDir, log)

    // 检查 Pi 是否有新包需要安装
    if (isPiCliInstalled()) {
      installPiPackages(log)
    }
    return
  }

  try {
    // ── 1. Skills ──────────────────────────────────────────
    {
      const srcDir = join(bundled, 'skills')
      const dstDir = join(userDir, 'skills')
      mkdirSync(dstDir, { recursive: true })
      cpSync(srcDir, dstDir, { recursive: true, force: true })
      log('Skills ✓ (23)')
    }

    // ── 2. Extensions ──────────────────────────────────────
    {
      const srcDir = join(bundled, 'extensions')
      const dstDir = join(userDir, 'extensions')
      mkdirSync(dstDir, { recursive: true })
      cpSync(srcDir, dstDir, { recursive: true, force: true })
      log('Extensions ✓ (2)')
    }

    // ── 3. Settings ────────────────────────────────────────
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
        log('Settings ✓')
      }
    }

    // ── 4. Pi CLI ──────────────────────────────────────────
    if (!isPiCliInstalled()) {
      if (installPiCli(log) && isPiCliInstalled()) {
        log('Pi CLI auto-installed ✓')
      }
    } else {
      log('Pi CLI already installed ✓')
    }

    // ── 5. Pi Packages ─────────────────────────────────────
    if (isPiCliInstalled()) {
      installPiPackages(log)
    }

    // ── 6. Automation Templates ────────────────────────────
    {
      const orcaDir = getOrcaDataDir()
      injectAutomationTemplates(bundled, orcaDir, log)
    }

    // ── 写入标记 ──────────────────────────────────────────
    writeFileSync(markerPath, JSON.stringify({ installedAt: new Date().toISOString(), logs }, null, 2))
    log('=== guiying bootstrap complete ===')
  } catch (err: any) {
    log(`Bootstrap error: ${err?.message || err}`)
    console.error('[guiying] Bootstrap error:', err)
  }
}
