#!/usr/bin/env node
/**
 * bundle-pi.cjs — 在 CI 构建时将 Pi CLI 和其 npm 包捆绑到 app 资源中。
 *
 * 非致命：如果 npm 不可用或网络不通，退出 0。
 */
'use strict'

const { execFileSync } = require('node:child_process')
const { existsSync, mkdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..', '..')
const BUNDLE_DIR = join(ROOT, 'resources', 'pi-runtime')
const isWindows = process.platform === 'win32'

console.log('[bundle-pi] cwd:', process.cwd())
console.log('[bundle-pi] ROOT:', ROOT)

// ── npm check ─────────────────────────────────────────────────
const npmCandidates = isWindows ? ['npm.cmd', 'npm'] : ['npm']
let npmBin = null
for (const cmd of npmCandidates) {
  try {
    execFileSync(cmd, ['--version'], { stdio: 'pipe', timeout: 10000 })
    npmBin = cmd
    break
  } catch {}
}

if (!npmBin) {
  console.log('[bundle-pi] npm not found — skipping (bootstrap handles at runtime)')
  process.exit(0)
}

console.log('[bundle-pi] npm:', npmBin)

// ── 清理 ─────────────────────────────────────────────────────
if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
}
mkdirSync(BUNDLE_DIR, { recursive: true })

const baseEnv = { ...process.env }
const install = (pkg, timeoutMs = 120000) => {
  console.log(`[bundle-pi] Installing ${pkg}...`)
  try {
    execFileSync(npmBin, [
      'install', '--prefix', BUNDLE_DIR, '--no-save',
      '--omit=dev', '--omit=optional', pkg
    ], {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: timeoutMs,
      env: { ...baseEnv, npm_config_cache: join(ROOT, 'node_modules', '.cache', 'npm') }
    })
    console.log(`[bundle-pi] ${pkg} ✓`)
    return true
  } catch (err) {
    console.error(`[bundle-pi] ${pkg} failed:`, err?.message || err)
    return false
  }
}

// ── Pi CLI ────────────────────────────────────────────────────
if (!install('@earendil-works/pi-coding-agent')) {
  console.error('[bundle-pi] FATAL: Pi CLI install failed — build cannot continue')
  process.exit(1)
}

// ── npm packages ──────────────────────────────────────────────
const packages = ['pi-web-access', 'pi-mcp-adapter', 'pi-subagents', 'context-mode']
for (const pkg of packages) {
  install(pkg, 60000)
}

console.log('[bundle-pi] Done:', BUNDLE_DIR)
