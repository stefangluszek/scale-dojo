export type StorageProblem = 'invalid' | 'unavailable';

/** Versioned, validated browser data. No writes on read or failed validation. */
export function readStored<T>(
  key: string,
  valid: (value: unknown) => value is T,
  fallback: T,
): { value: T; problem: StorageProblem | null } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { value: fallback, problem: 'unavailable' };
  }
  if (raw === null) return { value: fallback, problem: null };
  try {
    const data: unknown = JSON.parse(raw);
    if (isRecord(data) && data.version === 1 && valid(data.value))
      return { value: data.value, problem: null };
  } catch {
    /* Invalid JSON is handled like an unknown schema. */
  }
  return { value: fallback, problem: 'invalid' };
}

export function writeStored<T>(key: string, value: T): StorageProblem | null {
  try {
    window.localStorage.setItem(key, JSON.stringify({ version: 1, value }));
    return null;
  } catch {
    return 'unavailable';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function integerIn(
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
