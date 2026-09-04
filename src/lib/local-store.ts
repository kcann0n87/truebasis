// Optional "remember on this device" persistence. Everything stays in the
// browser's localStorage — nothing is ever sent to a server. Off by default:
// refresh the page and the statements are gone unless the user opted in.

import type { CcStartingPosition } from "./covered-calls";

const KEY = "truebasis.v1";

export interface StoredState {
  statements: Array<{ id: string; fileName: string; text: string; uploadedAt: string }>;
  overrides: Record<string, CcStartingPosition>;
  excludedFills: string[];
}

export function loadStored(): StoredState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object" || !Array.isArray(j.statements)) return null;
    return {
      statements: j.statements,
      overrides: j.overrides && typeof j.overrides === "object" ? j.overrides : {},
      excludedFills: Array.isArray(j.excludedFills) ? j.excludedFills : [],
    };
  } catch {
    return null;
  }
}

// Returns an error message if the browser refused (usually the ~5 MB quota).
export function saveStored(state: StoredState): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function clearStored() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
