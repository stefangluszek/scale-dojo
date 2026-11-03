import { afterEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_BASS } from '../../domain/instruments/fretted';
import { SessionCapture } from '../../domain/practice/session';
import { readStored, writeStored } from './local';
import { isSession, isSessions, SESSIONS_KEY } from './sessions';
import { DEFAULT_SETTINGS, isSettings, SETTINGS_KEY } from './settings';

afterEach(() => vi.restoreAllMocks());
const saved = () =>
  new SessionCapture(
    { root: 0, scaleId: 'major', instrument: STANDARD_BASS },
    0,
    0,
    'test',
  ).finish(400);

describe('versioned browser storage', () => {
  it('round-trips settings and sessions, including an empty session', () => {
    expect(readStored(SETTINGS_KEY, isSettings, DEFAULT_SETTINGS)).toEqual({
      value: DEFAULT_SETTINGS,
      problem: null,
    });
    const settings = {
      ...DEFAULT_SETTINGS,
      root: 9,
      scaleId: 'natural-minor',
      tempo: 120,
      volume: 35,
      view: 'full',
    } as const;
    expect(writeStored(SETTINGS_KEY, settings)).toBeNull();
    expect(
      readStored(SETTINGS_KEY, isSettings, DEFAULT_SETTINGS).value,
    ).toEqual(settings);
    writeStored(SESSIONS_KEY, [saved()]);
    expect(readStored(SESSIONS_KEY, isSessions, []).value).toEqual([saved()]);
  });

  it.each([
    '{',
    'null',
    '[]',
    '{"version":2,"value":{}}',
    '{"version":1,"value":{"root":99}}',
  ])('recovers from invalid data without overwriting it: %s', (raw) => {
    localStorage.setItem(SETTINGS_KEY, raw);
    expect(readStored(SETTINGS_KEY, isSettings, DEFAULT_SETTINGS)).toEqual({
      value: DEFAULT_SETTINGS,
      problem: 'invalid',
    });
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(raw);
  });

  it('reads settings saved before volume existed', () => {
    const { volume: _volume, ...saved } = DEFAULT_SETTINGS;
    writeStored(SETTINGS_KEY, saved);
    expect(readStored(SETTINGS_KEY, isSettings, DEFAULT_SETTINGS)).toEqual({
      value: saved,
      problem: null,
    });
  });

  it('survives blocked storage and quota failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readStored(SESSIONS_KEY, isSessions, []).problem).toBe(
      'unavailable',
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(writeStored(SESSIONS_KEY, [])).toBe('unavailable');
  });

  it('rejects invalid settings and unsafe session data', () => {
    for (const change of [
      { root: -1 },
      { scaleId: 'unknown' },
      { tempo: 0 },
      { tempo: 500 },
      { volume: -5 },
      { volume: 101 },
      { volume: 50.5 },
      { view: 'unknown' },
    ]) {
      expect(isSettings({ ...DEFAULT_SETTINGS, ...change })).toBe(false);
    }
    const session = saved();
    for (const change of [
      { startedAt: 9e15 },
      { durationMs: -1 },
      { status: 'unknown' },
      { root: 12 },
      { scaleId: 'missing' },
      { instrument: null },
      { instrument: { ...STANDARD_BASS, tuning: [] } },
      { instrument: { ...STANDARD_BASS, tuning: [200] } },
      { events: 'bad' },
      { events: [{ startMs: 0, endMs: 500, midi: 28 }] },
      {
        events: [
          { startMs: 0, endMs: 200, midi: 28 },
          { startMs: 100, endMs: 300, midi: 29 },
        ],
      },
      { events: [{ startMs: 0, endMs: 300, midi: -1 }] },
    ])
      expect(isSession({ ...session, ...change })).toBe(false);
    expect(isSession(null)).toBe(false);
    expect(isSessions([session, session])).toBe(false);
    expect(isSessions(null)).toBe(false);
  });
});
