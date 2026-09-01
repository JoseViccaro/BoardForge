import { describe, it, expect } from "vitest";
import {
  resolveShortcut,
  type KeyboardEventDescriptor,
} from "../../../src/ui/workbench/keyboardShortcuts.js";

/**
 * Unit 4B — Keyboard shortcuts pure core (RED tests).
 *
 * Tests the DOM-free resolveShortcut function that maps a normalized
 * keyboard event descriptor to a WorkbenchAction (or null for no-op).
 *
 * ASVS L2: keyboard input is user input — tests verify that only
 * known, normalized combos produce actions; browser-chrome keys,
 * modifier-only presses, and unknown combos are rejected.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function desc(
  overrides: Partial<KeyboardEventDescriptor> = {}
): KeyboardEventDescriptor {
  return {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    key: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("keyboardShortcuts", () => {
  // ---- Ctrl+number → panel focus ------------------------------------------

  it("Ctrl+1 focuses the boardview panel", () => {
    const action = resolveShortcut(
      desc({ ctrlKey: true, key: "1" })
    );
    expect(action).toEqual({ type: "panel-focus", panel: "boardview" });
  });

  it("Ctrl+2 focuses the schematics panel", () => {
    const action = resolveShortcut(
      desc({ ctrlKey: true, key: "2" })
    );
    expect(action).toEqual({ type: "panel-focus", panel: "schematics" });
  });

  it("Ctrl+3 focuses the navigator panel", () => {
    const action = resolveShortcut(
      desc({ ctrlKey: true, key: "3" })
    );
    expect(action).toEqual({ type: "panel-focus", panel: "navigator" });
  });

  it("Ctrl+4 focuses the measurements panel", () => {
    const action = resolveShortcut(
      desc({ ctrlKey: true, key: "4" })
    );
    expect(action).toEqual({ type: "panel-focus", panel: "measurements" });
  });

  // ---- Net jump (search focus) --------------------------------------------

  it("Ctrl+G triggers search-focus (net jump)", () => {
    const action = resolveShortcut(
      desc({ ctrlKey: true, key: "g" })
    );
    expect(action).toEqual({ type: "search-focus" });
  });

  // ---- Cross-probe toggle -------------------------------------------------

  it("Ctrl+Shift+X toggles cross-probe highlighting", () => {
    const action = resolveShortcut(
      desc({ ctrlKey: true, shiftKey: true, key: "x" })
    );
    expect(action).toEqual({ type: "cross-probe-toggle" });
  });

  // ---- Browser chrome keys → null -----------------------------------------

  it("ignores browser chrome keys (Ctrl+R, F5, Ctrl+T, Ctrl+W, Ctrl+N)", () => {
    // Ctrl+R (browser refresh) — must not produce an action
    expect(resolveShortcut(desc({ ctrlKey: true, key: "r" }))).toBeNull();
    // F5 (hard refresh) — bare function key
    expect(resolveShortcut(desc({ key: "F5" }))).toBeNull();
    // Ctrl+T (new tab)
    expect(resolveShortcut(desc({ ctrlKey: true, key: "t" }))).toBeNull();
    // Ctrl+W (close tab)
    expect(resolveShortcut(desc({ ctrlKey: true, key: "w" }))).toBeNull();
    // Ctrl+N (new window)
    expect(resolveShortcut(desc({ ctrlKey: true, key: "n" }))).toBeNull();
  });

  // ---- Edge cases: modifier-only, unknown, case handling ------------------

  it("returns null for modifier-only presses, unknown combos, and respects case normalization", () => {
    // Modifier-only: Ctrl pressed alone (key = "Control")
    expect(
      resolveShortcut(desc({ ctrlKey: true, key: "Control" }))
    ).toBeNull();

    // Shift-only
    expect(
      resolveShortcut(desc({ shiftKey: true, key: "Shift" }))
    ).toBeNull();

    // Unknown combo: Ctrl+Z is not in our whitelist
    expect(
      resolveShortcut(desc({ ctrlKey: true, key: "z" }))
    ).toBeNull();

    // Meta key (OS-level) — never triggers workbench actions
    expect(
      resolveShortcut(desc({ metaKey: true, key: "1" }))
    ).toBeNull();

    // Alt-only with a digit — not a workbench shortcut
    expect(
      resolveShortcut(desc({ altKey: true, key: "1" }))
    ).toBeNull();

    // Case handling: uppercase "G" should resolve identically to lowercase
    expect(
      resolveShortcut(desc({ ctrlKey: true, key: "G" }))
    ).toEqual({ type: "search-focus" });

    // Case handling: uppercase "X" with Ctrl+Shift should also work
    expect(
      resolveShortcut(desc({ ctrlKey: true, shiftKey: true, key: "X" }))
    ).toEqual({ type: "cross-probe-toggle" });
  });
});
