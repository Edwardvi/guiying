#!/usr/bin/env node
/**
 * bundle-pi.cjs — 捆绑 Pi CLI + npm 包到 resources/pi-runtime/。
 *
 * 构建时由 pnpm bundle:pi 调用。幂等：先清空再重新安装。
 * 失败则 exit 1（防止打包出不完整的 app）。
 *
 * resources/pi-runtime/ 在打包 app 中作为 extraResource 存在，
 * bootstrap 时复制到 ~/.pi/agent/npm/。
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

// 清理 → 创建
if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
}
mkdirSync(BUNDLE_DIR, { recursive: true })

const env = {
  ...process.env,
  npm_config_cache: join(ROOT, 'node_modules', '.cache', 'npm')
}

function run(cmd, opts = {}) {
  console.log('[bundle-pi]', cmd)
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', env, timeout: 300000, ...opts })
    return true
  } catch (err) {
    console.error('[bundle-pi] Failed:', err.message)
    return false
  }
}

// ── Pi CLI（必选，失败则中止构建）───────────────────────
const npmInstallFlags = '--no-save --omit=dev --omit=optional'
const piPkg = '@earendil-works/pi-coding-agent'

if (!run(`npm install --prefix "${BUNDLE_DIR}" ${npmInstallFlags} ${piPkg}`)) {
  console.error('[bundle-pi] FATAL: Pi CLI install failed')
  process.exit(1)
}

// ── 验证 Pi CLI 入口存在 ──────────────────────────────────
const piCliEntry = join(BUNDLE_DIR, 'node_modules', piPkg, 'dist', 'cli.js')
if (!existsSync(piCliEntry)) {
  console.error(`[bundle-pi] FATAL: ${piCliEntry} not found after install`)
  process.exit(1)
}
console.log('[bundle-pi] Pi CLI entry verified:', piCliEntry)

// ── 可选 npm 包（失败不中止，但会警告）───────────────────
const optionalPkgs = ['pi-web-access', 'pi-mcp-adapter', 'pi-subagents', 'context-mode']
for (const pkg of optionalPkgs) {
  const ok = run(`npm install --prefix "${BUNDLE_DIR}" ${npmInstallFlags} ${pkg}`)
  if (!ok) {
    console.warn(`[bundle-pi] WARNING: ${pkg} install failed (non-fatal)`)
  }
}

console.log('[bundle-pi] Done:', BUNDLE_DIR)
