import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../lib/firebase';

// ── Coordinator gate ──────────────────────────────────────────────────────
// The PIN lives in the database, not on the device, so the coordinator sets it
// once and it holds on every phone and laptop used for the study. It is stored
// as a salted PBKDF2 digest and the rules allow it to be created once and never
// updated or deleted from a client.
//
// This is a soft gate, not authentication: the study runs without sign-in, so a
// determined reader of the public config could still reach the collection. Its
// job is to keep ward staff out of the aggregate data and the export tools,
// which is what the protocol asks for. Anything stronger needs Firebase Auth.

const CONFIG_COLLECTION = 'config';
const COORDINATOR_DOC = 'coordinator';
const UNLOCK_KEY = 'uniosunth_coordinator_unlocked';
const PBKDF2_ITERATIONS = 250_000;

interface CoordinatorConfig {
  salt: string;
  hash: string;
  iterations: number;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function derive(pin: string, saltHex: string, iterations: number): Promise<string> {
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)),
  );
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256,
  );
  return toHex(bits);
}

function configDoc() {
  if (!firebaseConfigured || !db) {
    throw new Error('Study database is not configured.');
  }
  return doc(db, CONFIG_COLLECTION, COORDINATOR_DOC);
}

async function readConfig(): Promise<CoordinatorConfig | null> {
  const snap = await getDoc(configDoc());
  if (!snap.exists()) return null;
  const d = snap.data();
  if (typeof d.salt !== 'string' || typeof d.hash !== 'string') return null;
  return { salt: d.salt, hash: d.hash, iterations: d.iterations ?? PBKDF2_ITERATIONS };
}

/** Whether a coordinator PIN has been set for this study yet. */
export async function hasPIN(): Promise<boolean> {
  if (!firebaseConfigured) return false;
  try {
    return (await readConfig()) !== null;
  } catch {
    return false;
  }
}

/** First-run setup. Rejects if a PIN already exists — it is set once. */
export async function setPIN(pin: string): Promise<void> {
  if (await hasPIN()) {
    throw new Error('A coordinator PIN is already set for this study.');
  }
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await derive(pin, salt, PBKDF2_ITERATIONS);
  await setDoc(configDoc(), {
    salt,
    hash,
    iterations: PBKDF2_ITERATIONS,
    createdAt: serverTimestamp(),
  });
}

export async function verifyPIN(pin: string): Promise<boolean> {
  const config = await readConfig();
  if (!config) return false;
  const candidate = await derive(pin, config.salt, config.iterations);
  return candidate === config.hash;
}

// ── Unlock state ──────────────────────────────────────────────────────────
// sessionStorage holds a single "this tab is unlocked" flag and no study data.
// It clears when the tab closes, so a shared ward device never stays unlocked.

// The header badge, the route gates and the Data page all read this flag from
// different parts of the tree, so changes are published rather than polled —
// unlocking on one screen updates the others in the same render.
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(fn => fn());
}

export function subscribeToUnlock(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    // Private mode or blocked storage — treat as locked rather than throwing.
    return false;
  }
}

export function unlock(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    // Ignore: the gate still unlocks for this render, it just will not survive
    // a reload when storage is unavailable.
  }
  notify();
}

export function lock(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // Ignore — see unlock().
  }
  notify();
}
