import { isSuperAgentEnabled, setSuperAgentEnabled } from "../super-agent/settings.js";

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high"];

export function bindSuperAgentStartupToggle(toggleSuperAgent, onSuperAgentEnabledChanged) {
  if (!toggleSuperAgent || toggleSuperAgent.dataset.superAgentToggleBound === "true") return;
  toggleSuperAgent.dataset.superAgentToggleBound = "true";
  toggleSuperAgent.className = `settings-toggle${isSuperAgentEnabled() ? " on" : ""}`;
  toggleSuperAgent.addEventListener("click", async () => {
    const enabled = !toggleSuperAgent.classList.contains("on");
    setSuperAgentEnabled(enabled);
    toggleSuperAgent.className = `settings-toggle${enabled ? " on" : ""}`;
    await onSuperAgentEnabledChanged?.(enabled);
  });
}

/**
 * Reflect the current thinking level on the Faster↔Smarter segmented slider:
 * highlight the matching dot and slide the pill thumb over it.
 */
export function renderThinkingEffort(level, { thinkingSteps, thinkingMarker, thinkingName }) {
  const normalized = THINKING_LEVELS.includes(level) ? level : "off";
  const dots = thinkingSteps
    ? Array.from(thinkingSteps.querySelectorAll(".thinking-effort-dot"))
    : [];
  const count = dots.length || THINKING_LEVELS.length;
  let activeIdx = THINKING_LEVELS.indexOf(normalized);
  if (activeIdx < 0) activeIdx = 0;

  dots.forEach((dot, idx) => {
    const isActive = idx === activeIdx;
    dot.classList.toggle("active", isActive);
    dot.setAttribute("aria-checked", String(isActive));
  });

  if (thinkingMarker) {
    const segment = 100 / count;
    thinkingMarker.style.width = `calc(${segment}% - 6px)`;
    thinkingMarker.style.left = `calc(${activeIdx * segment}% + 3px)`;
  }

  if (thinkingName) thinkingName.textContent = normalized;
}

export function setupSettingsToggles({
  toggleAutoCompact,
  thinkingSteps,
  thinkingMarker,
  thinkingName,
  toggleShowThinking,
  toggleAuth,
  toggleSuperAgent,
  rpcCommand,
  getCurrentThinkingLevel,
  setCurrentThinkingLevel,
  updateThinkingBtn,
  onSuperAgentEnabledChanged,
}) {
  toggleAutoCompact?.addEventListener("click", async () => {
    const isOn = toggleAutoCompact.classList.contains("on");
    toggleAutoCompact.className = `settings-toggle${isOn ? "" : " on"}`;
    await rpcCommand({ type: "set_auto_compaction", enabled: !isOn });
  });

  // Click a dot to set the reasoning depth directly.
  thinkingSteps?.addEventListener("click", async (event) => {
    const step = event.target.closest(".thinking-effort-dot");
    if (!step) return;
    const level = step.dataset.level || "off";
    // Optimistically move the marker for snappy feedback.
    renderThinkingEffort(level, { thinkingSteps, thinkingMarker, thinkingName });
    const data = await rpcCommand({ type: "set_thinking_level", level });
    if (data?.success) {
      setCurrentThinkingLevel(level);
      updateThinkingBtn();
    } else {
      renderThinkingEffort(getCurrentThinkingLevel?.() || "off", {
        thinkingSteps,
        thinkingMarker,
        thinkingName,
      });
    }
  });

  const showThinking = localStorage.getItem("pi-studio-show-thinking") !== "false";
  if (toggleShowThinking) {
    toggleShowThinking.className = `settings-toggle${showThinking ? " on" : ""}`;
  }
  if (!showThinking) document.body.classList.add("hide-thinking");

  toggleShowThinking?.addEventListener("click", () => {
    const isOn = toggleShowThinking.classList.contains("on");
    toggleShowThinking.className = `settings-toggle${isOn ? "" : " on"}`;
    document.body.classList.toggle("hide-thinking", isOn);
    localStorage.setItem("pi-studio-show-thinking", !isOn);
  });

  bindSuperAgentStartupToggle(toggleSuperAgent, onSuperAgentEnabledChanged);

  toggleAuth?.addEventListener("click", async () => {
    const isOn = toggleAuth.classList.contains("on");
    const data = await rpcCommand({ type: "set_auth", enabled: !isOn });
    if (data?.success) {
      toggleAuth.className = `settings-toggle${!isOn ? " on" : ""}`;
    }
  });

  return {
    getCurrentThinkingLevel,
  };
}
