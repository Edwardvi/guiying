/**
 * guiying Bootstrap — 首次启动时复制捆绑的 Pi 运行时到用户目录。
 *
 * 在 app.whenReady() 后异步调用。幂等：标记文件存在则跳过。
 *
 * 捆绑内容:
 *   resources/pi-bundle/   skills + extensions + config
 *   resources/pi-runtime/  macOS: node_modules | Win: pi-packages.tar.gz
 *
 * 启动时做的事:
 *   1. 复制 skills/extensions/config
 *   2. 安装 Pi（macOS:复制, Win:解压 tar.gz）
 *   3. 注册 pi 命令到系统 PATH
 *   4. 检查 OpenCodeGo 认证
 */
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, chmodSync, unlinkSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { BrowserWindow } from 'electron'

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
// Pi 命令注册
// ---------------------------------------------------------------------------

function registerPiCommand(userDir: string, log: (msg: string) => void): void {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  const piEntry = join(userDir, 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent')
  if (!existsSync(piEntry)) { log('Pi entry not found'); return }

  const electronBin = process.execPath
  const piCliPath = join(piEntry, 'dist', 'cli.js')

  if (process.platform === 'win32') {
    const appDir = join(electronBin, '..')
    const cmdPath = join(appDir, 'pi.cmd')
    mkdirSync(appDir, { recursive: true })
    writeFileSync(cmdPath,
      `@echo off\r\n` +
      `set PI_CODING_AGENT_DIR=${userDir}\r\n` +
      `set ELECTRON_RUN_AS_NODE=1\r\n` +
      `"${electronBin}" "${piCliPath}" %*\r\n`
    )
    log(`pi.cmd → ${cmdPath} ✓`)

    // 副本: %APPDATA%/npm (Node.js 用户 PATH)
    try {
      const npmDir = join(process.env.APPDATA || '', 'npm')
      mkdirSync(npmDir, { recursive: true })
      writeFileSync(join(npmDir, 'pi.cmd'),
        `@echo off\r\n` +
        `set PI_CODING_AGENT_DIR=${userDir}\r\n` +
        `set ELECTRON_RUN_AS_NODE=1\r\n` +
        `"${electronBin}" "${piCliPath}" %*\r\n`
      )
    } catch {}

    addToWindowsUserPath(appDir, log)
  } else {
    let binDir = '/usr/local/bin'
    try { mkdirSync('/usr/local/bin', { recursive: true }) }
    catch {
      binDir = join(home, '.local', 'bin')
      mkdirSync(binDir, { recursive: true })
      // 确保 ~/.local/bin 在 PATH（GUI app 环境可能没有）
      const rcFile = process.env.SHELL?.includes('zsh') ? join(home, '.zshrc') : join(home, '.bashrc')
      if (existsSync(rcFile)) {
        const exportLine = `export PATH="${binDir}:$PATH"`
        const content = readFileSync(rcFile, 'utf8')
        if (!content.split('\n').some((l: string) => l.trim() === exportLine.trim())) {
          writeFileSync(rcFile, content.trimEnd() + `\n# guiying — Pi agent PATH\n${exportLine}\n`)
        }
      }
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
    log(`pi → ${linkPath} ✓`)
  }
}

function addToWindowsUserPath(dir: string, log: (msg: string) => void): void {
  try {
    const result = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'Path'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
    })
    const currentPath = result.match(/Path\s+REG_[A-Z]+\s+(.+)/)?.[1]?.trim() || ''
    if (!currentPath.split(';').some((p) => p.trim().toLowerCase() === dir.toLowerCase())) {
      const newPath = currentPath ? `${currentPath};${dir}` : dir
      execFileSync('reg', ['add', 'HKCU\\Environment', '/v', 'Path',
        '/t', 'REG_EXPAND_SZ', '/d', newPath, '/f'], { stdio: 'ignore' })
      process.env.Path = process.env.Path ? `${process.env.Path};${dir}` : dir
      log(`Added ${dir} to PATH ✓`)
    }
  } catch {}
}

function checkPiCmdExists(): boolean {
  if (process.platform === 'win32') {
    return [join(process.execPath, '..', 'pi.cmd'),
            join(process.env.APPDATA || '', 'npm', 'pi.cmd')].some((p) => existsSync(p))
  }
  return ['/usr/local/bin/pi',
          join(process.env.HOME || '~', '.local', 'bin', 'pi')].some((p) => existsSync(p))
}

function installPiRuntime(userDir: string, log: (msg: string) => void): void {
  const runtimeDir = getBundledPiRuntimeDir()
  if (!existsSync(runtimeDir)) { log('Pi runtime not bundled'); return }

  const dst = join(userDir, 'npm')
  mkdirSync(dst, { recursive: true })

  if (process.platform === 'win32') {
    const tarFile = join(runtimeDir, 'pi-packages.tar.gz')
    if (!existsSync(tarFile)) { log('pi-packages.tar.gz not found'); return }
    log('Extracting Pi packages...')
    try {
      execFileSync('tar', ['-xzf', tarFile, '-C', dst], { stdio: 'pipe', timeout: 60000, windowsHide: true })
      log('Pi packages extracted ✓')
    } catch (err: any) {
      log(`Extraction failed: ${err?.message || err}`)
    }
  } else {
    cpSync(runtimeDir, dst, { recursive: true, force: true })
    log('Pi runtime copied ✓')
  }
}

function checkOpenCodeGoAuth(userDir: string, log: (msg: string) => void): void {
  const authFile = join(userDir, 'auth.json')
  if (!existsSync(authFile)) {
    log('⚠ OpenCodeGo 未配置 — 运行 pi /login opencode-go 输入 API key')
    return
  }
  try {
    const auth = JSON.parse(readFileSync(authFile, 'utf8'))
    if (auth['opencode-go']?.key) {
      log('OpenCodeGo ✓ 已配置')
    } else {
      log('⚠ OpenCodeGo 未配置')
    }
  } catch { log('⚠ 无法读取 auth.json') }
}

// ---------------------------------------------------------------------------
// 进度通知
// ---------------------------------------------------------------------------

const statusBuffer: string[] = []
let statusSubscriber: ((msg: string) => void) | null = null

function notify(msg: string): void {
  statusBuffer.push(msg)
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('guiying:bootstrap-status', msg)
    }
  } catch {}
  // 也写到日志文件，即使 UI 没准备好也能事后查看
  try {
    const { writeFileSync: wfs, appendFileSync: afs } = require('node:fs')
    const statusFile = join(process.env.HOME || process.env.USERPROFILE || '~', '.pi', 'agent', '.guiying-status.log')
    const { mkdirSync: mks } = require('node:fs')
    mks(join(process.env.HOME || process.env.USERPROFILE || '~', '.pi', 'agent'), { recursive: true })
    afs(statusFile, `${new Date().toISOString()} ${msg}\n`)
  } catch {}
}

export function getBufferedStatus(): string[] {
  return [...statusBuffer]
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

let bootstrapDone = false

export async function runPiBootstrap(): Promise<void> {
  if (bootstrapDone) return
  bootstrapDone = true

  const bundled = getBundledPiDir()
  if (!existsSync(bundled)) { console.warn('[guiying] Pi bundle not found'); return }

  const userDir = getUserPiDir()
  const markerPath = join(userDir, '.guiying-bootstrap-done')
  const log = (msg: string) => {
    console.log(`[guiying] ${msg}`)
    notify(msg)
  }

  log('guiying 初始化中...')

  // ── 已初始化：只做轻量检查 ────────────────────────────
  if (existsSync(markerPath)) {
    const piEntry = join(userDir, 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent')

    // npm/ 目录不存在或为空 → 重新解压（覆盖安装时 pi-runtime 可能未就绪）
    if (!existsSync(piEntry)) {
      log('Pi 运行时未安装，正在解压...')
      installPiRuntime(userDir, log)
    }

    const piCmdExists = checkPiCmdExists()
    if (!piCmdExists) {
      log('pi 命令未找到，正在重新注册...')
      registerPiCommand(userDir, log)
    }
    checkOpenCodeGoAuth(userDir, log)
    log('guiying 就绪 ✓')
    return
  }

  // ── 首次启动：完整初始化 ──────────────────────────────
  try {
    // 1. Skills
    const skillsSrc = join(bundled, 'skills')
    const skillsDst = join(userDir, 'guiying-skills')
    mkdirSync(skillsDst, { recursive: true })
    for (const name of readdirSync(skillsSrc)) {
      const src = join(skillsSrc, name), dst = join(skillsDst, name)
      if (!existsSync(dst)) cpSync(src, dst, { recursive: true })
    }
    log('Skills ✓ (20)')

    // 2. Extensions
    const extSrc = join(bundled, 'extensions')
    const extDst = join(userDir, 'guiying-extensions')
    mkdirSync(extDst, { recursive: true })
    for (const name of readdirSync(extSrc)) {
      const src = join(extSrc, name), dst = join(extDst, name)
      if (!existsSync(dst)) cpSync(src, dst)
    }
    log('Extensions ✓ (2)')

    // 3. Settings
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

    // 4. Pi runtime
    installPiRuntime(userDir, log)

    // 5. Register pi command
    const piEntry = join(userDir, 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent')
    if (existsSync(piEntry)) {
      registerPiCommand(userDir, log)
    }

    writeFileSync(markerPath, JSON.stringify({ installedAt: new Date().toISOString() }, null, 2))
    log('=== guiying bootstrap complete ===')

    checkOpenCodeGoAuth(userDir, log)
  } catch (err: any) {
    log(`Bootstrap error: ${err?.message || err}`)
    console.error('[guiying] Bootstrap error:', err)
  }
}
