import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPitch, rootMeanSquare } from '../../domain/pitch/detector';
import {
  NoteStabilizer,
  type LiveReading,
} from '../../domain/pitch/stabilizer';
import {
  MicrophoneError,
  MicrophoneInput,
  type AudioFrame,
  type MicrophoneProblem,
  type VoiceProcessing,
} from '../../platform/audio/MicrophoneInput';

export type ListenStatus = 'idle' | 'starting' | 'listening';

/** Why listening isn't running: a start-up problem or a lost device. */
export type ListenProblem = MicrophoneProblem | 'device-lost';

export interface LiveListening {
  status: ListenStatus;
  /** Always silent while not listening. */
  reading: LiveReading;
  /** Input level for a meter, from 0 (−80 dBFS or quieter) to 1 (0 dBFS). */
  level: number;
  /** The silence gate on the same scale: quieter input counts as silence. */
  gate: number;
  problem: ListenProblem | null;
  /** Listening stopped because the page was hidden. */
  paused: boolean;
  /** Voice processing the browser kept on. */
  processing: readonly VoiceProcessing[];
  /** Call from a user action, such as a click. */
  start: () => void;
  stop: () => void;
}

const SILENT: LiveReading = { kind: 'silent' };

function sameReading(a: LiveReading, b: LiveReading): boolean {
  if (a.kind !== 'note' || b.kind !== 'note') return a.kind === b.kind;
  return a.midi === b.midi && a.cents === b.cents;
}

/**
 * −80 to 0 dBFS mapped onto 0–1 in 2% steps, so tiny changes don't
 * re-render.
 */
function meterLevel(rms: number): number {
  const decibels = 20 * Math.log10(Math.max(rms, 1e-6));
  const level = Math.min(1, Math.max(0, (decibels + 80) / 80));
  return Math.round(level * 50) / 50;
}

/**
 * Live note feedback: microphone frames → pitch estimates → a stable
 * reading. Owns the listening lifecycle, including permission problems,
 * device loss, hidden pages and unmount cleanup.
 */
export function useLiveNote(
  observers: {
    onReading?: (reading: LiveReading, time: number) => void;
    onReady?: () => void;
    onStop?: (interrupted: boolean) => void;
  } = {},
): LiveListening {
  const observer = useRef(observers);
  observer.current = observers;
  const input = useRef<MicrophoneInput | null>(null);
  const stabilizer = useRef<NoteStabilizer | null>(null);
  const active = useRef(false);
  const [status, setStatus] = useState<ListenStatus>('idle');
  const [reading, setReading] = useState<LiveReading>(SILENT);
  const [level, setLevel] = useState(0);
  const [gate, setGate] = useState(0);
  const [problem, setProblem] = useState<ListenProblem | null>(null);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState<readonly VoiceProcessing[]>([]);

  const settle = useCallback((interrupted = false) => {
    active.current = false;
    stabilizer.current?.reset();
    setStatus('idle');
    setReading(SILENT);
    setLevel(0);
    observer.current.onStop?.(interrupted);
  }, []);

  const stop = useCallback(() => {
    input.current?.stop();
    settle();
  }, [settle]);

  const onFrame = useCallback(({ time, samples, sampleRate }: AudioFrame) => {
    if (!active.current) return;
    const rms = rootMeanSquare(samples);
    const notes = stabilizer.current!;
    // Skip the detector on silence; the stabilizer would discard it anyway.
    const estimate =
      rms >= notes.silenceLevel ? detectPitch(samples, sampleRate) : null;
    const next = notes.push({ time, level: rms, estimate });
    observer.current.onReading?.(next, time);
    setReading((current) => (sameReading(current, next) ? current : next));
    setLevel(meterLevel(rms));
    setGate(meterLevel(notes.silenceLevel));
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && active.current) {
        input.current?.stop();
        settle(true);
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const onPageHide = () => {
      input.current?.stop();
      settle(true);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      active.current = false;
      input.current?.stop();
      observer.current.onStop?.(true);
    };
  }, [settle]);

  const start = () => {
    active.current = true;
    setProblem(null);
    setPaused(false);
    setProcessing([]);
    setStatus('starting');
    stabilizer.current ??= new NoteStabilizer();
    stabilizer.current.reset();
    input.current ??= new MicrophoneInput();
    // Called synchronously, so audio starts within the user's action.
    input.current
      .start({
        onFrame,
        onEnded: () => {
          settle(true);
          setProblem('device-lost');
        },
      })
      .then(
        (details) => {
          // Null means Stop came first.
          if (!details) return;
          setProcessing(details.processing);
          observer.current.onReady?.();
          setStatus('listening');
        },
        (cause: unknown) => {
          settle();
          setProblem(
            cause instanceof MicrophoneError ? cause.problem : 'failed',
          );
        },
      );
  };

  return {
    status,
    reading,
    level,
    gate,
    problem,
    paused,
    processing,
    start,
    stop,
  };
}
