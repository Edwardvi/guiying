/**
 * guiying Bootstrap — 首次启动时复制捆绑的 Pi 运行时到用户目录。
 *
 * 在 app.whenReady() 后异步调用。幂等：已初始化则跳过。
 *
 * 捆绑内容（构建时由 config/scripts/bundle-pi.cjs 预装）:
 *   resources/pi-bundle/        skills + extensions + config (~22MB)
 *   resources/pi-runtime/       Pi CLI + 4 npm 包
 *
 * 启动时做的事:
 *   1. 复制 skills → ~/.pi/agent/skills/
 *   2. 复制 extensions → ~/.pi/agent/extensions/
 *   3. 合并 settings → ~/.pi/agent/settings.json
 *   4. 复制 pi-runtime → ~/.pi/agent/npm/（离线，无需网络）
 *
 * 自动化任务模板（策略PPT 等）已编译进 UI 源码，无需运行时注入。
 */
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, chmodSync, unlinkSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// 路径
// ---------------------------------------------------------------------------

function getResourcesDir(): string {
  if (existsSync(join(__dirname, '..', '..', 'resources'))) {
    return join(__dirname, '..', '..', 'resources')
  }
  return process.resourcesPath
}

function getBundledPiDir(): string {
  return join(getResourcesDir(), 'pi-bundle')
}

function getBundledPiRuntimeDir(): string {
  return join(getResourcesDir(), 'pi-runtime')
}

function getUserPiDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  return join(home, '.pi', 'agent')
}

// ---------------------------------------------------------------------------
// 注册 pi 命令到系统 PATH
// ---------------------------------------------------------------------------

function registerPiCommand(userDir: string, log: (msg: string) => void): void {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  const piEntry = join(userDir, 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent')

  if (!existsSync(piEntry)) {
    log('Pi entry not found — skip PATH registration')
    return
  }

  // 使用 Electron 内置的 Node.js 来运行 Pi（用户无需单独安装 Node）
  const electronBin = process.execPath  // Electron 可执行文件路径
  const piCliPath = join(piEntry, 'dist', 'cli.js')

  if (process.platform === 'win32') {
    // 策略：
    // 1. 优先 %USERPROFILE%\pi.cmd（用户目录，always writable）
    // 2. 然后修改注册表把 %USERPROFILE% 加入 PATH
    // 3. 同时写入 %LOCALAPPDATA%/Microsoft/WindowsApps（已在 PATH）
    //
    // Windows 修改注册表 PATH 需要 logout/login 才生效。
    // 但 WindowsApps 目录已在 PATH → 作为立即生效的冗余备份。

    const piCmdContent =
      `@echo off\r\n` +
      `set PI_CODING_AGENT_DIR=${userDir}\r\n` +
      `set ELECTRON_RUN_AS_NODE=1\r\n` +
      `"${electronBin}" "${piCliPath}" %*\r\n`

    // 副本 1: %USERPROFILE%\pi.cmd（永久备份）
    const homeCmdPath = join(process.env.USERPROFILE || home, 'pi.cmd')
    writeFileSync(homeCmdPath, piCmdContent)
    log(`pi.cmd → ${homeCmdPath} ✓`)

    // 副本 2: %APPDATA%/npm（Node.js 用户已在 PATH，立即生效）
    try {
      const npmDir = join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'npm')
      mkdirSync(npmDir, { recursive: true })
      writeFileSync(join(npmDir, 'pi.cmd'), piCmdContent)
      log('pi.cmd → %%APPDATA%%/npm ✓ (immediate PATH coverage)')
    } catch (err: any) {
      log(`npm dir write failed (non-fatal): ${err?.message || err}`)
    }

    // 副本 3: appDir（与 Guiying.exe 同目录）
    try {
      const appDir = join(electronBin, '..')
      mkdirSync(appDir, { recursive: true })
      writeFileSync(join(appDir, 'pi.cmd'), piCmdContent)
    } catch { /* read-only filesystem */ }

    // 注册表：持久化 PATH（新进程 logout/login 后生效）
    const homeDir = process.env.USERPROFILE || home
    addToWindowsUserPath(homeDir, log)
  } else {
    // macOS/Linux: 优先写入 /usr/local/bin（在默认 PATH 上，GUI app 可用）
    let binDir = '/usr/local/bin'
    try {
      mkdirSync('/usr/local/bin', { recursive: true })
    } catch {
      // /usr/local/bin 不可写，回退到 ~/.local/bin
      binDir = join(home, '.local', 'bin')
      mkdirSync(binDir, { recursive: true })
    }

    const linkPath = join(binDir, 'pi')
    const shim = [
      '#!/bin/sh',
      `export PI_CODING_AGENT_DIR="${userDir}"`,
      'export ELECTRON_RUN_AS_NODE=1',
      `exec "${electronBin}" "${piCliPath}" "$@"`
    ].join('\n')

    try { unlinkSync(linkPath) } catch {}
    writeFileSync(linkPath, shim)
    try { chmodSync(linkPath, 0o755) } catch {}
    log(`pi registered at ${linkPath} ✓ (uses Electron's Node.js)`)
  }
}

function addToWindowsUserPath(dir: string, log: (msg: string) => void): void {
  try {
    const result = execFileSync('reg', [
      'query', 'HKCU\\Environment', '/v', 'Path'
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const currentPath = result.match(/Path\s+REG_[A-Z]+\s+(.+)/)?.[1]?.trim() || ''

    if (!currentPath.split(';').some((p) => p.trim().toLowerCase() === dir.toLowerCase())) {
      const newPath = currentPath ? `${currentPath};${dir}` : dir
      execFileSync('reg', [
        'add', 'HKCU\\Environment', '/v', 'Path',
        '/t', 'REG_EXPAND_SZ', '/d', newPath, '/f'
      ], { stdio: 'ignore' })
      log(`Added ${dir} to user PATH (registry) ✓`)
    }
  } catch (err: any) {
    log(`Windows PATH registry update failed (non-fatal): ${err?.message || err}`)
  }
}

function ensurePiCommandAvailable(userDir: string, log: (msg: string) => void): void {
  // 检查 pi 是否通过任意方式可达
  const homePath = process.env.USERPROFILE || process.env.HOME || require('node:os').homedir()
  const candidates = process.platform === 'win32'
    ? [
        join(homePath, 'pi.cmd'),
        join(process.env.APPDATA || '', 'npm', 'pi.cmd'),
        join(process.execPath, '..', 'pi.cmd')
      ]
    : ['/usr/local/bin/pi', join(homePath, '.local', 'bin', 'pi')]

  const { existsSync: es } = require('node:fs')
  if (candidates.some((p) => es(p))) {
    return  // pi 文件已存在
  }

  log('pi not found — re-registering...')
  registerPiCommand(userDir, log)
}

function checkOpenCodeGoAuth(userDir: string, log: (msg: string) => void): void {
  const authFile = join(userDir, 'auth.json')
  if (!existsSync(authFile)) {
    log('⚠ OpenCodeGo 未配置 — 请在终端中运行 pi /login opencode-go')
    log('  选择 "API Key" 方式，输入你的 OpenCodeGo key')
    return
  }
  try {
    const auth = JSON.parse(readFileSync(authFile, 'utf8'))
    if (auth['opencode-go']?.key) {
      log('OpenCodeGo ✓ 已配置')
    } else {
      log('⚠ OpenCodeGo 未配置 — 请在终端中运行 pi /login opencode-go')
      log('  选择 "API Key" 方式，输入你的 OpenCodeGo key')
    }
  } catch {
    log('⚠ 无法读取 auth.json')
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
  const log = (msg: string) => console.log(`[guiying] ${msg}`)

  log('=== guiying bootstrap start ===')

  // ── 已初始化过 ──────────────────────────────────────────
  if (existsSync(markerPath)) {
    log('Bootstrap already completed, checking Pi availability...')
    ensurePiCommandAvailable(userDir, log)
    checkOpenCodeGoAuth(userDir, log)
    return
  }

  try {
    // ── 1. Skills ────────────────────────────────────────
    {
      const srcDir = join(bundled, 'skills')
      const dstDir = join(userDir, 'guiying-skills')
      mkdirSync(dstDir, { recursive: true })
      // 安全复制：不覆盖用户已有的同名 skill
      for (const name of readdirSync(srcDir)) {
        const src = join(srcDir, name)
        const dst = join(dstDir, name)
        if (!existsSync(dst)) {
          cpSync(src, dst, { recursive: true })
        }
      }
      log('Skills copied ✓ (20) → guiying-skills/')
    }

    // ── 2. Extensions ───────────────────────────────────
    {
      const srcDir = join(bundled, 'extensions')
      const dstDir = join(userDir, 'guiying-extensions')
      mkdirSync(dstDir, { recursive: true })
      for (const name of readdirSync(srcDir)) {
        const src = join(srcDir, name)
        const dst = join(dstDir, name)
        if (!existsSync(dst)) {
          cpSync(src, dst)
        }
      }
      log('Extensions copied ✓ (2) → guiying-extensions/')
    }

    // ── 3. Settings ─────────────────────────────────────
    {
      const src = join(bundled, 'config', 'settings.json')
      const dst = join(userDir, 'settings.json')
      if (existsSync(src)) {
        const bundledCfg = JSON.parse(readFileSync(src, 'utf8'))
        let finalCfg = bundledCfg
        if (existsSync(dst)) {
          const existingCfg = JSON.parse(readFileSync(dst, 'utf8'))
          finalCfg = { ...bundledCfg, ...existingCfg }
          finalCfg.skills = [...new Set([...(bundledCfg.skills || []), ...(existingCfg.skills || [])])]
          finalCfg.extensions = [...new Set([...(bundledCfg.extensions || []), ...(existingCfg.extensions || [])])]
          finalCfg.packages = [...new Set([...(bundledCfg.packages || []), ...(existingCfg.packages || [])])]
        }
        mkdirSync(userDir, { recursive: true })
        writeFileSync(dst, JSON.stringify(finalCfg, null, 2))
        log('Settings merged ✓')
      }
    }

    // ── 4. Pi 运行时（离线复制，无需网络）─────────────────
    const runtimeDir = getBundledPiRuntimeDir()
    if (existsSync(runtimeDir)) {
      const dst = join(userDir, 'npm')
      mkdirSync(dst, { recursive: true })
      cpSync(runtimeDir, dst, { recursive: true, force: true })
      log('Pi runtime copied ✓ (offline)')

      // ── 注册 pi 命令到系统 PATH ──────────────────────
      registerPiCommand(userDir, log)
    } else {
      log('⚠ Pi runtime bundle not found in app resources')
      log('  This is a build issue — please report it.')
      log('  As a workaround, install Pi manually:')
      log('  npm install -g @earendil-works/pi-coding-agent')
      log('  Then restart guiying.')
    }

    writeFileSync(markerPath, JSON.stringify({ installedAt: new Date().toISOString() }, null, 2))
    log('=== guiying bootstrap complete ===')

    // ── 6. OpenCodeGo 登录检查 ─────────────────────────
    checkOpenCodeGoAuth(userDir, log)
  } catch (err: any) {
    log(`Bootstrap error: ${err?.message || err}`)
    console.error('[guiying] Bootstrap error:', err)
  }
}
