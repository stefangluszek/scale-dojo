import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MicrophoneError, MicrophoneInput } from './MicrophoneInput';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function namedError(name: string) {
  return Object.assign(new Error(`${name} message`), { name });
}

function microphoneFixture({
  settings = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  } as MediaTrackSettings,
  contextState = 'running',
  tracks = 1,
} = {}) {
  const track = Object.assign(new EventTarget(), {
    kind: 'audio',
    readyState: 'live' as MediaStreamTrackState,
    stop: vi.fn(function (this: { readyState: string }) {
      this.readyState = 'ended';
    }),
    getSettings: vi.fn(() => settings),
  });
  const audioTracks = tracks ? [track] : [];
  const stream = {
    getTracks: () => audioTracks,
    getAudioTracks: () => audioTracks,
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = {
    fftSize: 2048,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn((target: Float32Array) => target.fill(0.25)),
  };
  const context = {
    state: contextState,
    sampleRate: 48000,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createMediaStreamSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
  };
  const AudioContextStub = vi.fn(function () {
    return context;
  });
  const permission = deferred<typeof stream>();
  const getUserMedia = vi.fn(() => permission.promise);
  vi.stubGlobal('AudioContext', AudioContextStub);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
  return {
    track,
    stream,
    source,
    analyser,
    context,
    AudioContextStub,
    getUserMedia,
    permission,
    grant: () => permission.resolve(stream),
  };
}

function callbacks() {
  return { onFrame: vi.fn(), onEnded: vi.fn() };
}

describe('microphone input', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('reports unsupported browsers and insecure pages without asking for permission', async () => {
    const input = new MicrophoneInput();
    await expect(input.start(callbacks())).rejects.toMatchObject({
      problem: 'unsupported',
    });

    const { getUserMedia, AudioContextStub } = microphoneFixture();
    vi.stubGlobal('AudioContext', undefined);
    await expect(input.start(callbacks())).rejects.toMatchObject({
      problem: 'unsupported',
    });

    vi.stubGlobal('AudioContext', AudioContextStub);
    vi.stubGlobal('isSecureContext', false);
    const error = await input.start(callbacks()).catch((cause) => cause);
    expect(error).toBeInstanceOf(MicrophoneError);
    expect(error.problem).toBe('insecure');
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(AudioContextStub).not.toHaveBeenCalled();
  });

  it('starts audio within the user action, asks for unprocessed input and streams windows', async () => {
    const fixture = microphoneFixture();
    const input = new MicrophoneInput();
    const handlers = callbacks();
    const starting = input.start(handlers);
    // The context exists and is resuming before the permission prompt resolves.
    expect(fixture.AudioContextStub).toHaveBeenCalledOnce();
    expect(fixture.context.resume).toHaveBeenCalledOnce();
    expect(fixture.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    });
    fixture.grant();
    await expect(starting).resolves.toEqual({
      sampleRate: 48000,
      processing: [],
    });
    expect(fixture.analyser.fftSize).toBe(4096);
    expect(fixture.source.connect).toHaveBeenCalledWith(fixture.analyser);

    vi.advanceTimersByTime(40);
    expect(handlers.onFrame).toHaveBeenCalledOnce();
    const frame = handlers.onFrame.mock.calls[0]![0];
    expect(frame.sampleRate).toBe(48000);
    expect(frame.samples).toHaveLength(4096);
    expect(frame.samples[0]).toBe(0.25);
    vi.advanceTimersByTime(80);
    expect(handlers.onFrame).toHaveBeenCalledTimes(3);
  });

  it('names voice processing the browser kept on', async () => {
    const fixture = microphoneFixture({
      settings: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const starting = new MicrophoneInput().start(callbacks());
    fixture.grant();
    await expect(starting).resolves.toMatchObject({
      processing: [
        'echo cancellation',
        'noise suppression',
        'automatic gain control',
      ],
    });
  });

  it('releases the device, audio nodes and context on stop', async () => {
    const fixture = microphoneFixture();
    const input = new MicrophoneInput();
    const handlers = callbacks();
    const starting = input.start(handlers);
    fixture.grant();
    await starting;
    input.stop();
    expect(fixture.track.stop).toHaveBeenCalledOnce();
    expect(fixture.track.readyState).toBe('ended');
    expect(fixture.source.disconnect).toHaveBeenCalledOnce();
    expect(fixture.analyser.disconnect).toHaveBeenCalledOnce();
    expect(fixture.context.close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(200);
    expect(handlers.onFrame).not.toHaveBeenCalled();
    // Ending the track after Stop is not a device loss.
    fixture.track.dispatchEvent(new Event('ended'));
    expect(handlers.onEnded).not.toHaveBeenCalled();
    input.stop();
    expect(fixture.context.close).toHaveBeenCalledOnce();
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'no-input'],
    ['OverconstrainedError', 'no-input'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['TypeError', 'failed'],
  ])('maps %s to a %s problem and closes audio', async (name, problem) => {
    const fixture = microphoneFixture();
    const starting = new MicrophoneInput().start(callbacks());
    fixture.permission.reject(namedError(name));
    await expect(starting).rejects.toMatchObject({
      problem,
      message: `${name} message`,
    });
    expect(fixture.context.close).toHaveBeenCalledOnce();
  });

  it('treats non-error rejections as failures', async () => {
    const fixture = microphoneFixture();
    const starting = new MicrophoneInput().start(callbacks());
    fixture.permission.reject('nope');
    await expect(starting).rejects.toMatchObject({
      problem: 'failed',
      message: 'failed',
    });
  });

  it('cancels a pending permission request on stop and releases a late grant', async () => {
    const fixture = microphoneFixture();
    const input = new MicrophoneInput();
    const handlers = callbacks();
    const starting = input.start(handlers);
    input.stop();
    fixture.grant();
    await expect(starting).resolves.toBeNull();
    expect(fixture.track.stop).toHaveBeenCalledOnce();
    expect(fixture.context.close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(200);
    expect(handlers.onFrame).not.toHaveBeenCalled();
  });

  it('ignores a late refusal after stop', async () => {
    const fixture = microphoneFixture();
    const input = new MicrophoneInput();
    const starting = input.start(callbacks());
    input.stop();
    fixture.permission.reject(namedError('NotAllowedError'));
    await expect(starting).resolves.toBeNull();
  });

  it('reports device loss once and releases everything', async () => {
    const fixture = microphoneFixture();
    const input = new MicrophoneInput();
    const handlers = callbacks();
    const starting = input.start(handlers);
    fixture.grant();
    await starting;
    fixture.track.dispatchEvent(new Event('ended'));
    expect(handlers.onEnded).toHaveBeenCalledOnce();
    expect(fixture.context.close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(200);
    expect(handlers.onFrame).not.toHaveBeenCalled();
    fixture.track.dispatchEvent(new Event('ended'));
    expect(handlers.onEnded).toHaveBeenCalledOnce();
  });

  it('fails cleanly without an audio track or a running context', async () => {
    let fixture = microphoneFixture({ tracks: 0 });
    let starting = new MicrophoneInput().start(callbacks());
    fixture.grant();
    await expect(starting).rejects.toMatchObject({ problem: 'no-input' });
    expect(fixture.context.close).toHaveBeenCalledOnce();

    // Resuming and closing can both reject; neither escapes as an unhandled error.
    fixture = microphoneFixture({ contextState: 'suspended' });
    fixture.context.resume.mockRejectedValue(new Error('not allowed'));
    fixture.context.close.mockRejectedValue(new Error('already closed'));
    starting = new MicrophoneInput().start(callbacks());
    fixture.grant();
    await expect(starting).rejects.toMatchObject({ problem: 'failed' });
    expect(fixture.track.stop).toHaveBeenCalledOnce();
    expect(fixture.context.close).toHaveBeenCalledOnce();
  });

  it('replaces an active session when started again', async () => {
    const first = microphoneFixture();
    const input = new MicrophoneInput();
    const starting = input.start(callbacks());
    first.grant();
    await starting;
    const second = microphoneFixture();
    const restarting = input.start(callbacks());
    expect(first.track.stop).toHaveBeenCalledOnce();
    expect(first.context.close).toHaveBeenCalledOnce();
    second.grant();
    await expect(restarting).resolves.not.toBeNull();
    input.stop();
    expect(second.context.close).toHaveBeenCalledOnce();
  });
});
