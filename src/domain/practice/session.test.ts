import { describe, expect, it } from 'vitest';
import { STANDARD_BASS } from '../instruments/fretted';
import type { LiveReading } from '../pitch/stabilizer';
import { SessionCapture, sessionSummary } from './session';

const note = (midi: number, cents = 0): LiveReading => ({
  kind: 'note',
  midi,
  cents,
  frequency: 100,
});
const context = {
  root: 0,
  scaleId: 'major-pentatonic',
  instrument: STANDARD_BASS,
} as const;

function capture() {
  return new SessionCapture(context, 1000, 1_700_000_000_000, 'example');
}

describe('practice event segmentation', () => {
  it('groups a held pitch despite changing tuning, and ends it at the next pitch', () => {
    const session = capture();
    session.push(note(28), 1100);
    session.push(note(28, 12), 1300);
    session.push(note(28, -4), 1500);
    session.push(note(29), 1600);
    expect(session.finish(1900).events).toEqual([
      { startMs: 100, endMs: 600, midi: 28 },
      { startMs: 600, endMs: 900, midi: 29 },
    ]);
  });

  it('separates repeated notes after silence or unclear sound without counting either as mistakes', () => {
    const session = capture();
    session.push({ kind: 'silent' }, 1020);
    session.push(note(28), 1100);
    session.push({ kind: 'silent' }, 1400);
    session.push(note(28), 1600);
    session.push({ kind: 'unclear' }, 1800);
    session.push({ kind: 'unclear' }, 2000);
    session.push(note(29), 2100);
    const saved = session.finish(2400);
    expect(saved.events).toEqual([
      { startMs: 100, endMs: 400, midi: 28 },
      { startMs: 600, endMs: 800, midi: 28 },
      { startMs: 1100, endMs: 1400, midi: 29 },
    ]);
    expect(sessionSummary(saved)).toEqual({
      total: 3,
      inScale: 2,
      outside: 1,
      percent: 67,
    });
  });

  it('takes independent checkpoints and freezes the original scale and instrument', () => {
    const tuning = [28, 33, 38, 43];
    const settings = { ...context, instrument: { ...STANDARD_BASS, tuning } };
    const session = new SessionCapture(settings, 0, 0, 'frozen');
    tuning[0] = 24;
    settings.instrument.name = 'changed' as typeof STANDARD_BASS.name;
    session.push(note(28), 100);
    const checkpoint = session.snapshot();
    session.push(note(28), 500);
    const saved = session.finish(600, true);
    expect(checkpoint.events[0]!.endMs).toBe(100);
    expect(saved.events[0]!.endMs).toBe(600);
    expect(saved.instrument.tuning[0]).toBe(28);
    expect(saved.instrument.name).toBe('4-string bass');
    expect(saved.status).toBe('interrupted');
  });

  it('handles empty sessions and a stop clock earlier than the last frame', () => {
    const empty = capture().finish(1000);
    expect(empty.durationMs).toBe(0);
    expect(sessionSummary(empty).percent).toBeNull();
    const session = capture();
    session.push(note(28), 1500);
    expect(session.finish(1400).durationMs).toBe(500);
  });
});
