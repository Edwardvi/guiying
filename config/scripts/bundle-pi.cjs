#!/usr/bin/env node
/**
 * bundle-pi.cjs — 在 CI 构建时将 Pi CLI 和其 npm 包捆绑到 app 资源中。
 *
 * 优先使用 pnpm（CI 已安装），fallback 到 npm。
 * Pi CLI 安装失败时 exit 1（fatal）。
 */
'use strict'

const { execFileSync } = require('node:child_process')
const { existsSync, mkdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..', '..')
const BUNDLE_DIR = join(ROOT, 'resources', 'pi-runtime')
const isWindows = process.platform === 'win32'

console.log('[bundle-pi] ROOT:', ROOT)

// ── 找包管理器（pnpm > npm）──────────────────────────────────
function findPM() {
  const candidates = isWindows
    ? ['pnpm.cmd', 'npm.cmd', 'pnpm', 'npm']
    : ['pnpm', 'npm']
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'pipe', timeout: 10000 })
      return { bin: cmd, isPnpm: cmd.startsWith('pnpm') }
    } catch {}
  }
  return null
}

const pm = findPM()
if (!pm) {
  console.log('[bundle-pi] No package manager — skipping')
  process.exit(0)
}
console.log(`[bundle-pi] Using: ${pm.bin}`)

// ── 清理 ─────────────────────────────────────────────────────
if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
}
mkdirSync(BUNDLE_DIR, { recursive: true })

const baseEnv = { ...process.env, npm_config_cache: join(ROOT, 'node_modules', '.cache', 'npm') }

function install(pkg, timeoutMs = 120000) {
  console.log(`[bundle-pi] Installing ${pkg}...`)
  const args = pm.isPnpm
    ? ['--dir', BUNDLE_DIR, 'add', '--no-save', pkg]
    : ['install', '--prefix', BUNDLE_DIR, '--no-save', '--omit=dev', '--omit=optional', pkg]
  try {
    execFileSync(pm.bin, args, {
      cwd: ROOT, stdio: 'inherit', timeout: timeoutMs, env: baseEnv
    })
    console.log(`[bundle-pi] ${pkg} ✓`)
    return true
  } catch (err) {
    console.error(`[bundle-pi] ${pkg} failed:`, err?.message || err)
    return false
  }
}

// ── Pi CLI（fatal）───────────────────────────────────────────
if (!install('@earendil-works/pi-coding-agent')) {
  console.error('[bundle-pi] FATAL: Pi CLI not bundled — build fails')
  process.exit(1)
}

// ── npm packages（non-fatal）─────────────────────────────────
const packages = ['pi-web-access', 'pi-mcp-adapter', 'pi-subagents', 'context-mode']
for (const pkg of packages) {
  install(pkg, 60000)
}

console.log('[bundle-pi] Done:', BUNDLE_DIR)
