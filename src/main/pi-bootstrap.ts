/**
 * guiying Bootstrap — 首次启动时复制捆绑的 Pi 运行时到用户目录。
 *
 * 在 app.whenReady() 后异步调用。幂等：已初始化则跳过。
 *
 * 捆绑内容（构建时由 config/scripts/bundle-pi.mjs 预装）:
 *   resources/pi-bundle/        skills + extensions + config (169MB)
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
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

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
    const npmDir = join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'npm')
    mkdirSync(npmDir, { recursive: true })
    const cmdPath = join(npmDir, 'pi.cmd')
    writeFileSync(cmdPath,
      `@echo off\r\n` +
      `set PI_CODING_AGENT_DIR=${userDir}\r\n` +
      `set ELECTRON_RUN_AS_NODE=1\r\n` +
      `"${electronBin}" "${piCliPath}" %*\r\n`
    )
    log(`pi.cmd registered at ${cmdPath} ✓`)
  } else {
    const binDir = join(home, '.local', 'bin')
    mkdirSync(binDir, { recursive: true })
    const linkPath = join(binDir, 'pi')

    const shim = [
      '#!/bin/sh',
      `export PI_CODING_AGENT_DIR="${userDir}"`,
      'export ELECTRON_RUN_AS_NODE=1',
      `exec "${electronBin}" "${piCliPath}" "$@"`
    ].join('\n')

    try { unlinkSync(linkPath) } catch {}
    writeFileSync(linkPath, shim)
    chmodSync(linkPath, 0o755)
    log(`pi registered at ${linkPath} ✓ (uses Electron's Node.js)`)
  }

  if (process.platform !== 'win32') {
    ensureLocalBinInPath(home, log)
  }
}

function ensureLocalBinInPath(home: string, log: (msg: string) => void): void {
  const localBin = join(home, '.local', 'bin')
  const shellRc = process.env.SHELL?.includes('zsh')
    ? join(home, '.zshrc')
    : join(home, '.bashrc')

  if (existsSync(shellRc)) {
    const content = readFileSync(shellRc, 'utf8')
    if (!content.includes(localBin)) {
      writeFileSync(shellRc,
        content + `\n# guiying — Pi agent PATH\nexport PATH="${localBin}:$PATH"\n`
      )
      log(`Added ${localBin} to ${shellRc} ✓`)
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
  const log = (msg: string) => console.log(`[guiying] ${msg}`)

  log('=== guiying bootstrap start ===')

  // ── 已初始化过 ──────────────────────────────────────────
  if (existsSync(markerPath)) {
    log('Bootstrap already completed, skipping')
    return
  }

  try {
    // ── 1. Skills ────────────────────────────────────────
    {
      const src = join(bundled, 'skills')
      const dst = join(userDir, 'skills')
      mkdirSync(dst, { recursive: true })
      cpSync(src, dst, { recursive: true, force: true })
      log('Skills copied ✓ (23)')
    }

    // ── 2. Extensions ───────────────────────────────────
    {
      const src = join(bundled, 'extensions')
      const dst = join(userDir, 'extensions')
      mkdirSync(dst, { recursive: true })
      cpSync(src, dst, { recursive: true, force: true })
      log('Extensions copied ✓ (2)')
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
      log('Pi runtime bundle not found — user needs npm install -g pi')
    }

    writeFileSync(markerPath, JSON.stringify({ installedAt: new Date().toISOString() }, null, 2))
    log('=== guiying bootstrap complete ===')
  } catch (err: any) {
    log(`Bootstrap error: ${err?.message || err}`)
    console.error('[guiying] Bootstrap error:', err)
  }
}
