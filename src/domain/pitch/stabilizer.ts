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
  /** RMS level below which a window counts as silence (0.004 ≈ −48 dBFS). */
  silenceLevel: number;
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
  silenceLevel: 0.004,
  minClarity: 0.8,
  confirmMs: 40,
  releaseMs: 120,
  hysteresisCents: 20,
  range: BASS_RANGE,
};

/** Recent windows averaged (by median) for the displayed tuning. */
const TUNING_WINDOWS = 5;

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
 * `releaseMs`, and resists flicker near semitone boundaries. Pure and
 * deterministic: feed it frames with controlled timestamps to test it.
 */
export class NoteStabilizer {
  private readonly options: StabilizerOptions;
  private held: HeldNote | null = null;
  private candidate: Candidate | null = null;

  constructor(options: Partial<StabilizerOptions> = {}) {
    this.options = { ...DEFAULT_STABILIZER_OPTIONS, ...options };
  }

  push({ time, level, estimate }: PitchFrame): LiveReading {
    const { silenceLevel, minClarity, confirmMs, range } = this.options;
    if (level < silenceLevel) return this.drop(time, 'silent');
    if (
      !estimate ||
      estimate.clarity < minClarity ||
      estimate.frequency < range.minFrequency ||
      estimate.frequency > range.maxFrequency
    ) {
      return this.drop(time, 'unclear');
    }

    const pitch = frequencyToMidi(estimate.frequency);
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
