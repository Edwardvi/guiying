// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import "./super-agent-entry.js";

describe("super-agent-entry compatibility", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("delegates clicks to the pinned Super Agent session instead of opening a workspace", async () => {
    const pinnedClick = vi.fn();
    document.body.innerHTML =
      '<div class="super-agent-pinned-group"><div class="session-item"></div></div>';
    document.querySelector(".session-item").addEventListener("click", pinnedClick);
    const transport = {
      newSession: vi.fn(),
      openWorkspace: vi.fn(),
    };

    window.__saNav = {
      transport,
    };

    const Entry = customElements.get("super-agent-entry");
    const entry = new Entry();
    document.body.appendChild(entry);

    await entry._open();

    expect(pinnedClick).toHaveBeenCalledTimes(1);
    expect(transport.newSession).not.toHaveBeenCalled();
    expect(transport.openWorkspace).not.toHaveBeenCalled();
  });
});
