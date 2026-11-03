import { midiToFrequency } from '../../domain/music/playback';

/** Envelope peak at full volume. Notes never overlap, so this stays below clipping. */
const PEAK_GAIN = 0.9;
/** Volume changes glide this fast (seconds) so moving the slider mid-note doesn't click. */
const VOLUME_GLIDE = 0.015;

/** Maps a 0–100% volume to output gain. Squared, so slider steps sound even. */
export function volumeToGain(volume: number): number {
  if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
    throw new RangeError('Choose a volume between 0 and 100%.');
  }
  return (volume / 100) ** 2;
}

/** Output only: no microphone acquisition. Audio is created by play(), after a gesture. */
export class NotePlayer {
  private audio: { context: AudioContext; output: GainNode } | undefined;
  private level = 1;
  private voices = new Map<OscillatorNode, GainNode>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private generation = 0;

  /** Applies at once, including to notes already sounding. */
  setVolume(volume: number): void {
    this.level = volumeToGain(volume);
    this.audio?.output.gain.setTargetAtTime(
      this.level,
      this.audio.context.currentTime,
      VOLUME_GLIDE,
    );
  }

  async play(
    notes: readonly number[],
    bpm: number,
    onNote: (note: number) => void,
    onComplete: () => void,
  ): Promise<void> {
    this.stop();
    const generation = this.generation;
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240 || notes.length === 0) {
      throw new RangeError(
        'Choose a tempo between 40 and 240 BPM and at least one note.',
      );
    }
    const frequencies = notes.map(midiToFrequency);
    if (typeof AudioContext === 'undefined') {
      throw new Error(
        'Audio playback is unavailable in this browser. Try a browser with Web Audio support.',
      );
    }
    this.audio ??= this.openAudio();
    const { context, output } = this.audio;
    await context.resume();
    // Stop, a new play request, or teardown may have happened while audio was starting.
    if (generation !== this.generation) return;
    if (context.state !== 'running') {
      throw new Error('Audio could not start. Try playing a note again.');
    }

    const beat = 60 / bpm;
    const start = context.currentTime + 0.02;
    notes.forEach((note, index) => {
      const time = start + index * beat;
      const duration = beat * 0.85;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequencies[index]!, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.02);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      oscillator.connect(gain);
      gain.connect(output);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices.delete(oscillator);
      };
      this.voices.set(oscillator, gain);
      oscillator.start(time);
      oscillator.stop(time + duration);
      this.timers.push(
        setTimeout(() => onNote(note), (0.02 + index * beat) * 1000),
      );
    });
    this.timers.push(
      setTimeout(
        () => {
          this.stop();
          onComplete();
        },
        (0.02 + notes.length * beat) * 1000,
      ),
    );
  }

  stop(): void {
    this.generation += 1;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    for (const [oscillator, gain] of this.voices) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
  }

  dispose(): void {
    this.stop();
    void this.audio?.context.close().catch(() => {});
    this.audio = undefined;
  }

  /** Voices feed one output gain, so volume changes reach every note. */
  private openAudio() {
    const context = new AudioContext();
    const output = context.createGain();
    output.gain.value = this.level;
    output.connect(context.destination);
    return { context, output };
  }
}
