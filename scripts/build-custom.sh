#!/bin/bash
# 桂英 Build Script
# Custom build of Picot for 桂英 (Guiying)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== 桂英 Build ==="
echo "Root: $ROOT"

# 1. Fetch pi binary (platform-specific)
echo ""
echo "=== Step 1: Fetch pi binary ==="
cd "$ROOT"
bun run fetch:pi

# 2. Build extensions
echo ""
echo "=== Step 2: Build extensions ==="
bun run build:extensions

# 3. Pre-install npm packages to the pi resources directory
echo ""
echo "=== Step 3: Pre-install npm packages ==="
PI_DIR="$ROOT/src-tauri/resources/pi"
PI_NPM="$PI_DIR/node_modules"

if [ -d "$PI_NPM" ]; then
    # The pi binary comes with its own node_modules, we add our packages on top
    cd "$PI_DIR"
    # Install the 4 packages
    ./pi install npm:pi-web-access --no-settings 2>/dev/null || true
    ./pi install npm:pi-mcp-adapter --no-settings 2>/dev/null || true
    ./pi install npm:pi-subagents --no-settings 2>/dev/null || true
    ./pi install npm:context-mode --no-settings 2>/dev/null || true
fi

# 4. Copy default config
echo ""
echo "=== Step 4: Copy default config ==="
mkdir -p "$PI_DIR/default-config"
cp "$ROOT/default-config/settings.json" "$PI_DIR/default-config/"
cp "$ROOT/default-config/models-store.json" "$PI_DIR/default-config/"
cp "$ROOT/default-config/auth.json" "$PI_DIR/default-config/"
cp -r "$ROOT/default-config/skills" "$PI_DIR/default-config/"

echo "Default config copied:"
ls -la "$PI_DIR/default-config/"

# 5. Build Tauri app
echo ""
echo "=== Step 5: Build Tauri app ==="
cd "$ROOT"
PATH="$HOME/.cargo/bin:$PATH" bun run tauri build

echo ""
echo "=== Build complete! ==="
echo "Output: $ROOT/src-tauri/target/release/bundle/"
ls -lh "$ROOT/src-tauri/target/release/bundle/" 2>/dev/null
