// Identifier generation. Nothing here touches storage — records live in
// Firestore only (see utils/records.ts).

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Short, unique, human-readable participant code: NRS-XXXXXX
// Excludes ambiguous glyphs (0/O, 1/I) so codes can be read aloud on a ward.
export function generateNurseCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  for (const byte of arr) code += chars[byte % chars.length];
  return `NRS-${code}`;
}
