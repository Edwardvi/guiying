#!/bin/bash
# 桂英 Build Script
# Usage: bash build.sh
set -e

export PATH="$HOME/.npm-global/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="$HOME"

# Clear proxy for build tools
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY

cd "$(dirname "$0")"

echo "=== Step 1: Build extensions ==="
node scripts/build-extensions.js

echo ""
echo "=== Step 2: Copy default config ==="
mkdir -p src-tauri/resources/pi/default-config/skills
cp default-config/settings.json src-tauri/resources/pi/default-config/
cp default-config/models-store.json src-tauri/resources/pi/default-config/
cp default-config/auth.json src-tauri/resources/pi/default-config/
cp -r default-config/skills/* src-tauri/resources/pi/default-config/skills/ 2>/dev/null

echo ""
echo "=== Step 3: Build Tauri app ==="
echo "Note: First build downloads Rust crates (~500MB) and compiles everything."
echo "This will take 15-30 minutes depending on network speed."
echo ""
npx --yes @tauri-apps/cli build 2>&1

echo ""
echo "=== Build complete! ==="
echo "Output DMG: src-tauri/target/release/bundle/dmg/"
