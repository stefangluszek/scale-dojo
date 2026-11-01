import { analysisWindowSize } from '../../domain/pitch/detector';
import { ANALYSIS_INTERVAL_MS } from '../../domain/pitch/stabilizer';

/** Why the microphone could not start. */
export type MicrophoneProblem =
  /** No microphone or Web Audio support in this browser. */
  | 'unsupported'
  /** Browsers only allow microphones on HTTPS pages and localhost. */
  | 'insecure'
  /** The person or the browser's settings blocked access. */
  | 'denied'
  /** No audio input device is connected. */
  | 'no-input'
  /** The device exists but couldn't be opened, often because it's in use. */
  | 'busy'
  /** Anything else, such as audio processing that wouldn't start. */
  | 'failed';

export class MicrophoneError extends Error {
  readonly problem: MicrophoneProblem;

  constructor(problem: MicrophoneProblem, message: string = problem) {
    super(message);
    this.name = 'MicrophoneError';
    this.problem = problem;
  }
}

/** The newest analysis window. Its samples are reused for the next frame. */
export interface AudioFrame {
  /** `performance.now()` when the window was read. */
  time: number;
  samples: Float32Array;
  sampleRate: number;
}

export type VoiceProcessing =
  'echo cancellation' | 'noise suppression' | 'automatic gain control';

export interface MicrophoneDetails {
  sampleRate: number;
  /**
   * Voice processing the browser reports as still on after we asked for it
   * to be off. Processing can distort or gate bass notes.
   */
  processing: VoiceProcessing[];
}

export interface MicrophoneCallbacks {
  onFrame: (frame: AudioFrame) => void;
  /** The input ended without stop(): unplugged, revoked, or taken away. */
  onEnded: () => void;
}

interface Session {
  context: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  timer: ReturnType<typeof setInterval>;
  track: MediaStreamTrack;
  onTrackEnded: () => void;
}

/** Speech processing hurts music, so ask for it off; browsers may not comply. */
const CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  },
  video: false,
};

const PROBLEMS_BY_ERROR: Record<string, MicrophoneProblem> = {
  NotAllowedError: 'denied',
  PermissionDeniedError: 'denied',
  SecurityError: 'denied',
  NotFoundError: 'no-input',
  DevicesNotFoundError: 'no-input',
  OverconstrainedError: 'no-input',
  NotReadableError: 'busy',
  TrackStartError: 'busy',
  AbortError: 'busy',
};

function toMicrophoneError(cause: unknown): MicrophoneError {
  const name = (cause as { name?: unknown } | null)?.name;
  const problem =
    (typeof name === 'string' && PROBLEMS_BY_ERROR[name]) || 'failed';
  return new MicrophoneError(
    problem,
    cause instanceof Error ? cause.message : problem,
  );
}

function release(context: AudioContext, stream?: MediaStream) {
  stream?.getTracks().forEach((track) => track.stop());
  void context.close().catch(() => {});
}

/**
 * Microphone acquisition only: permission, device lifetime, and a steady
 * stream of sample windows. Pitch estimation happens elsewhere, on these
 * windows. Nothing is recorded or sent anywhere.
 */
export class MicrophoneInput {
  private session: Session | undefined;
  private generation = 0;

  /**
   * Requests the microphone and starts delivering frames. Call it from a
   * user action: it creates the audio context before waiting for permission,
   * so the browser treats the context as user-initiated. Resolves to null if
   * stop() was called while starting.
   */
  async start(
    callbacks: MicrophoneCallbacks,
  ): Promise<MicrophoneDetails | null> {
    this.stop();
    const generation = this.generation;
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      throw new MicrophoneError('insecure');
    }
    const devices =
      typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (
      typeof devices?.getUserMedia !== 'function' ||
      typeof AudioContext === 'undefined'
    ) {
      throw new MicrophoneError('unsupported');
    }

    const context = new AudioContext();
    const resuming = context.resume().catch(() => {});
    let stream: MediaStream;
    try {
      stream = await devices.getUserMedia(CONSTRAINTS);
    } catch (cause) {
      release(context);
      if (generation !== this.generation) return null;
      throw toMicrophoneError(cause);
    }
    await resuming;
    // Stop, a new start, or teardown may have happened while waiting.
    if (generation !== this.generation) {
      release(context, stream);
      return null;
    }
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') {
      release(context, stream);
      throw new MicrophoneError('no-input');
    }
    if (context.state !== 'running') {
      release(context, stream);
      throw new MicrophoneError('failed', 'Audio processing did not start.');
    }

    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = analysisWindowSize(context.sampleRate);
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const onTrackEnded = () => {
      if (generation !== this.generation) return;
      this.stop();
      callbacks.onEnded();
    };
    track.addEventListener('ended', onTrackEnded);
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      callbacks.onFrame({
        time: performance.now(),
        samples,
        sampleRate: context.sampleRate,
      });
    }, ANALYSIS_INTERVAL_MS);
    this.session = {
      context,
      stream,
      source,
      analyser,
      timer,
      track,
      onTrackEnded,
    };

    const settings = track.getSettings();
    const processing: VoiceProcessing[] = [];
    if (settings.echoCancellation) processing.push('echo cancellation');
    if (settings.noiseSuppression) processing.push('noise suppression');
    if (settings.autoGainControl) processing.push('automatic gain control');
    return { sampleRate: context.sampleRate, processing };
  }

  /** Stops frames, releases the device and closes audio processing. */
  stop(): void {
    this.generation += 1;
    const session = this.session;
    if (!session) return;
    this.session = undefined;
    clearInterval(session.timer);
    session.track.removeEventListener('ended', session.onTrackEnded);
    session.source.disconnect();
    session.analyser.disconnect();
    release(session.context, session.stream);
  }
}
