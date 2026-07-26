#!/usr/bin/env node
/**
 * bundle-pi.mjs — 在 CI 构建时将 Pi CLI 和其 npm 包捆绑到 app 资源中。
 *
 * 运行时机: electron-builder 打包前
 * 产出: resources/pi-runtime/
 *         ├── node_modules/@earendil-works/pi-coding-agent/  (Pi CLI)
 *         ├── node_modules/pi-web-access/
 *         ├── node_modules/pi-mcp-adapter/
 *         ├── node_modules/pi-subagents/
 *         └── node_modules/context-mode/
 *
 * 首次启动时 pi-bootstrap.ts 会把这些复制到 ~/.pi/agent/npm/
 * 然后设置 PI_CODING_AGENT_DIR 指向 bundled 的 config。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..')
const BUNDLE_DIR = join(ROOT, 'resources', 'pi-runtime')
const BUNDLE_NODE_MODULES = join(BUNDLE_DIR, 'node_modules')

console.log('[bundle-pi] Setting up Pi runtime bundle...')

// 清理旧文件
if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
}
mkdirSync(BUNDLE_NODE_MODULES, { recursive: true })

// ── Pi CLI ────────────────────────────────────────────────────
console.log('[bundle-pi] Installing Pi CLI...')
try {
  execFileSync('npm', [
    'install',
    '--prefix', BUNDLE_DIR,
    '--no-save',
    '--omit=dev',
    '--omit=optional',
    '@earendil-works/pi-coding-agent'
  ], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 120000,
    env: { ...process.env, npm_config_cache: join(ROOT, 'node_modules', '.cache', 'npm') }
  })
  console.log('[bundle-pi] Pi CLI installed ✓')
} catch (err) {
  console.error('[bundle-pi] Pi CLI install failed:', err.message)
  process.exit(1)
}

// ── Pi npm 包 ─────────────────────────────────────────────────
const packages = [
  'pi-web-access',
  'pi-mcp-adapter',
  'pi-subagents',
  'context-mode'
]

for (const pkg of packages) {
  console.log(`[bundle-pi] Installing npm:${pkg}...`)
  try {
    execFileSync('npm', [
      'install',
      '--prefix', BUNDLE_DIR,
      '--no-save',
      '--omit=dev',
      '--omit=optional',
      pkg
    ], {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 60000,
      env: { ...process.env, npm_config_cache: join(ROOT, 'node_modules', '.cache', 'npm') }
    })
    console.log(`[bundle-pi] ${pkg} ✓`)
  } catch (err) {
    console.error(`[bundle-pi] ${pkg} failed:`, err.message)
    // 不 fatal — 包缺失时 Pi 仍可启动，只是少功能
  }
}

console.log('[bundle-pi] Done. Pi runtime bundled at', BUNDLE_DIR)
