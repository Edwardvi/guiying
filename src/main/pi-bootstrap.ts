/**
 * Pi Bootstrap — 首次启动时将捆绑的 Pi skills/extensions/config 复制到用户目录。
 *
 * 在 app.whenReady() 后调用一次。幂等：已存在则跳过。
 */
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// 路径解析
// ---------------------------------------------------------------------------

/** 捆绑在 app 资源中的 Pi 文件目录 */
function getBundledPiDir(): string {
  // 开发模式：直接读源码目录下的 resources/pi-bundle
  // 生产模式：从 app.asar.unpacked 或 Resources 读取
  const devPath = join(__dirname, '..', '..', 'resources', 'pi-bundle')
  if (existsSync(devPath)) {
    return devPath
  }
  // 生产：electron-builder extraResources 放到 Resources/pi-bundle
  const resourcesPath = process.resourcesPath
  return join(resourcesPath, 'pi-bundle')
}

/** 用户 Pi agent 目录 */
function getUserPiDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  return join(home, '.pi', 'agent')
}

// ---------------------------------------------------------------------------
// 安装逻辑
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

  // 幂等：已安装过则跳过
  if (existsSync(markerPath)) {
    console.log('[guiying] Pi bootstrap already done, skipping')
    return
  }

  console.log('[guiying] Running Pi bootstrap...')

  try {
    // 1. 复制 Skills
    {
      const srcDir = join(bundled, 'skills')
      const dstDir = join(userDir, 'skills')
      mkdirSync(dstDir, { recursive: true })
      cpSync(srcDir, dstDir, { recursive: true, force: true })
      console.log('[guiying] Skills installed')
    }

    // 2. 复制 Extensions
    {
      const srcDir = join(bundled, 'extensions')
      const dstDir = join(userDir, 'extensions')
      mkdirSync(dstDir, { recursive: true })
      cpSync(srcDir, dstDir, { recursive: true, force: true })
      console.log('[guiying] Extensions installed')
    }

    // 3. 合并 Settings
    {
      const srcSettings = join(bundled, 'config', 'settings.json')
      const dstSettings = join(userDir, 'settings.json')
      if (existsSync(srcSettings)) {
        const bundledCfg = JSON.parse(readFileSync(srcSettings, 'utf8'))
        // 合并：用户已有 settings 则保留，仅补充缺失的 skills/extensions
        let finalCfg = bundledCfg
        if (existsSync(dstSettings)) {
          const existingCfg = JSON.parse(readFileSync(dstSettings, 'utf8'))
          finalCfg = { ...bundledCfg, ...existingCfg }
          // 合并 skills 数组
          finalCfg.skills = [
            ...new Set([...(bundledCfg.skills || []), ...(existingCfg.skills || [])])
          ]
          finalCfg.extensions = [
            ...new Set([...(bundledCfg.extensions || []), ...(existingCfg.extensions || [])])
          ]
          finalCfg.packages = [
            ...new Set([...(bundledCfg.packages || []), ...(existingCfg.packages || [])])
          ]
        }
        mkdirSync(join(userDir), { recursive: true })
        writeFileSync(dstSettings, JSON.stringify(finalCfg, null, 2))
        console.log('[guiying] Settings merged')
      }
    }

    // 4. 尝试安装 npm 包（需要网络 + Node.js）
    try {
      const packages = ['pi-web-access', 'pi-mcp-adapter', 'pi-subagents', 'context-mode']
      for (const pkg of packages) {
        try {
          execFileSync('pi', ['install', `npm:${pkg}`], {
            env: { ...process.env, HOME: process.env.HOME || process.env.USERPROFILE },
            timeout: 30000,
            stdio: 'pipe'
          })
          console.log(`[guiying] pi install npm:${pkg} OK`)
        } catch {
          // pi CLI 可能还没安装，或网络不通，下次启动再试
          console.warn(`[guiying] pi install npm:${pkg} failed (will retry next time)`)
        }
      }
    } catch {
      console.warn('[guiying] pi command not available, skip package install')
    }

    // 5. 写入标记文件
    writeFileSync(markerPath, new Date().toISOString())
    console.log('[guiying] Pi bootstrap complete')
  } catch (err) {
    console.error('[guiying] Pi bootstrap error:', err)
  }
}
