// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./super-agent-runtime.js";

describe("super-agent-runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
      if (url === "/api/super-agent/tasks" && options?.method === "PUT") {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                id: "task-1",
                status: "pending",
                title: "Feature: Agent Status Indicator",
                description:
                  "Add a real-time agent status indicator with many implementation notes.",
                targetProject: "/Users/me/project",
              },
            ],
          }),
      });
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("keeps task details collapsed until the card is opened", async () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.textContent).toContain("Feature: Agent Status Indicator");
    expect(runtime.textContent).not.toContain("many implementation notes");
    expect(runtime.querySelector(".runtime-project-select")).toBeNull();

    runtime.querySelector(".runtime-task-card").click();

    expect(runtime.textContent).toContain("many implementation notes");
    expect(runtime.querySelector('[data-action="approve"]')).not.toBeNull();
    expect(runtime.querySelector(".runtime-project-select")).not.toBeNull();
  });

  it("uses the shared side-panel resize handle and close button", async () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.querySelector(".app-side-panel-resize-handle")).not.toBeNull();
    expect(
      runtime.querySelector('[data-collapse-btn][aria-label="Close activity panel"]'),
    ).not.toBeNull();
  });

  it("starts collapsed by default unless the user explicitly left it open", () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    expect(runtime.classList.contains("collapsed")).toBe(true);

    document.body.innerHTML = "";
    localStorage.setItem("sa-runtime-collapsed", "0");
    const reopenedRuntime = new Runtime();
    document.body.appendChild(reopenedRuntime);

    expect(reopenedRuntime.classList.contains("collapsed")).toBe(false);
  });

  it("shows the task panel body immediately while the first task fetch is pending", () => {
    fetch.mockImplementation(() => new Promise(() => {}));

    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    expect(runtime.querySelector("[data-task-list]").textContent).toContain("Connecting");
    expect(runtime.querySelector("[data-pending-count]").textContent).toBe("0");
  });

  it("places bulk actions below the scrollable task list", () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    const taskList = runtime.querySelector("[data-task-list]");
    const bulkActions = runtime.querySelector("[data-bulk-actions]");

    expect(taskList.compareDocumentPosition(bulkActions) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("sends a task to the main chat instead of opening edit or ask forms", async () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    const promptedTasks = [];
    runtime.addEventListener("sa-prompt-task", (event) => promptedTasks.push(event.detail));
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    runtime.querySelector('[data-action="prompt-task"]').click();

    expect(promptedTasks).toEqual([
      expect.objectContaining({ id: "task-1", title: "Feature: Agent Status Indicator" }),
    ]);
    expect(runtime.querySelector('[data-action="edit"]')).toBeNull();
    expect(runtime.querySelector('[data-action="ask"]')).toBeNull();
  });

  it("formats markdown-like task descriptions into readable sections", async () => {
    fetch.mockImplementation((url, options) => {
      if (url === "/api/super-agent/tasks" && options?.method === "PUT") {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                id: "task-1",
                status: "pending",
                title: "Feature: Agent Status Indicator",
                description:
                  "Add a real-time agent status indicator. ## Status States - 🟢 **Idle** — Pi is waiting for input - 🟡 **Working** — Pi is actively processing ## Goal Users should not switch panes. ## Implementation Hints 1. Detect state changes 2. Show the status dot",
                targetProject: "/Users/me/project",
              },
            ],
          }),
      });
    });

    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    runtime.querySelector(".runtime-task-card").click();

    expect(runtime.querySelectorAll(".runtime-task-section-title")).toHaveLength(3);
    expect(runtime.querySelector(".runtime-task-desc").textContent).not.toContain("##");
    expect(runtime.querySelector(".runtime-task-desc").textContent).not.toContain("**Idle**");
    expect(
      [...runtime.querySelectorAll(".runtime-task-list-item")].map((item) => item.textContent),
    ).toEqual([
      "🟢 Idle — Pi is waiting for input",
      "🟡 Working — Pi is actively processing",
      "Detect state changes",
      "Show the status dot",
    ]);
  });

  it("approves with the project chosen at task creation", async () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    runtime.querySelector(".runtime-task-card").click();

    expect(runtime.querySelector(".runtime-project-select")).not.toBeNull();
    expect(runtime.textContent).toContain("Project: project");

    runtime.querySelector('[data-action="approve"]').click();

    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith(
      "/api/super-agent/tasks",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"targetProject":"/Users/me/project"'),
      }),
    );
  });

  it("does not allow approval when a task was created without a project", async () => {
    fetch.mockImplementation((url, options) => {
      if (url === "/api/super-agent/tasks" && options?.method === "PUT") {
        return Promise.resolve({ ok: true });
      }
      if (url === "/api/super-agent/projects") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            projects: [
              {
                name: "project-a",
                cwd: "/Users/me/project-a",
                status: "running",
                activePort: 47821,
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                id: "task-1",
                status: "pending",
                title: "Missing target",
                description: "Needs a project.",
              },
            ],
          }),
      });
    });

    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    runtime.querySelector(".runtime-task-card").click();

    expect(runtime.querySelector('[data-action="approve"]')).toBeNull();
    expect(runtime.querySelector(".runtime-project-select")).not.toBeNull();
    expect(runtime.textContent).toContain("Choose a project before approval");

    expect(fetch).not.toHaveBeenCalledWith(
      "/api/super-agent/tasks",
      expect.objectContaining({
        method: "PUT",
      }),
    );
  });

  it("approves a task after choosing a project from the project registry", async () => {
    fetch.mockImplementation((url, options) => {
      if (url === "/api/super-agent/tasks" && options?.method === "PUT") {
        return Promise.resolve({ ok: true });
      }
      if (url === "/api/super-agent/projects") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            projects: [
              {
                name: "project-a",
                cwd: "/Users/me/project-a",
                status: "running",
                activePort: 47821,
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                id: "task-1",
                status: "pending",
                title: "Missing target",
                description: "Needs a project.",
              },
            ],
          }),
      });
    });

    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    runtime.querySelector(".runtime-task-card").click();
    runtime.querySelector(".runtime-project-select").value = "/Users/me/project-a";
    runtime
      .querySelector(".runtime-project-select")
      .dispatchEvent(new Event("change", { bubbles: true }));
    runtime.querySelector('[data-action="approve"]').click();

    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith(
      "/api/super-agent/tasks",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"targetProject":"/Users/me/project-a"'),
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/super-agent/tasks",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"routingConfidence":"user_selected"'),
      }),
    );
  });

  it("offers bulk actions for ready pending tasks and completed tasks", async () => {
    fetch.mockImplementation((url, options) => {
      if (url === "/api/super-agent/tasks" && options?.method === "PUT") {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                id: "ready-1",
                status: "pending",
                title: "Ready one",
                targetProject: "/Users/me/project",
              },
              {
                id: "missing-target",
                status: "pending",
                title: "Missing target",
              },
              {
                id: "done-1",
                status: "done",
                title: "Done one",
              },
            ],
          }),
      });
    });

    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    const dispatches = [];
    runtime.addEventListener("sa-dispatch", (event) => dispatches.push(event.detail.id));
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.querySelector('[data-action="approve-all"]').textContent).toContain("Approve 1");
    runtime.querySelector('[data-action="approve-all"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(dispatches).toEqual(["ready-1"]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/super-agent/tasks",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"status":"running"'),
      }),
    );

    runtime.querySelector('[data-action="clear-done"]').click();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith(
      "/api/super-agent/tasks",
      expect.objectContaining({
        method: "PUT",
        body: expect.not.stringContaining('"done-1"'),
      }),
    );
  });

  it("shows quick actions on collapsed cards", async () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.querySelector(".runtime-task-card").classList.contains("is-collapsed")).toBe(
      true,
    );
    expect(runtime.querySelector('.runtime-quick-actions [data-action="approve"]')).not.toBeNull();
    expect(runtime.querySelector('.runtime-quick-actions [data-action="dismiss"]')).not.toBeNull();
    expect(
      runtime.querySelector('.runtime-quick-actions [data-action="prompt-task"]'),
    ).not.toBeNull();
  });

  it("shows child session and event history actions for dispatched tasks", async () => {
    fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                id: "task-1",
                status: "done",
                title: "Done task",
                dispatch: {
                  targetProject: "/Users/me/project",
                  childPort: 47822,
                },
                events: [
                  {
                    at: "2026-07-10T12:00:00.000Z",
                    type: "dispatched",
                    status: "running",
                    message: "Dispatched.",
                  },
                  {
                    at: "2026-07-10T12:05:00.000Z",
                    type: "completed",
                    status: "done",
                    message: "Finished.",
                  },
                ],
              },
            ],
          }),
      }),
    );

    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    const viewEvents = [];
    runtime.addEventListener("sa-view-session", (event) => viewEvents.push(event.detail));
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    runtime.querySelector(".runtime-task-card").click();

    expect(runtime.querySelector('[data-action="view-session"]')).not.toBeNull();
    expect(runtime.textContent).toContain("History");

    runtime.querySelector('[data-action="toggle-history"]').click();
    expect(runtime.textContent).toContain("Dispatched.");
    expect(runtime.textContent).toContain("Finished.");

    runtime.querySelector('[data-action="view-session"]').click();
    expect(viewEvents).toEqual([
      expect.objectContaining({
        id: "task-1",
        dispatch: expect.objectContaining({ childPort: 47822 }),
      }),
    ]);
  });

  it("opens the panel on pending tasks from keyboard and badge requests", async () => {
    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    document.dispatchEvent(
      new CustomEvent("sa-open-runtime", {
        detail: { filter: "pending" },
      }),
    );

    expect(runtime.classList.contains("collapsed")).toBe(false);
    expect(runtime.querySelector('[data-filter="pending"]').classList.contains("active")).toBe(
      true,
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "I",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );

    expect(runtime.classList.contains("collapsed")).toBe(true);
  });

  it("shows blocked and clarification tasks as active work with source context", async () => {
    fetch.mockImplementation((url, options) => {
      if (url === "/api/super-agent/tasks" && options?.method === "PUT") {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            tasks: [
              {
                id: "task-1",
                status: "needs_input",
                title: "Clarify OAuth flow",
                description: "Which tenant should the agent use?",
                source: {
                  channel: "telegram",
                  conversationId: "chat-42",
                  userId: "user-7",
                  messageId: "msg-9",
                },
              },
              {
                id: "task-2",
                status: "blocked",
                title: "Blocked deploy",
                result: {
                  failReason: "Missing credentials.",
                },
              },
            ],
          }),
      });
    });

    const Runtime = customElements.get("super-agent-runtime");
    const runtime = new Runtime();
    document.body.appendChild(runtime);

    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.querySelector("[data-running-count]").textContent).toBe("2");
    expect(
      runtime.querySelector('[data-task-id="task-1"]').classList.contains("status-needs_input"),
    ).toBe(true);
    expect(
      runtime.querySelector('[data-task-id="task-2"]').classList.contains("status-blocked"),
    ).toBe(true);

    runtime.querySelector('[data-task-id="task-1"]').click();
    runtime.querySelector('[data-task-id="task-2"]').click();

    expect(runtime.textContent).toContain("Source: telegram");
    expect(runtime.textContent).toContain("Missing credentials.");
  });
});
