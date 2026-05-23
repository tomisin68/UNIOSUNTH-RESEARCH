const PIN_HASH_KEY = 'uniosunth_coordinator_pin_hash';
const SESSION_KEY = 'uniosunth_coordinator_unlocked';

// ── SHA-256 hash via Web Crypto (no dependencies) ─────────────────────────
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── PIN management ────────────────────────────────────────────────────────

export function hasPIN(): boolean {
  return Boolean(localStorage.getItem(PIN_HASH_KEY));
}

export async function setPIN(pin: string): Promise<void> {
  localStorage.setItem(PIN_HASH_KEY, await sha256(pin));
}

export async function verifyPIN(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  return (await sha256(pin)) === stored;
}

// ── Session unlock (clears when tab/browser closes) ──────────────────────

export function isUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function unlock(): void {
  sessionStorage.setItem(SESSION_KEY, '1');
}

export function lock(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
