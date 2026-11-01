import { describe, expect, it } from 'vitest';
import {
  concat,
  fade,
  midiFrequency,
  silence,
  tone,
  whiteNoise,
  type Timbre,
} from '../../test/audioFixtures';
import { analysisWindowSize, detectPitch, rootMeanSquare } from './detector';
import {
  ANALYSIS_INTERVAL_MS,
  NoteStabilizer,
  type LiveReading,
  type PitchFrame,
} from './stabilizer';

const LOUD = 0.2;

/** A confident window at a fractional MIDI pitch. */
function heard(time: number, pitch: number, clarity = 0.97): PitchFrame {
  return {
    time,
    level: LOUD,
    estimate: { frequency: midiFrequency(pitch), clarity },
  };
}

function quiet(time: number): PitchFrame {
  return { time, level: 0.001, estimate: null };
}

function noisy(time: number): PitchFrame {
  return { time, level: LOUD, estimate: { frequency: 97, clarity: 0.3 } };
}

function summary(reading: LiveReading) {
  return reading.kind === 'note'
    ? `${reading.midi}${reading.cents >= 0 ? '+' : ''}${reading.cents}`
    : reading.kind;
}

describe('note stabilizer with controlled timestamps', () => {
  it('starts a note only after it persists across windows', () => {
    const stabilizer = new NoteStabilizer();
    expect(stabilizer.push(heard(0, 33)).kind).toBe('unclear');
    expect(stabilizer.push(heard(40, 33))).toEqual({
      kind: 'note',
      midi: 33,
      cents: 0,
      frequency: expect.closeTo(55, 6),
    });
  });

  it('reports silence and unclear sound separately, never as notes', () => {
    const stabilizer = new NoteStabilizer();
    expect(stabilizer.push(quiet(0))).toEqual({ kind: 'silent' });
    expect(stabilizer.push(noisy(40))).toEqual({ kind: 'unclear' });
    expect(stabilizer.push({ time: 80, level: LOUD, estimate: null })).toEqual({
      kind: 'unclear',
    });
    // Confident but outside the bass range.
    expect(stabilizer.push(heard(120, 20)).kind).toBe('unclear');
    expect(stabilizer.push(heard(160, 20)).kind).toBe('unclear');
    expect(stabilizer.push(heard(200, 80)).kind).toBe('unclear');
    expect(stabilizer.push(heard(240, 80)).kind).toBe('unclear');
  });

  it('ignores a single stray window, including an octave jump', () => {
    const stabilizer = new NoteStabilizer();
    const readings = [
      heard(0, 28),
      heard(40, 28),
      heard(80, 40), // one window an octave up
      heard(120, 28),
      noisy(160), // one unclear window
      heard(200, 28),
    ].map((frame) => summary(stabilizer.push(frame)));
    expect(readings).toEqual([
      'unclear',
      '28+0',
      '28+0',
      '28+0',
      '28+0',
      '28+0',
    ]);
  });

  it('needs an unbroken run to confirm a note', () => {
    const stabilizer = new NoteStabilizer();
    const readings = [
      heard(0, 40),
      noisy(40),
      heard(80, 40),
      heard(120, 40),
    ].map((frame) => summary(stabilizer.push(frame)));
    expect(readings).toEqual(['unclear', 'unclear', 'unclear', '40+0']);
  });

  it('holds a note near a semitone boundary, then moves once the next note persists', () => {
    const stabilizer = new NoteStabilizer();
    const readings = [
      heard(0, 33),
      heard(40, 33),
      heard(80, 33.55),
      heard(120, 33.65),
      heard(160, 33.8),
      heard(200, 33.8),
      heard(240, 33.8),
    ].map((frame) => summary(stabilizer.push(frame)));
    expect(readings).toEqual([
      'unclear',
      // Still A1: the tuning is the median of recent windows, so it drifts
      // sharp gradually instead of jumping.
      '33+0',
      '33+0',
      '33+27',
      // A#1 has to persist before it replaces A1.
      '33+27',
      '34-20',
      '34-20',
    ]);
  });

  it('smooths the tuning reading with the median of recent windows', () => {
    const stabilizer = new NoteStabilizer();
    const pitches = [45.1, 45.12, 45.3, 45.11, 45.09, 45.1];
    const readings = pitches.map((pitch, index) =>
      stabilizer.push(heard(index * 40, pitch)),
    );
    expect(readings.at(-1)).toMatchObject({ midi: 45, cents: 11 });
  });

  it('bridges short dropouts and ends a note after the release time', () => {
    const stabilizer = new NoteStabilizer();
    stabilizer.push(heard(0, 38));
    stabilizer.push(heard(40, 38));
    const readings = [quiet(80), quiet(120), quiet(160), quiet(200)].map(
      (frame) => summary(stabilizer.push(frame)),
    );
    // Last heard at 40 ms; the 120 ms release ends it at 160 ms.
    expect(readings).toEqual(['38+0', '38+0', 'silent', 'silent']);
  });

  it('keeps repeated notes separated by silence as separate notes', () => {
    const stabilizer = new NoteStabilizer();
    const frames = [
      heard(0, 43),
      heard(40, 43),
      heard(80, 43),
      quiet(120),
      quiet(160),
      quiet(200),
      quiet(240),
      heard(280, 43),
      heard(320, 43),
    ];
    expect(frames.map((frame) => summary(stabilizer.push(frame)))).toEqual([
      'unclear',
      '43+0',
      '43+0',
      '43+0',
      '43+0',
      'silent',
      'silent',
      'unclear',
      '43+0',
    ]);
  });

  it('lets a held note give way to unclear sound after the release time', () => {
    const stabilizer = new NoteStabilizer();
    stabilizer.push(heard(0, 50));
    stabilizer.push(heard(40, 50));
    // A different note still confirming keeps the held one briefly.
    expect(summary(stabilizer.push(heard(80, 55)))).toBe('50+0');
    expect(summary(stabilizer.push(noisy(200)))).toBe('unclear');
  });

  it('starts over after reset and accepts custom options', () => {
    const stabilizer = new NoteStabilizer({ confirmMs: 0, minClarity: 0.5 });
    stabilizer.push(heard(0, 30, 0.6));
    expect(summary(stabilizer.push(heard(1, 30, 0.6)))).toBe('30+0');
    stabilizer.reset();
    expect(stabilizer.push(heard(2, 30, 0.6)).kind).toBe('unclear');
  });
});

/** dBFS to RMS level. */
function dbfs(decibels: number) {
  return 10 ** (decibels / 20);
}

/** Room sound with no clear pitch at a given level. */
function room(time: number, decibels: number): PitchFrame {
  return {
    time,
    level: dbfs(decibels),
    estimate: { frequency: 97, clarity: 0.3 },
  };
}

function soft(time: number, pitch: number, decibels: number): PitchFrame {
  return { ...heard(time, pitch), level: dbfs(decibels) };
}

describe('adaptive silence gate', () => {
  it('starts 10 dB above an assumed −60 dBFS room and ignores digital silence', () => {
    const stabilizer = new NoteStabilizer();
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-50), 6);
    stabilizer.push({ time: 0, level: 0, estimate: null });
    stabilizer.push({ time: 40, level: 1e-6, estimate: null });
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-50), 6);
  });

  it('hears soft notes in a quiet room', () => {
    const stabilizer = new NoteStabilizer();
    // A quiet room sets the floor at −75 dBFS, so the gate drops to −65.
    stabilizer.push(room(0, -75));
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-65), 6);
    // −58 dBFS: well below the old fixed −48 dBFS gate.
    expect(stabilizer.push(soft(40, 28, -58)).kind).toBe('unclear');
    expect(stabilizer.push(soft(80, 28, -58))).toMatchObject({
      kind: 'note',
      midi: 28,
    });
    expect(stabilizer.push(room(400, -74))).toEqual({ kind: 'silent' });
  });

  it('never drops the gate below −70 dBFS', () => {
    const stabilizer = new NoteStabilizer();
    stabilizer.push(room(0, -88));
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-70), 6);
    expect(stabilizer.push(soft(40, 33, -72)).kind).toBe('silent');
  });

  it('raises the gate in a noisy room until steady noise reads as silence', () => {
    const stabilizer = new NoteStabilizer();
    const readings: string[] = [];
    // Ten seconds of −40 dBFS background noise with no clear pitch.
    for (let time = 0; time <= 10_000; time += 40) {
      readings.push(stabilizer.push(room(time, -40)).kind);
    }
    expect(readings[0]).toBe('unclear');
    expect(readings.at(-1)).toBe('silent');
    // The floor rises 3 dB per second from −60, so the gate passes the
    // noise after a little over 3 seconds.
    const cleared = readings.indexOf('silent') * 40;
    expect(cleared).toBeGreaterThan(3000);
    expect(cleared).toBeLessThan(4000);
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-30), 6);
    // Notes clearly above the noise still count.
    stabilizer.push(soft(10_040, 40, -20));
    expect(stabilizer.push(soft(10_080, 40, -20)).kind).toBe('note');
    // A quieter room lowers the floor at once.
    stabilizer.push(room(10_500, -70));
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-60), 6);
  });

  it('never lets long notes or busy playing raise the gate', () => {
    const stabilizer = new NoteStabilizer();
    stabilizer.push(room(0, -75));
    let reading: LiveReading = { kind: 'silent' };
    // Twenty seconds of soft notes with no rests.
    for (let time = 40; time <= 20_000; time += 40) {
      reading = stabilizer.push(
        soft(time, 28 + (Math.floor(time / 500) % 5), -55),
      );
    }
    expect(reading.kind).toBe('note');
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-65), 6);
  });

  it('measures the room again after reset', () => {
    const stabilizer = new NoteStabilizer();
    stabilizer.push(room(0, -80));
    stabilizer.reset();
    expect(stabilizer.silenceLevel).toBeCloseTo(dbfs(-50), 6);
  });
});

/**
 * Runs the detector and stabilizer like the live app: a window every
 * ANALYSIS_INTERVAL_MS, each ending at that moment. Stops early once
 * `until` matches, since each window costs a full detector run.
 */
function listen(
  signal: Float32Array,
  sampleRate: number,
  until: (time: number, reading: LiveReading) => boolean = () => false,
) {
  const size = analysisWindowSize(sampleRate);
  const stabilizer = new NoteStabilizer();
  const readings: { time: number; reading: LiveReading }[] = [];
  for (
    let time = ANALYSIS_INTERVAL_MS;
    (time * sampleRate) / 1000 <= signal.length;
    time += ANALYSIS_INTERVAL_MS
  ) {
    const end = Math.floor((time * sampleRate) / 1000);
    const window = new Float32Array(size);
    const available = signal.subarray(Math.max(0, end - size), end);
    window.set(available, size - available.length);
    const level = rootMeanSquare(window);
    const reading = stabilizer.push({
      time,
      level,
      estimate: level > 0 ? detectPitch(window, sampleRate) : null,
    });
    readings.push({ time, reading });
    if (until(time, reading)) break;
  }
  return readings;
}

function note(
  midi: number,
  ms: number,
  sampleRate: number,
  timbre: Timbre = 'bass',
  options: { decay?: number; seed?: number } = {},
) {
  return fade(
    tone({
      frequency: midiFrequency(midi),
      sampleRate,
      length: Math.round((ms * sampleRate) / 1000),
      timbre,
      ...options,
    }),
    sampleRate,
  );
}

function gap(ms: number, sampleRate: number) {
  return silence(Math.round((ms * sampleRate) / 1000));
}

function firstNoteTime(
  readings: ReturnType<typeof listen>,
  midi: number,
  after: number,
) {
  return readings.find(
    ({ time, reading }) =>
      time > after && reading.kind === 'note' && reading.midi === midi,
  )?.time;
}

// Every window runs the real detector, which coverage instrumentation slows
// several times over; give slower CI runners room.
describe(
  'detector and stabilizer on deterministic recordings',
  { timeout: 20_000 },
  () => {
    it.each([44100, 48000])(
      'shows a clean note within the latency target at %i Hz',
      (sampleRate) => {
        for (const [midi, target] of [
          [28, 200], // E1
          [33, 150], // A1
          [40, 150], // E2
          [55, 150], // G3
        ] as const) {
          const signal = concat(
            gap(500, sampleRate),
            note(midi, 400, sampleRate),
          );
          const readings = listen(
            signal,
            sampleRate,
            (_, reading) => reading.kind === 'note',
          );
          const shown = firstNoteTime(readings, midi, 500);
          expect(shown! - 500, `MIDI ${midi}`).toBeLessThanOrEqual(target);
        }
      },
    );

    it('hears a softly plucked note over quiet room noise', () => {
      const sampleRate = 48000;
      const length = (ms: number) => Math.round((ms * sampleRate) / 1000);
      // Room noise around −75 dBFS RMS (uniform noise RMS is peak/√3).
      const roomNoise = whiteNoise(length(1200), dbfs(-75) * Math.sqrt(3), 4);
      const pluck = note(28, 700, sampleRate, 'phone', { decay: 1 });
      const scale = dbfs(-58) / rootMeanSquare(pluck.subarray(0, length(100)));
      const signal = roomNoise.map((sample, index) => {
        const at = index - length(500);
        return sample + (at >= 0 && at < pluck.length ? pluck[at]! * scale : 0);
      });
      // Quieter than the old fixed −48 dBFS gate.
      expect(
        rootMeanSquare(signal.subarray(length(500), length(600))),
      ).toBeLessThan(0.004);
      const readings = listen(signal, sampleRate);
      expect(
        readings
          .filter(({ time }) => time < 500)
          .every(({ reading }) => reading.kind === 'silent'),
      ).toBe(true);
      expect(firstNoteTime(readings, 28, 500)! - 500).toBeLessThanOrEqual(200);
    });

    it('turns a sustained, decaying note into one steady reading', () => {
      const sampleRate = 48000;
      const signal = concat(
        gap(300, sampleRate),
        note(28, 1200, sampleRate, 'phone', { decay: 2 }),
        gap(400, sampleRate),
      );
      const readings = listen(signal, sampleRate).map(({ reading }) =>
        reading.kind === 'note' ? reading.midi : reading.kind,
      );
      const notes = readings.filter((value) => typeof value === 'number');
      expect(new Set(notes)).toEqual(new Set([28]));
      // Silence, a short confirmation, one unbroken note, then silence again.
      const changes = readings.filter(
        (value, index) => index === 0 || value !== readings[index - 1],
      );
      expect(changes).toEqual(['silent', 'unclear', 28, 'silent']);
    });

    it('keeps two plucks of the same note apart when silence separates them', () => {
      const sampleRate = 44100;
      const signal = concat(
        gap(200, sampleRate),
        note(33, 600, sampleRate),
        gap(300, sampleRate),
        note(33, 600, sampleRate, 'bass', { seed: 9 }),
        gap(300, sampleRate),
      );
      const kinds = listen(signal, sampleRate).map(({ reading }) =>
        reading.kind === 'note' ? 'A1' : reading.kind,
      );
      const runs = kinds.filter(
        (value, index) => index === 0 || value !== kinds[index - 1],
      );
      expect(runs.filter((value) => value === 'A1')).toHaveLength(2);
      expect(runs).toContain('silent');
    });

    it('follows a melody and never reports silence or noise as a note', () => {
      const sampleRate = 48000;
      const melody = [28, 31, 33, 35, 38];
      const step = 300 + 150;
      const signal = concat(
        ...melody.flatMap((midi) => [
          note(midi, 300, sampleRate, 'phone'),
          gap(150, sampleRate),
        ]),
        whiteNoise(Math.round(sampleRate * 0.3), 0.05),
      );
      const readings = listen(signal, sampleRate);
      const heardNotes = readings
        .map(({ reading }) => (reading.kind === 'note' ? reading.midi : null))
        .filter((midi, index, all) => midi !== null && midi !== all[index - 1]);
      expect(heardNotes).toEqual(melody);
      // The trailing noise is loud, but unclear rather than a wrong note.
      // Skip the first windows, which still hold the last gap's silence.
      const noiseStart = melody.length * step;
      const noise = readings.filter(({ time }) => time > noiseStart + 100);
      expect(noise.length).toBeGreaterThan(3);
      expect(noise.every(({ reading }) => reading.kind === 'unclear')).toBe(
        true,
      );
    });
  },
);
