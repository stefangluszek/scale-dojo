import { act } from '@testing-library/react';
import { vi } from 'vitest';
import {
  MicrophoneInput,
  type MicrophoneCallbacks,
  type MicrophoneDetails,
} from '../platform/audio/MicrophoneInput';
import { midiFrequency, tone, whiteNoise, silence } from './audioFixtures';

export const SAMPLE_RATE = 48000;
export const WINDOW = 4096;

/**
 * Replaces microphone acquisition with a controllable fake: grant or refuse
 * permission, then feed deterministic sample windows through the real pitch
 * detector and stabilizer.
 */
export function fakeMicrophone() {
  let callbacks: MicrophoneCallbacks | undefined;
  let settle!: {
    resolve: (details: MicrophoneDetails | null) => void;
    reject: (cause: unknown) => void;
  };
  let clock = 0;
  const start = vi
    .spyOn(MicrophoneInput.prototype, 'start')
    .mockImplementation((handlers) => {
      callbacks = handlers;
      return new Promise((resolve, reject) => {
        settle = { resolve, reject };
      });
    });
  const stop = vi.spyOn(MicrophoneInput.prototype, 'stop');

  function feed(samples: Float32Array, frames: number) {
    for (let frame = 0; frame < frames; frame += 1) {
      clock = Math.max(clock, performance.now()) + 40;
      act(() =>
        callbacks!.onFrame({ time: clock, samples, sampleRate: SAMPLE_RATE }),
      );
    }
  }

  return {
    start,
    stop,
    grant: (details: Partial<MicrophoneDetails> = {}) =>
      act(async () =>
        settle.resolve({ sampleRate: SAMPLE_RATE, processing: [], ...details }),
      ),
    cancel: () => act(async () => settle.resolve(null)),
    refuse: (cause: unknown) => act(async () => settle.reject(cause)),
    /** A note held for a few analysis windows. */
    hear: (midi: number, cents = 0, frames = 3) =>
      feed(
        tone({
          frequency: midiFrequency(midi, cents),
          sampleRate: SAMPLE_RATE,
          length: WINDOW,
          seed: midi,
        }),
        frames,
      ),
    /** A softly plucked note over quiet room noise. */
    hearSoftly: (midi: number, frames = 3) =>
      feed(
        tone({
          frequency: midiFrequency(midi),
          sampleRate: SAMPLE_RATE,
          length: WINDOW,
          amplitude: 0.004,
          noise: 0.0003,
          seed: midi,
        }),
        frames,
      ),
    /** Quiet room noise, about −75 dBFS. */
    room: (frames = 3) => feed(whiteNoise(WINDOW, 0.0003), frames),
    quiet: (frames = 5) => feed(silence(WINDOW), frames),
    noise: (frames = 5) => feed(whiteNoise(WINDOW, 0.2), frames),
    lose: () => act(() => callbacks!.onEnded()),
  };
}
