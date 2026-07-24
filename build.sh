#!/bin/bash
# 桂英 Build Script
set -e
export PATH="$HOME/.npm-global/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY
cd "$(dirname "$0")"
echo "=== Build extensions ===" && node scripts/build-extensions.js
echo "=== Copy default config ==="
mkdir -p src-tauri/resources/pi/default-config/skills
cp default-config/settings.json src-tauri/resources/pi/default-config/
cp default-config/models-store.json src-tauri/resources/pi/default-config/
cp default-config/auth.json src-tauri/resources/pi/default-config/
cp -r default-config/skills/* src-tauri/resources/pi/default-config/skills/ 2>/dev/null || true
echo "=== Build Tauri app ===" && npx @tauri-apps/cli build "$@"
echo "=== Build complete ==="
