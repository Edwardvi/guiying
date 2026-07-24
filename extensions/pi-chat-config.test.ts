// @vitest-environment node

import { describe, expect, it } from "vitest";
import { listConfiguredConversations } from "./pi-chat-src/config.ts";
import type { ChatConfig } from "./pi-chat-src/core/config-types.ts";

describe("pi-chat configured conversations", () => {
  it("only exposes DM conversations", () => {
    const config: ChatConfig = {
      accounts: {
        telegram: {
          service: "telegram",
          botToken: "test-token",
          channels: {
            dm: { id: "100", dm: true },
            group: { id: "-100", dm: false },
          },
        },
      },
    };

    expect(
      listConfiguredConversations(config).map((conversation) => conversation.channelKey),
    ).toEqual(["dm"]);
  });
});
