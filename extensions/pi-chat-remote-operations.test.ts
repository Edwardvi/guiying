// @vitest-environment node

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRemoteOperationsSnapshot,
  formatRemoteModels,
  formatRemoteOperationsCommand,
  type RemoteOperationsPaths,
} from "./pi-chat-src/remote-operations.ts";

async function fixture(): Promise<RemoteOperationsPaths> {
  const root = await mkdtemp(join(tmpdir(), "pi-chat-operations-"));
  const agentRoot = join(root, ".pi", "agent");
  const instancesDir = join(root, ".pi", "pistudio-instances");
  const workersDir = join(agentRoot, "chat", "worker-status");
  await mkdir(join(agentRoot, "super-agent"), { recursive: true });
  await mkdir(instancesDir, { recursive: true });
  await mkdir(workersDir, { recursive: true });
  return {
    tasksPath: join(agentRoot, "super-agent", "tasks.json"),
    instancesDir,
    modelPreferencesPath: join(agentRoot, "picot-models.json"),
    workersDir,
  };
}

describe("Telegram remote operations", () => {
  it("normalizes tasks and aggregates referenced target agents", async () => {
    const paths = await fixture();
    await writeFile(
      paths.tasksPath,
      JSON.stringify({
        tasks: [
          {
            id: "task-old",
            title: "Old",
            status: "done",
            targetProject: "/code/a",
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "task-live",
            title: "Live",
            status: "running",
            dispatch: { targetProject: "/code/a", startedAt: "2026-01-03T00:00:00Z" },
          },
          {
            id: "task-b",
            title: "Blocked",
            status: "blocked",
            targetProject: "/code/b",
            createdAt: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );

    const snapshot = await buildRemoteOperationsSnapshot(paths);

    expect(snapshot.tasks.map((task) => task.id)).toEqual(["task-live", "task-b", "task-old"]);
    expect(snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetProject: "/code/a", taskCount: 2, activeCount: 1 }),
        expect.objectContaining({ targetProject: "/code/b", taskCount: 1, activeCount: 1 }),
      ]),
    );
  });

  it("formats task lookup by unique prefix and reports ambiguous prefixes", async () => {
    const paths = await fixture();
    await writeFile(
      paths.tasksPath,
      JSON.stringify({
        tasks: [
          { id: "task-123-alpha", title: "Alpha", status: "done", targetProject: "/code/a" },
          { id: "task-123-beta", title: "Beta", status: "failed", failReason: "full failure text" },
        ],
      }),
    );
    const snapshot = await buildRemoteOperationsSnapshot(paths);

    expect(
      formatRemoteOperationsCommand({ name: "task", args: "task-123-alpha" }, snapshot).chunks.join(
        "\n",
      ),
    ).toContain("Alpha");
    expect(
      formatRemoteOperationsCommand({ name: "task", args: "task-123" }, snapshot).chunks.join("\n"),
    ).toContain("Ambiguous task ID");
  });

  it("survives malformed files and includes complete worker and model errors", async () => {
    const paths = await fixture();
    await writeFile(paths.tasksPath, "not-json");
    await writeFile(
      join(paths.workersDir, "telegram.json"),
      JSON.stringify({
        state: "error",
        updatedAt: "2026-01-04T00:00:00Z",
        lastError: "/Users/me/private provider failed",
      }),
    );
    await writeFile(
      paths.modelPreferencesPath,
      JSON.stringify({
        health: {
          "vendor/model": {
            status: "unhealthy",
            checkedAt: "2026-01-05T00:00:00Z",
            error: "https://user:secret@example.test failed",
          },
        },
      }),
    );

    const snapshot = await buildRemoteOperationsSnapshot(paths);
    const errors = formatRemoteOperationsCommand(
      { name: "errors", args: "" },
      snapshot,
    ).chunks.join("\n");

    expect(snapshot.tasks).toEqual([]);
    expect(errors).toContain("/Users/me/private provider failed");
    expect(errors).toContain("https://user:secret@example.test failed");
  });

  it("normalizes errors from the current nested task result shape", async () => {
    const paths = await fixture();
    await writeFile(
      paths.tasksPath,
      JSON.stringify({
        tasks: [
          {
            id: "task-current",
            title: "Current shape",
            status: "failed",
            result: {
              status: "failed",
              completedAt: "2026-01-06T00:00:00Z",
              failReason: "nested complete failure",
            },
          },
        ],
      }),
    );

    const snapshot = await buildRemoteOperationsSnapshot(paths);

    expect(snapshot.errors).toEqual([
      expect.objectContaining({
        at: "2026-01-06T00:00:00Z",
        source: "task task-current",
        message: "nested complete failure",
      }),
    ]);
  });

  it("chunks every command response below Telegram's message limit", async () => {
    const paths = await fixture();
    await writeFile(
      paths.tasksPath,
      JSON.stringify({
        tasks: Array.from({ length: 20 }, (_, index) => ({
          id: `task-${index}`,
          title: "x".repeat(600),
          status: "pending",
          targetProject: `/code/${index}-${"agent".repeat(150)}`,
        })),
      }),
    );
    const snapshot = await buildRemoteOperationsSnapshot(paths);
    const response = formatRemoteOperationsCommand({ name: "agents", args: "" }, snapshot);

    expect(response.chunks.length).toBeGreaterThan(1);
    expect(response.chunks.every((chunk) => chunk.length <= 4096)).toBe(true);
  });

  it("formats the current and available models", () => {
    const response = formatRemoteModels(
      [
        { provider: "openai", id: "gpt-5" },
        { provider: "anthropic", id: "claude" },
      ],
      { provider: "openai", id: "gpt-5" },
    );
    expect(response.chunks.join("\n")).toContain("Current: openai/gpt-5");
    expect(response.chunks.join("\n")).toContain("anthropic/claude");
  });
});
