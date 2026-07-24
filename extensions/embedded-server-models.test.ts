// @vitest-environment node

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildModelCatalog,
  getAvailableModelsForRpc,
  ModelPreferencesStore,
  sanitizeHealthError,
} from "./embedded-server.ts";

describe("embedded server model listing", () => {
  it("uses the cached model registry when session context is unavailable", async () => {
    const models = [{ provider: "anthropic", id: "claude-sonnet-5" }];
    const registry = {
      getAvailable: async () => models,
    };

    await expect(getAvailableModelsForRpc(null, registry)).resolves.toEqual(models);
  });

  it("excludes hidden models from the available model RPC list", async () => {
    const models = [
      { provider: "anthropic", id: "claude-sonnet-5" },
      { provider: "anthropic", id: "claude-opus-5" },
    ];
    const store = new ModelPreferencesStore(
      join(mkdtempSync(join(tmpdir(), "picot-models-")), "prefs.json"),
    );
    store.setVisibility("anthropic", "claude-opus-5", false);

    await expect(
      getAvailableModelsForRpc(
        null,
        {
          getAvailable: async () => models,
        },
        store,
      ),
    ).resolves.toEqual([{ provider: "anthropic", id: "claude-sonnet-5" }]);
  });

  it("builds a catalog with only auth-available models, visibility, and health", async () => {
    const store = new ModelPreferencesStore(
      join(mkdtempSync(join(tmpdir(), "picot-models-")), "prefs.json"),
    );
    store.setVisibility("anthropic", "claude-opus-5", false);
    store.setHealth("anthropic", "claude-sonnet-5", {
      status: "healthy",
      checkedAt: "2026-07-08T00:00:00.000Z",
      latencyMs: 12,
    });
    const registry = {
      getAll: () => [
        { provider: "anthropic", id: "claude-sonnet-5", contextWindow: 200000 },
        { provider: "anthropic", id: "claude-opus-5", contextWindow: 200000 },
        { provider: "openai", id: "gpt-4.1" },
      ],
      getAvailable: async () => [
        { provider: "anthropic", id: "claude-sonnet-5", contextWindow: 200000 },
        { provider: "openai", id: "gpt-4.1" },
      ],
      getProviderAuthStatus: (provider: string) => ({
        configured: provider !== "openai",
        source: provider === "anthropic" ? "stored" : undefined,
      }),
      getProviderDisplayName: (provider: string) =>
        provider === "anthropic" ? "Anthropic" : provider,
    };

    await expect(buildModelCatalog(registry, store)).resolves.toEqual({
      providers: [
        {
          provider: "anthropic",
          displayName: "Anthropic",
          configured: true,
          source: "stored",
          label: undefined,
          models: [
            {
              provider: "anthropic",
              id: "claude-sonnet-5",
              name: undefined,
              contextWindow: 200000,
              available: true,
              visible: true,
              health: {
                status: "healthy",
                checkedAt: "2026-07-08T00:00:00.000Z",
                latencyMs: 12,
              },
            },
          ],
        },
        {
          provider: "openai",
          displayName: "openai",
          configured: false,
          source: undefined,
          label: undefined,
          models: [
            {
              provider: "openai",
              id: "gpt-4.1",
              name: undefined,
              contextWindow: undefined,
              available: true,
              visible: true,
              health: { status: "unknown" },
            },
          ],
        },
      ],
    });
  });

  it("keeps no-key providers but omits their model rows", async () => {
    const store = new ModelPreferencesStore(
      join(mkdtempSync(join(tmpdir(), "picot-models-")), "prefs.json"),
    );
    const registry = {
      getAll: () => [
        { provider: "anthropic", id: "claude-sonnet-5" },
        { provider: "openai", id: "gpt-4.1" },
      ],
      getAvailable: async () => [{ provider: "anthropic", id: "claude-sonnet-5" }],
      getProviderAuthStatus: (provider: string) => ({
        configured: provider === "anthropic",
        source: provider === "anthropic" ? "stored" : undefined,
      }),
      getProviderDisplayName: (provider: string) => provider,
    };

    const catalog = await buildModelCatalog(registry, store);

    expect(catalog.providers.find((p) => p.provider === "openai")?.models).toEqual([]);
  });

  it("persists model visibility preferences", () => {
    const path = join(mkdtempSync(join(tmpdir(), "picot-models-")), "prefs.json");
    const first = new ModelPreferencesStore(path);
    first.setVisibility("anthropic", "claude-opus-5", false);

    const second = new ModelPreferencesStore(path);

    expect(second.isVisible("anthropic", "claude-opus-5")).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({
      visibility: { "anthropic/claude-opus-5": false },
    });
  });

  it("sanitizes health errors before storing or returning them", () => {
    expect(
      sanitizeHealthError("Request failed with key sk-ant-1234567890 and bearer abcdefghij"),
    ).toBe("Request failed with key [REDACTED] and bearer [REDACTED]");
  });
});
