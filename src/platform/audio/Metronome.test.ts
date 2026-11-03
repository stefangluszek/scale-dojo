import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Metronome } from './Metronome';

function audioFixture() {
  const epoch = Date.now();
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
    get currentTime() {
      return 10 + (Date.now() - epoch) / 1000;
    },
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

describe('metronome audio', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates audio only on start and keeps steady beats on the audio clock', async () => {
    const { constructor, context, oscillators, gains } = audioFixture();
    const player = new Metronome();
    player.setTempo(120);
    expect(constructor).not.toHaveBeenCalled();
    await player.start(120);
    await vi.advanceTimersByTimeAsync(2000);
    expect(context.resume).toHaveBeenCalledOnce();
    expect(oscillators).toHaveLength(5);
    oscillators.forEach((oscillator, index) => {
      expect(oscillator.start).toHaveBeenCalledWith(10.02 + index * 0.5);
      expect(oscillator.stop).toHaveBeenCalledWith(
        expect.closeTo(10.06 + index * 0.5),
      );
    });
    expect(gains[0]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0,
      expect.closeTo(10.06),
    );
    oscillators[0]!.onended!();
    expect(oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    expect(gains[0]!.disconnect).toHaveBeenCalledOnce();
    player.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('updates tempo while running without opening another context or restarting the beat', async () => {
    const { constructor, oscillators } = audioFixture();
    const player = new Metronome();
    await player.start(60);
    await vi.advanceTimersByTimeAsync(300);
    player.setTempo(120);
    await vi.advanceTimersByTimeAsync(700);
    expect(oscillators.map((voice) => voice.start.mock.calls[0]![0])).toEqual([
      10.02, 10.52, 11.02,
    ]);
    expect(constructor).toHaveBeenCalledOnce();
    player.dispose();
  });

  it('skips missed beats after a stall instead of queuing a burst', async () => {
    const { oscillators } = audioFixture();
    const player = new Metronome();
    await player.start(240);
    vi.setSystemTime(Date.now() + 5000);
    await vi.advanceTimersByTimeAsync(25);
    expect(oscillators).toHaveLength(2);
    expect(oscillators[1]!.start.mock.calls[0]![0]).toBeCloseTo(15.045);
    player.dispose();
  });

  it('cancels queued clicks on stop and reuses the context for a fresh start', async () => {
    const { constructor, oscillators, gains } = audioFixture();
    const player = new Metronome();
    await player.start(120);
    player.stop();
    expect(oscillators[0]!.stop).toHaveBeenLastCalledWith();
    expect(oscillators[0]!.onended).toBeNull();
    expect(gains[0]!.disconnect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2000);
    expect(oscillators).toHaveLength(1);
    await player.start(60);
    expect(oscillators).toHaveLength(2);
    expect(constructor).toHaveBeenCalledOnce();
    player.dispose();
  });

  it('does not restart if disposed while audio resume is pending', async () => {
    const { context, oscillators } = audioFixture();
    let resume!: () => void;
    context.resume.mockReturnValue(
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
    );
    const player = new Metronome();
    const starting = player.start(90);
    player.dispose();
    resume();
    await starting;
    expect(oscillators).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports unavailable audio and failed startup', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const player = new Metronome();
    await expect(player.start(90)).rejects.toThrow('unavailable');
    const { context } = audioFixture();
    context.state = 'suspended';
    await expect(player.start(90)).rejects.toThrow('could not start');
    context.resume.mockRejectedValue(new Error('Device unavailable'));
    await expect(player.start(90)).rejects.toThrow('Device unavailable');
    context.close.mockRejectedValue(new Error('Already closed'));
    player.dispose();
  });

  it.each([0, 39, 241, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid tempo %s before creating audio',
    async (tempo) => {
      const { constructor } = audioFixture();
      const player = new Metronome();
      await expect(player.start(tempo)).rejects.toThrow(RangeError);
      expect(constructor).not.toHaveBeenCalled();
      player.dispose();
    },
  );
});
