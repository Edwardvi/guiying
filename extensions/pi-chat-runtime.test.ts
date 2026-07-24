// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedConversation } from "./pi-chat-src/core/config-types.ts";
import { ConversationRuntime } from "./pi-chat-src/runtime.ts";

const tempRoots: string[] = [];

function buildConversation(root: string, dm: boolean): ResolvedConversation {
  const accountDir = join(root, "account");
  const conversationDir = join(root, dm ? "dm" : "channel");
  const workspaceDir = join(conversationDir, "workspace");
  return {
    service: "telegram",
    botName: "picot",
    accountId: "telegram-main",
    account: {
      service: "telegram",
      botToken: "test-token",
      botUsername: "picot",
      channels: {},
    },
    channelKey: dm ? "dm-user" : "group-main",
    channel: {
      id: dm ? "100" : "-100",
      name: dm ? "DM User" : "Group",
      dm,
      access: { ignoreBots: true },
    },
    conversationId: dm ? "telegram-main/dm-user" : "telegram-main/group-main",
    conversationName: dm ? "Telegram / DM User" : "Telegram / Group",
    access: { ignoreBots: true },
    accountDir,
    sharedDir: join(accountDir, "shared"),
    conversationDir,
    workspaceDir,
    accountMemoryPath: join(accountDir, "shared", "memory.md"),
    channelMemoryPath: join(workspaceDir, "memory.md"),
    logPath: join(conversationDir, "channel.jsonl"),
    filesDir: join(workspaceDir, "incoming"),
    lockPath: join(conversationDir, ".lock"),
  };
}

async function connectRuntime(dm: boolean): Promise<ConversationRuntime> {
  const root = await mkdtemp(join(tmpdir(), "pi-chat-runtime-"));
  tempRoots.push(root);
  const runtime = await ConversationRuntime.connect(buildConversation(root, dm), `test-${dm}`);
  runtime.armAfterCurrentTail();
  return runtime;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ConversationRuntime DM trigger policy", () => {
  it("queues jobs for DM messages", async () => {
    const runtime = await connectRuntime(true);
    try {
      const result = await runtime.ingestInbound({
        userId: "user-1",
        text: "please check this",
      });

      expect(result.jobQueued).toBe(true);
      expect(runtime.beginNextJob()?.job.trigger).toBe("dm");
    } finally {
      await runtime.disconnect();
    }
  });

  it("does not queue jobs for channel mentions", async () => {
    const runtime = await connectRuntime(false);
    try {
      const result = await runtime.ingestInbound({
        userId: "user-1",
        text: "@picot please check this",
      });

      expect(result.jobQueued).toBe(false);
      expect(runtime.beginNextJob()).toBeUndefined();
    } finally {
      await runtime.disconnect();
    }
  });

  it("treats Telegram start and help as local help commands", async () => {
    const runtime = await connectRuntime(true);
    try {
      expect(
        runtime.parseControlCommand({
          userId: "user-1",
          text: "/start",
        }),
      ).toBe("help");
      expect(
        runtime.parseControlCommand({
          userId: "user-1",
          text: "/help",
        }),
      ).toBe("help");
    } finally {
      await runtime.disconnect();
    }
  });

  it("parses structured Telegram commands with bot suffixes and arguments", async () => {
    const runtime = await connectRuntime(true);
    try {
      expect(
        runtime.parseRemoteCommand({ userId: "user-1", text: "  /TaSk@picot   task-123  " }),
      ).toEqual({ name: "task", args: "task-123" });
      expect(runtime.parseRemoteCommand({ userId: "user-1", text: "/unknown" })).toEqual({
        name: "unknown",
        args: "",
      });
    } finally {
      await runtime.disconnect();
    }
  });

  it("does not parse commands from unauthorized users", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-chat-runtime-"));
    tempRoots.push(root);
    const conversation = buildConversation(root, true);
    conversation.access.allowedUserIds = ["owner"];
    const runtime = await ConversationRuntime.connect(conversation, "test-allowed");
    try {
      expect(runtime.parseRemoteCommand({ userId: "stranger", text: "/status" })).toBeUndefined();
    } finally {
      await runtime.disconnect();
    }
  });
});
