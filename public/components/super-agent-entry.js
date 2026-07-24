/**
 * <super-agent-entry> Web Component
 *
 * The sidebar entry for Super Agent.
 * Renders the icon, name, status line, and badge.
 * Compatibility wrapper only: navigation is owned by the pinned normal session
 * rendered by SessionSidebar.
 */

class SuperAgentEntry extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="super-agent-entry-inner">
        <div class="super-agent-entry-icon">⚡</div>
        <div class="super-agent-entry-info">
          <div class="super-agent-entry-name">AGENT INBOX</div>
          <div class="super-agent-entry-status">
            <span class="super-agent-status-dot"></span>
            <span class="super-agent-status-text">Incoming work · Telegram</span>
          </div>
        </div>
        <div class="super-agent-entry-badge hidden" data-badge>0</div>
      </div>
    `;

    this.addEventListener("click", () => this._open());
  }

  // Called by <super-agent-runtime> when pending/running count changes
  setBadge(count) {
    const el = this.querySelector("[data-badge]");
    if (!el) return;
    el.textContent = count;
    el.classList.toggle("hidden", count === 0);
  }

  async _open() {
    document.querySelector(".super-agent-pinned-group .session-item")?.click();
    document.dispatchEvent(new CustomEvent("sa-open-runtime", { detail: { filter: "pending" } }));
  }
}

customElements.define("super-agent-entry", SuperAgentEntry);
