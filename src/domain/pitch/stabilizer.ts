import { BASS_RANGE, type PitchEstimate, type PitchRange } from './detector';
import { frequencyToMidi } from './notes';

/** How often the live pipeline analyses a window, in milliseconds. */
export const ANALYSIS_INTERVAL_MS = 40;

/** One analysed window: when it ended, how loud it was, and its pitch. */
export interface PitchFrame {
  /** Milliseconds on any steadily increasing clock. */
  time: number;
  /** Root mean square level, 0 to 1. */
  level: number;
  /** The detector's result, or null when it found no repeating shape. */
  estimate: PitchEstimate | null;
}

/**
 * What the player is doing right now. Silence and unclear sound are kept
 * apart from notes, so neither is ever reported as a wrong note.
 */
export type LiveReading =
  | { kind: 'silent' }
  | { kind: 'unclear' }
  | {
      kind: 'note';
      /** The nearest note, with octave. */
      midi: number;
      /**
       * Tuning deviation from that note in cents: within ±50, or up to ±70
       * while a held note drifts toward its neighbour.
       */
      cents: number;
      frequency: number;
    };

export interface StabilizerOptions {
  /**
   * The silence gate never drops below this RMS level, however quiet the
   * room (−70 dBFS).
   */
  minSilenceLevel: number;
  /**
   * Assumed room noise before any is measured (0.001 ≈ −60 dBFS). A quieter
   * window replaces it straight away.
   */
  initialNoiseFloor: number;
  /** How far above the room's noise floor sound has to be, in dB. */
  gateAboveNoiseDb: number;
  /**
   * How fast the noise floor estimate may rise while no note is heard, in
   * dB per second. It falls at once when a window is quieter.
   */
  noiseFloorRiseDbPerSecond: number;
  /** Clarity a window needs before its pitch is trusted. */
  minClarity: number;
  /** How long a new note must persist, across two or more windows. */
  confirmMs: number;
  /** How long a note survives dropouts or silence before it ends. */
  releaseMs: number;
  /**
   * Extra room beyond ±50 cents before a held note gives way, so a note
   * played between two semitones doesn't flicker.
   */
  hysteresisCents: number;
  /** Frequencies outside this range are treated as unclear. */
  range: PitchRange;
}

export const DEFAULT_STABILIZER_OPTIONS: StabilizerOptions = {
  minSilenceLevel: 10 ** (-70 / 20),
  initialNoiseFloor: 0.001,
  gateAboveNoiseDb: 10,
  noiseFloorRiseDbPerSecond: 3,
  minClarity: 0.8,
  confirmMs: 40,
  releaseMs: 120,
  hysteresisCents: 20,
  range: BASS_RANGE,
};

/** Recent windows averaged (by median) for the displayed tuning. */
const TUNING_WINDOWS = 5;

/**
 * Windows quieter than this (−90 dBFS) are digital silence, such as a muted
 * input or a stream that hasn't started, not the sound of a room.
 */
const DIGITAL_SILENCE_DB = -90;

function decibels(level: number): number {
  return 20 * Math.log10(Math.max(level, 1e-12));
}

interface HeldNote {
  midi: number;
  pitches: number[];
  lastSeen: number;
}

interface Candidate {
  midi: number;
  since: number;
  pitches: number[];
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Turns per-window pitch estimates into a steady current note. A note
 * starts only after it persists for `confirmMs`, survives brief dropouts for
 * `releaseMs`, and resists flicker near semitone boundaries.
 *
 * The silence gate follows the room: it sits `gateAboveNoiseDb` above a
 * running estimate of the noise floor, so soft notes count in a quiet room
 * and steady background noise reads as silence in a loud one. Pure and
 * deterministic: feed it frames with controlled timestamps to test it.
 */
export class NoteStabilizer {
  private readonly options: StabilizerOptions;
  private held: HeldNote | null = null;
  private candidate: Candidate | null = null;
  private noiseFloorDb: number;
  private lastTime: number | null = null;

  constructor(options: Partial<StabilizerOptions> = {}) {
    this.options = { ...DEFAULT_STABILIZER_OPTIONS, ...options };
    this.noiseFloorDb = decibels(this.options.initialNoiseFloor);
  }

  /** RMS level a window needs right now to count as sound. */
  get silenceLevel(): number {
    const { minSilenceLevel, gateAboveNoiseDb } = this.options;
    return Math.max(
      minSilenceLevel,
      10 ** ((this.noiseFloorDb + gateAboveNoiseDb) / 20),
    );
  }

  push(frame: PitchFrame): LiveReading {
    const { time, level, estimate } = frame;
    const { minClarity, range } = this.options;
    // Judge the window against the gate before it updates the noise floor.
    const silent = level < this.silenceLevel;
    const trusted =
      !silent &&
      estimate !== null &&
      estimate.clarity >= minClarity &&
      estimate.frequency >= range.minFrequency &&
      estimate.frequency <= range.maxFrequency;
    this.trackNoiseFloor(time, level, trusted);
    if (silent) return this.drop(time, 'silent');
    if (!trusted) return this.drop(time, 'unclear');
    return this.hear(time, estimate!.frequency);
  }

  private trackNoiseFloor(time: number, level: number, note: boolean) {
    const elapsed =
      this.lastTime === null ? 0 : Math.max(0, time - this.lastTime) / 1000;
    this.lastTime = time;
    const levelDb = decibels(level);
    if (levelDb < DIGITAL_SILENCE_DB) return;
    if (levelDb < this.noiseFloorDb) {
      this.noiseFloorDb = levelDb;
    } else if (!note) {
      // Notes never raise the floor, so long notes and busy playing can't
      // gate themselves out.
      this.noiseFloorDb = Math.min(
        levelDb,
        this.noiseFloorDb + this.options.noiseFloorRiseDbPerSecond * elapsed,
      );
    }
  }

  private hear(time: number, frequency: number): LiveReading {
    const { confirmMs } = this.options;

    const pitch = frequencyToMidi(frequency);
    const held = this.held;
    const reach = 0.5 + this.options.hysteresisCents / 100;
    if (held && Math.abs(pitch - held.midi) <= reach) {
      held.pitches = [...held.pitches, pitch].slice(-TUNING_WINDOWS);
      held.lastSeen = time;
      this.candidate = null;
      return this.reading();
    }

    const midi = Math.round(pitch);
    if (this.candidate?.midi === midi) {
      this.candidate.pitches.push(pitch);
    } else {
      this.candidate = { midi, since: time, pitches: [pitch] };
    }
    const candidate = this.candidate;
    if (candidate.pitches.length >= 2 && time - candidate.since >= confirmMs) {
      this.held = {
        midi,
        pitches: candidate.pitches.slice(-TUNING_WINDOWS),
        lastSeen: time,
      };
      this.candidate = null;
      return this.reading();
    }
    // A different note is still being confirmed: keep showing the held one
    // for now rather than flickering.
    return this.drop(time, 'unclear', false);
  }

  /** Forget everything, for example when listening stops. */
  reset(): void {
    this.held = null;
    this.candidate = null;
    this.noiseFloorDb = decibels(this.options.initialNoiseFloor);
    this.lastTime = null;
  }

  private drop(
    time: number,
    kind: 'silent' | 'unclear',
    breakCandidate = true,
  ): LiveReading {
    if (breakCandidate) this.candidate = null;
    if (this.held && time - this.held.lastSeen < this.options.releaseMs) {
      return this.reading();
    }
    this.held = null;
    return { kind };
  }

  private reading(): LiveReading {
    const held = this.held!;
    const pitch = median(held.pitches);
    return {
      kind: 'note',
      midi: held.midi,
      cents: Math.round((pitch - held.midi) * 100) || 0,
      frequency: 440 * 2 ** ((pitch - 69) / 12),
    };
  }
}
