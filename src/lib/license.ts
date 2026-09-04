// Pro licence gate — PLACEHOLDER.
//
// There is no server in this app, so the gate is client-side: a licence key
// is pasted in once, checked, and remembered in localStorage. Until a real
// check exists this accepts any key shaped like TB-XXXX-XXXX-XXXX so the UI
// plumbing can be exercised. Before charging anyone, replace `validateKey`
// with a call to a tiny serverless endpoint that verifies the key against
// Stripe / Lemon Squeezy (and ideally returns a signed token to cache here).

export const FREE_STATEMENT_LIMIT = 1;
const KEY = "truebasis.license";

export function validateKey(key: string): boolean {
  return /^TB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.trim().toUpperCase());
}

export function loadLicense(): string | null {
  try {
    const k = localStorage.getItem(KEY);
    return k && validateKey(k) ? k : null;
  } catch {
    return null;
  }
}

export function saveLicense(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY, key.trim().toUpperCase());
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
