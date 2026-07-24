// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildSuperAgentProjectRegistry,
  isLiveProcessStat,
  markChatWorkerSessions,
  mergeLiveInstanceSessions,
} from "./embedded-server.ts";

describe("Picot instance registry process filtering", () => {
  it("treats zombie process stats as not live", () => {
    expect(isLiveProcessStat("Z")).toBe(false);
    expect(isLiveProcessStat("Z+")).toBe(false);
    expect(isLiveProcessStat("S+")).toBe(true);
    expect(isLiveProcessStat("R")).toBe(true);
  });
});

describe("Picot live instance session merge", () => {
  it("adds a placeholder session for a live instance whose session file has not been written yet", () => {
    const projects = mergeLiveInstanceSessions(
      [],
      [
        {
          port: 47822,
          pid: 123,
          sessionFile:
            "/Users/me/.pi/agent/sessions/--Users-me-.pi-agent-super-agent--/new-session.jsonl",
          cwd: "/Users/me/.pi/agent/super-agent",
          startedAt: "2026-07-01T03:05:07.012Z",
        },
      ],
    );

    expect(projects).toEqual([
      {
        path: "/Users/me/.pi/agent/super-agent",
        dirName: "--Users-me-.pi-agent-super-agent--",
        sessions: [
          expect.objectContaining({
            file: "new-session.jsonl",
            filePath:
              "/Users/me/.pi/agent/sessions/--Users-me-.pi-agent-super-agent--/new-session.jsonl",
            cwd: "/Users/me/.pi/agent/super-agent",
            name: "New Session",
          }),
        ],
      },
    ]);
  });

  it("does not duplicate a live instance when the session file is already listed", () => {
    const existing = {
      path: "/repo",
      dirName: "--repo--",
      sessions: [{ filePath: "/sessions/--repo--/a.jsonl", name: "Existing" }],
    };

    const projects = mergeLiveInstanceSessions(
      [existing],
      [
        {
          port: 47821,
          pid: 123,
          sessionFile: "/sessions/--repo--/a.jsonl",
          cwd: "/repo",
          startedAt: "2026-07-01T03:05:07.012Z",
        },
      ],
    );

    expect(projects[0].sessions).toHaveLength(1);
    expect(projects[0].sessions[0]).toMatchObject({
      filePath: "/sessions/--repo--/a.jsonl",
      name: "Existing",
      port: 47821,
      isRunning: true,
    });
  });

  it("adds live metadata to an existing session file", () => {
    const projects = mergeLiveInstanceSessions(
      [
        {
          path: "/Users/me/.pi/agent/super-agent",
          dirName: "--Users-me-.pi-agent-super-agent--",
          sessions: [
            {
              filePath: "/sessions/--Users-me-.pi-agent-super-agent--/super-agent.jsonl",
              name: "Super Agent",
            },
          ],
        },
      ],
      [
        {
          port: 47821,
          pid: 123,
          sessionFile: "/sessions/--Users-me-.pi-agent-super-agent--/super-agent.jsonl",
          cwd: "/Users/me/.pi/agent/super-agent",
          startedAt: "2026-07-01T03:05:07.012Z",
        },
      ],
    );

    expect(projects[0].sessions).toHaveLength(1);
    expect(projects[0].sessions[0]).toMatchObject({
      filePath: "/sessions/--Users-me-.pi-agent-super-agent--/super-agent.jsonl",
      name: "Super Agent",
      port: 47821,
      pid: 123,
      cwd: "/Users/me/.pi/agent/super-agent",
      isRunning: true,
      startedAt: "2026-07-01T03:05:07.012Z",
    });
  });
});

describe("Super Agent project registry", () => {
  it("returns routable running projects without the Super Agent manager workspace", () => {
    const registry = buildSuperAgentProjectRegistry(
      [
        {
          port: 47821,
          pid: 123,
          sessionFile: "/sessions/project-a/session.jsonl",
          cwd: "/Users/me/project-a",
          startedAt: "2026-07-10T10:00:00.000Z",
        },
        {
          port: 47822,
          pid: 124,
          sessionFile: "/sessions/super-agent/session.jsonl",
          cwd: "/Users/me/.pi/agent/super-agent",
          startedAt: "2026-07-10T11:00:00.000Z",
        },
      ],
      { superAgentPath: "/Users/me/.pi/agent/super-agent" },
    );

    expect(registry).toEqual({
      projects: [
        {
          id: "/Users/me/project-a",
          name: "project-a",
          cwd: "/Users/me/project-a",
          status: "running",
          activePort: 47821,
          lastActiveAt: "2026-07-10T10:00:00.000Z",
        },
      ],
    });
  });
});

describe("Picot chat worker session markers", () => {
  it("marks the session owned by the connected chat worker", () => {
    const projects = markChatWorkerSessions(
      [
        {
          path: "/Users/me/.pi/agent/super-agent",
          dirName: "--Users-me-.pi-agent-super-agent--",
          sessions: [
            { filePath: "/sessions/old.jsonl", name: "Old" },
            { filePath: "/sessions/current.jsonl", name: "Current" },
          ],
        },
      ],
      [
        {
          state: "connected",
          sessionFile: "/sessions/current.jsonl",
          conversationId: "telegram/main",
          updatedAt: "2026-07-03T18:17:19.000Z",
        },
      ],
    );

    expect(projects[0].sessions[0]).not.toHaveProperty("chatConnected");
    expect(projects[0].sessions[1]).toMatchObject({
      filePath: "/sessions/current.jsonl",
      chatConnected: true,
      chatConversationId: "telegram/main",
      chatUpdatedAt: "2026-07-03T18:17:19.000Z",
    });
  });
});
