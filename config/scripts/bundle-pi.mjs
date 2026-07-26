#!/usr/bin/env node
/**
 * bundle-pi.mjs — 在 CI 构建时将 Pi CLI 和其 npm 包捆绑到 app 资源中。
 *
 * 非致命：如果 npm 不可用或网络不通，退出 0，让 bootstrap 在首次启动时兜底。
 *
 * 运行时机: electron-builder 打包前
 * 产出: resources/pi-runtime/
 *         ├── node_modules/@earendil-works/pi-coding-agent/  (Pi CLI)
 *         ├── node_modules/pi-web-access/
 *         ├── node_modules/pi-mcp-adapter/
 *         ├── node_modules/pi-subagents/
 *         └── node_modules/context-mode/
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BUNDLE_DIR = join(ROOT, 'resources', 'pi-runtime')
const isWindows = process.platform === 'win32'

// ── npm 可用性检查 ──────────────────────────────────────────
function findNpm(): string | null {
  // Windows: npm.cmd; Unix: npm
  const candidates = isWindows ? ['npm.cmd', 'npm'] : ['npm']
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'pipe', timeout: 10000 })
      return cmd
    } catch {}
  }
  return null
}

const npmBin = findNpm()
if (!npmBin) {
  console.log('[bundle-pi] npm not found — skipping Pi bundle (bootstrap will handle at runtime)')
  process.exit(0)
}

console.log(`[bundle-pi] npm: ${npmBin}`)
console.log('[bundle-pi] Setting up Pi runtime bundle...')

// 清理旧文件
if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
}
mkdirSync(BUNDLE_DIR, { recursive: true })

const installOpts = {
  cwd: ROOT,
  stdio: 'inherit',
  timeout: 120000,
  env: { ...process.env, npm_config_cache: join(ROOT, 'node_modules', '.cache', 'npm') }
}

// ── Pi CLI ────────────────────────────────────────────────────
console.log('[bundle-pi] Installing Pi CLI...')
try {
  execFileSync(npmBin, [
    'install', '--prefix', BUNDLE_DIR, '--no-save',
    '--omit=dev', '--omit=optional',
    '@earendil-works/pi-coding-agent'
  ], installOpts)
  console.log('[bundle-pi] Pi CLI installed ✓')
} catch (err) {
  console.error('[bundle-pi] Pi CLI install failed:', err?.message || err)
  console.log('[bundle-pi] Skipping — bootstrap will handle at runtime')
  process.exit(0)
}

// ── Pi npm 包 ─────────────────────────────────────────────────
const packages = ['pi-web-access', 'pi-mcp-adapter', 'pi-subagents', 'context-mode']
for (const pkg of packages) {
  console.log(`[bundle-pi] Installing npm:${pkg}...`)
  try {
    execFileSync(npmBin, [
      'install', '--prefix', BUNDLE_DIR, '--no-save',
      '--omit=dev', '--omit=optional', pkg
    ], { ...installOpts, timeout: 60000 })
    console.log(`[bundle-pi] ${pkg} ✓`)
  } catch (err) {
    console.error(`[bundle-pi] ${pkg} failed:`, err?.message || err)
  }
}

console.log('[bundle-pi] Done. Pi runtime bundled at', BUNDLE_DIR)
