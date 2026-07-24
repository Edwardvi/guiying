// @vitest-environment node

import { describe, expect, it } from "vitest";
import { selectStartupConversationId } from "./pi-chat-src/startup.ts";

describe("pi-chat startup conversation selection", () => {
  it("auto-selects the only configured conversation when no flag or persisted state exists", () => {
    expect(selectStartupConversationId(undefined, undefined, ["telegram/main"])).toBe(
      "telegram/main",
    );
  });

  it("keeps explicit flag and persisted state ahead of the auto-selected conversation", () => {
    expect(
      selectStartupConversationId(" telegram/other-dm ", "telegram/main", ["telegram/main"]),
    ).toBe("telegram/other-dm");
    expect(selectStartupConversationId(undefined, "telegram/main", ["telegram/other-dm"])).toBe(
      "telegram/main",
    );
  });

  it("does not guess when multiple conversations are configured", () => {
    expect(
      selectStartupConversationId(undefined, undefined, ["telegram/main", "telegram/other-dm"]),
    ).toBeUndefined();
  });
});
