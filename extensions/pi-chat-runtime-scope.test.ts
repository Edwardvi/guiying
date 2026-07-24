// @vitest-environment node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

async function readProjectFile(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}

describe("pi-chat runtime scope", () => {
  it("does not ship tmux or Gondolin sandbox runtime paths", async () => {
    const extensionEntry = await readProjectFile("extensions/pi-chat-src/extension-entry.ts");
    const buildScript = await readProjectFile("scripts/build-extensions.js");

    expect(extensionEntry).not.toContain("@earendil-works/gondolin");
    expect(extensionEntry).not.toContain("chat-spawn-all");
    expect(extensionEntry).not.toContain("chat-workers");
    expect(extensionEntry).not.toContain("chat-open-all");
    expect(extensionEntry).not.toContain("chat-kill-all");
    expect(extensionEntry).not.toContain("tmux");
    expect(extensionEntry).not.toContain("ConversationSandbox");
    expect(buildScript).not.toContain("gondolin-stub");
  });

  it("does not expose channel or server chat worker setup paths", async () => {
    const chatConfig = await readProjectFile("extensions/pi-chat-src/tui/chat-config.ts");
    const telegramSetup = await readProjectFile("extensions/pi-chat-src/tui/telegram-setup.ts");
    const liveIndex = await readProjectFile("extensions/pi-chat-src/live/index.ts");

    expect(chatConfig).not.toContain("add-group");
    expect(chatConfig).not.toContain("Create a Telegram or Discord account");
    expect(chatConfig).not.toContain("createDiscordAccountWithGuidedSetup");
    expect(telegramSetup).not.toContain("Telegram group setup");
    expect(telegramSetup).not.toContain("mention the bot in that group");
    expect(liveIndex).not.toContain("discord");
  });
});
