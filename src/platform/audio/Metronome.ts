/** Output only. The audio clock keeps the beat; a short timer queues clicks ahead. */
export class Metronome {
  private context: AudioContext | undefined;
  private voices = new Map<OscillatorNode, GainNode>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  private tempo = 90;
  private nextBeat = 0;
  private lastBeat: number | undefined;

  setTempo(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) {
      throw new RangeError('Choose a tempo between 40 and 240 BPM.');
    }
    this.tempo = bpm;
    if (this.lastBeat !== undefined) {
      this.nextBeat = this.lastBeat + 60 / bpm;
    }
  }

  async start(bpm: number): Promise<void> {
    this.stop();
    this.setTempo(bpm);
    const generation = this.generation;
    if (typeof AudioContext === 'undefined') {
      throw new Error(
        'The metronome is unavailable in this browser. Try a browser with Web Audio support.',
      );
    }
    this.context ??= new AudioContext();
    const context = this.context;
    await context.resume();
    if (generation !== this.generation) return;
    if (context.state !== 'running') {
      throw new Error('The metronome could not start. Please try again.');
    }
    this.nextBeat = context.currentTime + 0.02;
    const schedule = () => {
      // After a stalled timer, skip missed beats instead of playing a burst.
      if (this.nextBeat < context.currentTime) {
        this.nextBeat = context.currentTime + 0.02;
      }
      while (this.nextBeat < context.currentTime + 0.1) {
        this.click(context, this.nextBeat);
        this.lastBeat = this.nextBeat;
        this.nextBeat += 60 / this.tempo;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 25);
  }

  private click(context: AudioContext, time: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1000, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    gain.gain.linearRampToValueAtTime(0, time + 0.04);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(oscillator);
    };
    this.voices.set(oscillator, gain);
    oscillator.start(time);
    oscillator.stop(time + 0.04);
  }

  stop(): void {
    this.generation += 1;
    clearInterval(this.timer);
    this.timer = undefined;
    this.lastBeat = undefined;
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
