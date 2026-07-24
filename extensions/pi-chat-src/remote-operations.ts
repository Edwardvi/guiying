import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";

import { chunkText } from "./render/chunking.js";

export interface RemoteCommand {
  name: string;
  args: string;
}

export interface RemoteOperationsPaths {
  tasksPath: string;
  instancesDir: string;
  modelPreferencesPath: string;
  workersDir: string;
  isProcessAlive?: (pid: number) => boolean;
}

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  targetProject?: string;
  source?: unknown;
  createdAt?: string;
  completedAt?: string;
  failReason?: string;
  result?: unknown;
  dispatch?: { targetProject?: string; startedAt?: string; finishedAt?: string };
};

type Instance = {
  pid: number;
  port?: number;
  cwd?: string;
  sessionFile?: string;
  startedAt?: string;
};
type Worker = { state?: string; conversationId?: string; updatedAt?: string; lastError?: string };
type ModelHealth = {
  key: string;
  status: string;
  checkedAt?: string;
  latencyMs?: number;
  error?: string;
};

export interface RemoteOperationsSnapshot {
  tasks: Task[];
  agents: Array<{
    targetProject: string;
    name: string;
    taskCount: number;
    activeCount: number;
    latestAt?: string;
    running: boolean;
  }>;
  instances: Instance[];
  workers: Worker[];
  modelHealth: ModelHealth[];
  errors: Array<{ at?: string; source: string; message: string }>;
}

export interface RemoteCommandResponse {
  chunks: string[];
}

const ACTIVE = new Set(["running", "needs_input", "blocked"]);

async function readJson(path: string): Promise<unknown> {
  try {
    const text = await readFile(path, "utf8");
    return text.trim() ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

async function readJsonDir(path: string): Promise<unknown[]> {
  try {
    const names = await readdir(path);
    const values = await Promise.all(
      names.filter((name) => name.endsWith(".json")).map((name) => readJson(`${path}/${name}`)),
    );
    return values.filter((value) => value !== undefined);
  } catch {
    return [];
  }
}

function timeOf(task: Task): string | undefined {
  return (
    task.dispatch?.finishedAt ?? task.completedAt ?? task.dispatch?.startedAt ?? task.createdAt
  );
}

function normalizeTask(value: unknown): Task | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return undefined;
  const dispatch =
    raw.dispatch && typeof raw.dispatch === "object"
      ? (raw.dispatch as Task["dispatch"])
      : undefined;
  const result =
    raw.result && typeof raw.result === "object"
      ? (raw.result as { completedAt?: unknown; failReason?: unknown })
      : undefined;
  return {
    ...(raw as Task),
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : "(untitled)",
    status: typeof raw.status === "string" ? raw.status : "pending",
    targetProject:
      typeof raw.targetProject === "string" ? raw.targetProject : dispatch?.targetProject,
    completedAt:
      typeof raw.completedAt === "string"
        ? raw.completedAt
        : typeof result?.completedAt === "string"
          ? result.completedAt
          : undefined,
    failReason:
      typeof raw.failReason === "string"
        ? raw.failReason
        : typeof result?.failReason === "string"
          ? result.failReason
          : undefined,
    dispatch,
  };
}

function compareTasks(a: Task, b: Task): number {
  const active = Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status));
  if (active) return active;
  return Date.parse(timeOf(b) ?? "") - Date.parse(timeOf(a) ?? "") || a.id.localeCompare(b.id);
}

export async function buildRemoteOperationsSnapshot(
  paths: RemoteOperationsPaths,
): Promise<RemoteOperationsSnapshot> {
  const [taskFile, instanceFiles, workerFiles, preferences] = await Promise.all([
    readJson(paths.tasksPath),
    readJsonDir(paths.instancesDir),
    readJsonDir(paths.workersDir),
    readJson(paths.modelPreferencesPath),
  ]);
  const taskValues = Array.isArray(taskFile)
    ? taskFile
    : taskFile &&
        typeof taskFile === "object" &&
        Array.isArray((taskFile as { tasks?: unknown }).tasks)
      ? (taskFile as { tasks: unknown[] }).tasks
      : [];
  const tasks = taskValues
    .map(normalizeTask)
    .filter((task): task is Task => Boolean(task))
    .sort(compareTasks);
  const alive = paths.isProcessAlive ?? (() => true);
  const instances = instanceFiles.filter((value): value is Instance => {
    if (!value || typeof value !== "object") return false;
    const pid = (value as Instance).pid;
    return Number.isInteger(pid) && alive(pid);
  });
  const workers = workerFiles.filter((value): value is Worker =>
    Boolean(value && typeof value === "object"),
  );
  const rawHealth =
    preferences && typeof preferences === "object"
      ? (preferences as { health?: Record<string, unknown> }).health
      : undefined;
  const modelHealth = Object.entries(rawHealth ?? {}).map(([key, value]) => ({
    key,
    status:
      value &&
      typeof value === "object" &&
      typeof (value as { status?: unknown }).status === "string"
        ? String((value as { status: string }).status)
        : "unknown",
    ...(value && typeof value === "object" ? (value as Omit<ModelHealth, "key" | "status">) : {}),
  }));
  const errors = [
    ...workers
      .filter((worker) => worker.lastError)
      .map((worker) => ({
        at: worker.updatedAt,
        source: "worker",
        message: worker.lastError as string,
      })),
    ...tasks
      .filter((task) => task.failReason)
      .map((task) => ({
        at: timeOf(task),
        source: `task ${task.id}`,
        message: task.failReason as string,
      })),
    ...modelHealth
      .filter((model) => model.error)
      .map((model) => ({
        at: model.checkedAt,
        source: `model ${model.key}`,
        message: model.error as string,
      })),
  ].sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""));
  const grouped = new Map<string, RemoteOperationsSnapshot["agents"][number]>();
  for (const task of tasks) {
    if (!task.targetProject) continue;
    const agent = grouped.get(task.targetProject) ?? {
      targetProject: task.targetProject,
      name: basename(task.targetProject) || task.targetProject,
      taskCount: 0,
      activeCount: 0,
      latestAt: undefined,
      running: instances.some((instance) => instance.cwd === task.targetProject),
    };
    agent.taskCount += 1;
    if (ACTIVE.has(task.status)) agent.activeCount += 1;
    if (Date.parse(timeOf(task) ?? "") > Date.parse(agent.latestAt ?? ""))
      agent.latestAt = timeOf(task);
    grouped.set(task.targetProject, agent);
  }
  return { tasks, agents: [...grouped.values()], instances, workers, modelHealth, errors };
}

function sourceText(source: unknown): string {
  if (typeof source === "string") return source;
  if (!source || typeof source !== "object") return "unknown";
  const value = source as { channel?: string; conversationId?: string; userId?: string };
  return (
    [value.channel, value.conversationId, value.userId].filter(Boolean).join(" / ") || "unknown"
  );
}

function taskResult(task: Task): string | undefined {
  if (typeof task.result === "string") return task.result;
  if (task.result && typeof task.result === "object") {
    const result = task.result as { summary?: unknown; failReason?: unknown };
    if (typeof result.summary === "string") return result.summary;
    if (typeof result.failReason === "string") return result.failReason;
  }
  return task.failReason;
}

function respond(text: string): RemoteCommandResponse {
  return { chunks: chunkText(text || "No data.", 4096) };
}

export function formatRemoteModels(
  models: Array<{ provider?: string; id?: string; name?: string }>,
  current?: { provider?: string; id?: string } | null,
): RemoteCommandResponse {
  const available = models
    .filter((model) => model.provider && model.id)
    .map((model) => `${model.provider}/${model.id}${model.name ? ` — ${model.name}` : ""}`)
    .sort((a, b) => a.localeCompare(b));
  const lines = [
    `Current: ${current?.provider && current.id ? `${current.provider}/${current.id}` : "none"}`,
    `Available models: ${available.length}`,
    ...available.map((model) => `- ${model}`),
  ];
  return respond(lines.join("\n"));
}

export function formatRemoteOperationsCommand(
  command: RemoteCommand,
  snapshot: RemoteOperationsSnapshot,
): RemoteCommandResponse {
  if (command.name === "agents") {
    if (!snapshot.agents.length) return respond("No Agent Index target agents found.");
    return respond(
      [
        "Agent Index agents:",
        ...snapshot.agents.map(
          (agent) =>
            `- ${agent.name} — ${agent.running ? "running" : "offline/history"}; ${agent.activeCount} active / ${agent.taskCount} tasks\n  ${agent.targetProject}`,
        ),
      ].join("\n"),
    );
  }
  if (command.name === "tasks") {
    if (!snapshot.tasks.length) return respond("No Agent Index tasks found.");
    return respond(
      [
        "Agent Index tasks:",
        ...snapshot.tasks
          .slice(0, 10)
          .map(
            (task) =>
              `- [${task.status}] ${task.id}: ${task.title}${task.targetProject ? ` → ${task.targetProject}` : ""}`,
          ),
      ].join("\n"),
    );
  }
  if (command.name === "task") {
    if (!command.args) return respond("Usage: /task <id>");
    const exact = snapshot.tasks.find((task) => task.id === command.args);
    const matches = exact
      ? [exact]
      : snapshot.tasks.filter((task) => task.id.startsWith(command.args));
    if (!matches.length) return respond(`Task not found: ${command.args}`);
    if (matches.length > 1)
      return respond(
        `Ambiguous task ID: ${command.args}\n${matches.map((task) => `- ${task.id}`).join("\n")}`,
      );
    const task = matches[0];
    const lines = [task.title, `ID: ${task.id}`, `Status: ${task.status}`];
    if (task.targetProject) lines.push(`Agent: ${task.targetProject}`);
    lines.push(`Source: ${sourceText(task.source)}`);
    if (task.createdAt) lines.push(`Created: ${task.createdAt}`);
    if (task.dispatch?.startedAt) lines.push(`Started: ${task.dispatch.startedAt}`);
    if (task.dispatch?.finishedAt ?? task.completedAt)
      lines.push(`Finished: ${task.dispatch?.finishedAt ?? task.completedAt}`);
    const result = taskResult(task);
    if (result) lines.push(`Result/error:\n${result}`);
    return respond(lines.join("\n"));
  }
  if (command.name === "health") {
    const unhealthy = snapshot.modelHealth.filter((model) => model.status === "unhealthy").length;
    const workerErrors = snapshot.workers.filter(
      (worker) => worker.lastError || worker.state === "error",
    ).length;
    return respond(
      [
        "Picot operations health:",
        `Telegram workers: ${snapshot.workers.length} (${workerErrors} errors)`,
        `Agent Index tasks: ${snapshot.tasks.length}`,
        `Running instances: ${snapshot.instances.length}`,
        `Model health: ${snapshot.modelHealth.length - unhealthy} healthy/unknown, ${unhealthy} unhealthy`,
      ].join("\n"),
    );
  }
  if (command.name === "errors") {
    if (!snapshot.errors.length) return respond("No recorded operations errors.");
    return respond(
      [
        "Recent operations errors:",
        ...snapshot.errors
          .slice(0, 10)
          .map((error) => `- ${error.at ?? "unknown time"} [${error.source}]\n${error.message}`),
      ].join("\n"),
    );
  }
  return respond("Unknown operations command.");
}
