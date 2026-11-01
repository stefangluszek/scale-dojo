import type { PracticeSession } from '../../domain/practice/session';
import { integerIn, isRecord } from './local';
import { isScaleId } from './settings';

export const SESSIONS_KEY = 'scale-dojo.sessions';

export function isSession(value: unknown): value is PracticeSession {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    !integerIn(value.startedAt, 0, 8.64e15) ||
    !integerIn(value.durationMs, 0) ||
    !integerIn(value.root, 0, 11) ||
    !isScaleId(value.scaleId) ||
    (value.status !== 'recording' &&
      value.status !== 'completed' &&
      value.status !== 'interrupted')
  )
    return false;
  const instrument = value.instrument;
  if (
    !isRecord(instrument) ||
    typeof instrument.id !== 'string' ||
    !instrument.id ||
    typeof instrument.name !== 'string' ||
    !instrument.name ||
    !integerIn(instrument.fretCount, 0, 127) ||
    !Array.isArray(instrument.tuning) ||
    !instrument.tuning.length ||
    !instrument.tuning.every((note) => integerIn(note, 0, 127))
  )
    return false;
  if (!Array.isArray(value.events)) return false;
  let previousEnd = 0;
  for (const event of value.events) {
    if (
      !isRecord(event) ||
      !integerIn(event.midi, 0, 127) ||
      !integerIn(event.startMs, previousEnd, value.durationMs) ||
      !integerIn(event.endMs, event.startMs, value.durationMs)
    )
      return false;
    previousEnd = event.endMs;
  }
  return true;
}

export function isSessions(value: unknown): value is PracticeSession[] {
  return (
    Array.isArray(value) &&
    value.every(isSession) &&
    new Set(value.map((session) => session.id)).size === value.length
  );
}
