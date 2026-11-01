import { midiToFrequency } from '../../domain/music/playback';

/** Output only: no microphone acquisition. Audio is created by play(), after a gesture. */
export class NotePlayer {
  private context: AudioContext | undefined;
  private voices = new Map<OscillatorNode, GainNode>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private generation = 0;

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
    this.context ??= new AudioContext();
    const context = this.context;
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
      gain.gain.linearRampToValueAtTime(0.18, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.02);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
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
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}
