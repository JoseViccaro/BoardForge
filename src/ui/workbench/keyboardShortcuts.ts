/**
 * Pure DOM-free keyboard shortcuts core (Unit 4B).
 *
 * Takes a normalized keyboard event descriptor and returns a WorkbenchAction
 * (or null for no-op). ALL logic lives here; the shell is a zero-logic adapter
 * that normalizes DOM events into the descriptor and delegates to this function.
 *
 * Design rationale:
 * - Whitelist approach: only known combos produce actions. Unknown combos
 *   return null — the shell does nothing and the browser handles the event.
 * - ASVS L2 (input handling): keyboard input is user input. We normalize the
 *   key interpretation (lowercase, trim) before acting. Browser-chrome reserved
 *   keys are explicitly rejected as defense-in-depth.
 * - Meta key (Cmd on macOS, Win on Windows) is never used for workbench
 *   shortcuts because it conflicts with OS-level shortcuts.
 * - Modifier-only presses (e.g. holding Ctrl) are rejected.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Normalized keyboard event descriptor (DOM-free). */
export interface KeyboardEventDescriptor {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
}

/** Workbench panel identifiers (matching data-panel attributes in the shell). */
export type WorkbenchPanel =
  | "boardview"
  | "schematics"
  | "navigator"
  | "measurements";

/** Normalized action returned by resolveShortcut. */
export type WorkbenchAction =
  | { type: "panel-focus"; panel: WorkbenchPanel }
  | { type: "search-focus" }
  | { type: "cross-probe-toggle" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ctrl+digit → panel focus mapping. */
const PANEL_SHORTCUTS: Record<string, WorkbenchPanel> = {
  "1": "boardview",
  "2": "schematics",
  "3": "navigator",
  "4": "measurements",
};

/**
 * Keys reserved by the browser that must NEVER produce a workbench action.
 * Defense-in-depth (ASVS L2): the whitelist approach already filters these,
 * but this set documents the browser's reservation and provides an early-exit
 * fast path so we never accidentally whitelist one in the future.
 */
const BROWSER_RESERVED_KEYS = new Set([
  // Function keys
  "F1", "F2", "F3", "F4", "F5", "F6",
  "F7", "F8", "F9", "F10", "F11", "F12",
  // Navigation / editing
  "Tab", "Escape", "ArrowUp", "ArrowDown",
  "ArrowLeft", "ArrowRight",
  "Home", "End", "PageUp", "PageDown",
]);

/** Modifier key names emitted by the DOM when a modifier is pressed alone. */
const MODIFIER_KEYS = new Set([
  "Control", "Shift", "Alt", "Meta",
  "Ctrl", "capslock", "NumLock", "ScrollLock",
]);

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Maps a normalized keyboard event descriptor to a workbench action.
 *
 * Returns `null` when the key combo is not a recognized workbench shortcut
 * (browser chrome, modifier-only, unknown combo, etc.).
 *
 * @param desc — normalized keyboard event (DOM-free). The caller (shell adapter)
 *               is responsible for producing this from the real DOM event.
 */
export function resolveShortcut(
  desc: KeyboardEventDescriptor
): WorkbenchAction | null {
  // 1. Normalize the key: lowercase + trim. Reject empty / whitespace-only.
  const key = normalizeKey(desc.key);
  if (key === null) return null;

  // 2. Reject browser-chrome reserved bare keys (defense-in-depth).
  if (BROWSER_RESERVED_KEYS.has(key)) return null;

  // 3. Reject modifier-only presses (e.g. holding Ctrl with key "Control").
  if (MODIFIER_KEYS.has(key)) return null;

  // 4. Meta key (Cmd/Win) — never triggers workbench actions; conflicts with
  //    OS-level shortcuts. Reject unconditionally.
  if (desc.metaKey) return null;

  // 5. Alt modifier — not used by any workbench shortcut.
  if (desc.altKey) return null;

  // 6. Ctrl+digit → panel focus
  if (desc.ctrlKey && !desc.shiftKey) {
    const panel = PANEL_SHORTCUTS[key];
    if (panel) return { type: "panel-focus", panel };

    // Ctrl+G → search focus (net jump)
    if (key === "g") return { type: "search-focus" };
  }

  // 7. Ctrl+Shift+letter → cross-probe toggle
  if (desc.ctrlKey && desc.shiftKey) {
    if (key === "x") return { type: "cross-probe-toggle" };
  }

  // 8. No match → null (no-op; the shell lets the browser handle it).
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize the raw key string: trim whitespace, lowercase.
 * Returns null for empty / whitespace-only / control-character keys.
 */
function normalizeKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Reject single control characters (non-printable).
  // Printable keys are length >= 1 after trim and are not sole control chars.
  if (trimmed.length === 1) {
    const code = trimmed.charCodeAt(0);
    // ASCII control chars 0x00-0x1F (except printable ones we handle) and DEL
    if (code < 0x20 || code === 0x7f) return null;
  }

  return trimmed.toLowerCase();
}
