// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildTelegramDmConfig, buildTelegramDoctorReport } from "./pi-chat-setup.ts";

describe("Telegram one-token setup", () => {
  it("writes a stable single Telegram DM config", () => {
    const config = buildTelegramDmConfig(
      {
        botName: "pi",
        accounts: {
          "telegram-123": {
            service: "telegram",
            botToken: "old-token",
            channels: {
              "telegram-dm-old": { id: "old", dm: true },
            },
          },
        },
      },
      {
        botToken: "new-token",
        identity: {
          id: "8965277673",
          name: "picot",
          username: "picot_shixin_bot",
        },
        dm: {
          chatId: "6085028519",
          chatName: "shixin",
          userId: "6085028519",
          userName: "shixin (@tmodgu)",
        },
      },
    );

    expect(config).toEqual({
      botName: "pi",
      accounts: {
        "telegram-main": {
          service: "telegram",
          name: "Telegram",
          botToken: "new-token",
          botUserId: "8965277673",
          botUsername: "picot_shixin_bot",
          channels: {
            "dm-main": {
              id: "6085028519",
              name: "shixin (@tmodgu)",
              dm: true,
              access: {
                ignoreBots: true,
                allowedUserIds: ["6085028519"],
              },
            },
          },
        },
      },
    });
  });

  it("builds a doctor report for configured Telegram DM with a live listener", () => {
    const report = buildTelegramDoctorReport(
      {
        accounts: {
          "telegram-main": {
            service: "telegram",
            name: "Telegram",
            botToken: "token",
            botUserId: "8965277673",
            botUsername: "picot_shixin_bot",
            channels: {
              "dm-main": {
                id: "6085028519",
                name: "shixin",
                dm: true,
                access: {
                  ignoreBots: true,
                  allowedUserIds: ["6085028519"],
                },
              },
            },
          },
        },
      },
      {
        bot: {
          id: "8965277673",
          name: "Picot",
          username: "picot_shixin_bot",
        },
        workerStatuses: [
          {
            state: "connected",
            conversationId: "telegram-main/dm-main",
            updatedAt: "2026-07-06T12:00:00.000Z",
          },
        ],
      },
    );

    expect(report.summary).toBe("ready");
    expect(report.configured).toBe(true);
    expect(report.bot.ok).toBe(true);
    expect(report.dm.ok).toBe(true);
    expect(report.security.ok).toBe(true);
    expect(report.security.allowedUserIds).toEqual(["6085028519"]);
    expect(report.listener.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual([
      "config",
      "bot",
      "dm",
      "security",
      "listener",
    ]);
  });

  it("warns when Telegram is configured without an allowlist", () => {
    const report = buildTelegramDoctorReport({
      accounts: {
        "telegram-main": {
          service: "telegram",
          botToken: "token",
          botUserId: "8965277673",
          channels: {
            "dm-main": {
              id: "6085028519",
              name: "shixin",
              dm: true,
            },
          },
        },
      },
    });

    expect(report.summary).toBe("warning");
    expect(report.security.ok).toBe(false);
    expect(report.security.message).toContain("No allowed Telegram user");
  });
});
