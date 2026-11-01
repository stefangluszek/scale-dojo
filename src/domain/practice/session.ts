import type { FrettedInstrument } from '../instruments/fretted';
import { isNoteInScale, type PitchClass, type ScaleId } from '../music/scales';
import type { LiveReading } from '../pitch/stabilizer';

export interface SessionContext {
  root: PitchClass;
  scaleId: ScaleId;
  instrument: FrettedInstrument;
}

export interface NoteEvent {
  /** Milliseconds since capture began, on the analysis clock. */
  startMs: number;
  endMs: number;
  midi: number;
}

export interface PracticeSession extends SessionContext {
  id: string;
  /** Wall-clock time for the history label; event timing uses a monotonic clock. */
  startedAt: number;
  durationMs: number;
  status: 'recording' | 'completed' | 'interrupted';
  events: NoteEvent[];
}

/** Stable readings become note spans, never one event per analysis frame. */
export class SessionCapture {
  private session: PracticeSession;
  private active: NoteEvent | null = null;
  private elapsed = 0;

  constructor(
    context: SessionContext,
    private readonly origin: number,
    startedAt: number,
    id: string,
  ) {
    this.session = {
      ...context,
      instrument: {
        ...context.instrument,
        tuning: [...context.instrument.tuning],
      },
      id,
      startedAt,
      durationMs: 0,
      status: 'recording',
      events: [],
    };
  }

  private advance(time: number) {
    this.elapsed = Math.max(this.elapsed, Math.round(time - this.origin));
    if (this.active) this.active.endMs = this.elapsed;
    this.session.durationMs = this.elapsed;
  }

  /** Returns true on a note boundary so the UI can update immediately. */
  push(reading: LiveReading, time: number): boolean {
    this.advance(time);
    if (reading.kind === 'note' && this.active?.midi === reading.midi)
      return false;
    const hadNote = this.active !== null;
    this.active = null;
    if (reading.kind === 'note') {
      this.active = {
        startMs: this.elapsed,
        endMs: this.elapsed,
        midi: reading.midi,
      };
      this.session.events.push(this.active);
      return true;
    }
    return hadNote;
  }

  snapshot(): PracticeSession {
    return {
      ...this.session,
      events: this.session.events.map((event) => ({ ...event })),
    };
  }

  finish(time: number, interrupted = false): PracticeSession {
    this.advance(time);
    this.active = null;
    this.session.status = interrupted ? 'interrupted' : 'completed';
    return this.snapshot();
  }
}

export function sessionSummary(session: PracticeSession) {
  const total = session.events.length;
  const inScale = session.events.filter((event) =>
    isNoteInScale(event.midi, session.root, session.scaleId),
  ).length;
  return {
    total,
    inScale,
    outside: total - inScale,
    percent: total ? Math.round((inScale / total) * 100) : null,
  };
}
