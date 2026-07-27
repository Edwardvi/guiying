#!/usr/bin/env node
/**
 * bundle-pi.cjs — CI 构建时捆绑 Pi CLI + npm 包。
 * 最简实现：直接用 npm install，失败则 exit 1。
 */
'use strict'

const { execSync } = require('node:child_process')
const { existsSync, mkdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')
const os = require('node:os')

const ROOT = join(__dirname, '..', '..')
const BUNDLE_DIR = join(ROOT, 'resources', 'pi-runtime')

console.log('[bundle-pi] Platform:', os.platform())
console.log('[bundle-pi] ROOT:', ROOT)

// 清理
if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
}
mkdirSync(BUNDLE_DIR, { recursive: true })

const env = {
  ...process.env,
  npm_config_cache: join(ROOT, 'node_modules', '.cache', 'npm')
}

function run(cmd) {
  console.log('[bundle-pi]', cmd)
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', env, timeout: 120000 })
    return true
  } catch (err) {
    console.error('[bundle-pi] Failed:', err.message)
    return false
  }
}

// ── Pi CLI ────────────────────────────────────────────────────
const piInstallCmd = os.platform() === 'win32'
  ? `npm install --prefix "${BUNDLE_DIR}" --no-save --omit=dev --omit=optional @earendil-works/pi-coding-agent`
  : `npm install --prefix "${BUNDLE_DIR}" --no-save --omit=dev --omit=optional @earendil-works/pi-coding-agent`

if (!run(piInstallCmd)) {
  console.error('[bundle-pi] FATAL: Pi CLI install failed')
  process.exit(1)
}

// ── npm packages ──────────────────────────────────────────────
const packages = ['pi-web-access', 'pi-mcp-adapter', 'pi-subagents', 'context-mode']
for (const pkg of packages) {
  const cmd = os.platform() === 'win32'
    ? `npm install --prefix "${BUNDLE_DIR}" --no-save --omit=dev --omit=optional ${pkg}`
    : `npm install --prefix "${BUNDLE_DIR}" --no-save --omit=dev --omit=optional ${pkg}`
  run(cmd) // non-fatal
}

console.log('[bundle-pi] Done:', BUNDLE_DIR)
