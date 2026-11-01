import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotePlayer } from './NotePlayer';

function audioFixture() {
  const oscillators: {
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    type: string;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const gains: {
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    currentTime: 10,
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const oscillator = {
        frequency: { setValueAtTime: vi.fn() },
        type: '',
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
  };
  const constructor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal('AudioContext', constructor);
  return { context, constructor, oscillators, gains };
}

describe('Web Audio note player', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts only on play, schedules pitch/tempo and an envelope, then cleans up', async () => {
    const { context, constructor, oscillators, gains } = audioFixture();
    const player = new NotePlayer();
    const note = vi.fn();
    const complete = vi.fn();
    expect(constructor).not.toHaveBeenCalled();
    await player.play([69, 81], 120, note, complete);
    expect(context.resume).toHaveBeenCalledOnce();
    expect(oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(
      440,
      10.02,
    );
    expect(oscillators[1]!.frequency.setValueAtTime).toHaveBeenCalledWith(
      880,
      10.52,
    );
    expect(oscillators[0]!.start).toHaveBeenCalledWith(10.02);
    expect(gains[0]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0,
      10.445,
    );
    await vi.advanceTimersByTimeAsync(520);
    expect(note.mock.calls).toEqual([[69], [81]]);
    oscillators[0]!.onended!();
    expect(gains[0]!.disconnect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(500);
    expect(complete).toHaveBeenCalledOnce();
    expect(oscillators[1]!.disconnect).toHaveBeenCalled();
    player.dispose();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('cancels queued notes and callbacks on Stop and replaces playback without overlap', async () => {
    const { constructor, oscillators } = audioFixture();
    const player = new NotePlayer();
    const note = vi.fn();
    const complete = vi.fn();
    await player.play([28, 40], 60, note, complete);
    await player.play([43], 240, note, complete);
    expect(constructor).toHaveBeenCalledOnce();
    expect(oscillators[0]!.stop).toHaveBeenLastCalledWith();
    expect(oscillators[1]!.disconnect).toHaveBeenCalled();
    player.stop();
    await vi.runAllTimersAsync();
    expect(note).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    player.dispose();
  });

  it('cannot restart after Stop while resume is pending', async () => {
    const { context } = audioFixture();
    let resume!: () => void;
    context.resume.mockReturnValue(
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
    );
    const player = new NotePlayer();
    const playing = player.play([28], 90, vi.fn(), vi.fn());
    player.dispose();
    resume();
    await playing;
    expect(context.createOscillator).not.toHaveBeenCalled();
  });

  it('reports unsupported audio and failed or interrupted startup', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const player = new NotePlayer();
    await expect(player.play([28], 90, vi.fn(), vi.fn())).rejects.toThrow(
      'unavailable',
    );
    const { context } = audioFixture();
    context.state = 'suspended';
    await expect(player.play([28], 90, vi.fn(), vi.fn())).rejects.toThrow(
      'could not start',
    );
    context.resume.mockRejectedValue(new Error('Device unavailable'));
    await expect(player.play([28], 90, vi.fn(), vi.fn())).rejects.toThrow(
      'Device unavailable',
    );
    context.close.mockRejectedValue(new Error('Already closed'));
    player.dispose();
  });

  it.each([0, 39, 241, Number.NaN])(
    'rejects invalid tempo %s',
    async (tempo) => {
      await expect(
        new NotePlayer().play([28], tempo, vi.fn(), vi.fn()),
      ).rejects.toThrow(RangeError);
    },
  );
  it('rejects empty sequences before opening audio and safely disposes unused players', async () => {
    const { constructor } = audioFixture();
    const player = new NotePlayer();
    await expect(player.play([], 90, vi.fn(), vi.fn())).rejects.toThrow(
      RangeError,
    );
    player.dispose();
    expect(constructor).not.toHaveBeenCalled();
  });
});
