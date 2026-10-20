/**
 * Small Web Audio synthesizer. No audio files: the ambient bed and every UI
 * cue are generated in the browser so the page stays a single static bundle.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private timer: number | null = null;
  private step = 0;
  enabled = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private buildPad(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.padGain) return;
    const pad = ctx.createGain();
    pad.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.8;
    pad.connect(filter);
    filter.connect(this.master);
    this.padGain = pad;

    const voices: Array<[number, OscillatorType, number]> = [
      [55, "triangle", 0.22],
      [110, "sawtooth", 0.1],
      [164.81, "sawtooth", 0.07],
      [220, "sine", 0.05],
    ];
    for (const [freq, type, level] of voices) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      gain.gain.value = level;
      osc.connect(gain);
      gain.connect(pad);
      osc.start();
      this.oscillators.push(osc);
    }

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  }

  private swell(): void {
    const ctx = this.ctx;
    if (!ctx || !this.padGain || !this.oscillators.length) return;
    const chords = [
      [110, 164.81, 220],
      [98, 146.83, 196],
      [123.47, 185, 246.94],
      [87.31, 130.81, 174.61],
    ];
    const chord = chords[this.step % chords.length];
    this.step += 1;
    this.oscillators.forEach((osc, index) => {
      if (index === 0) return;
      const target = chord[(index - 1) % chord.length];
      osc.frequency.cancelScheduledValues(ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(target, ctx.currentTime + 3.5);
    });
  }

  async start(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    this.buildPad();
    if (!this.master || !this.padGain) return;
    this.enabled = true;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 1.2);
    this.padGain.gain.cancelScheduledValues(ctx.currentTime);
    this.padGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.0);
    this.swell();
    if (this.timer === null) {
      this.timer = window.setInterval(() => this.swell(), 8000);
    }
  }

  stop(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) {
      this.enabled = false;
      return;
    }
    this.enabled = false;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  toggle(): boolean {
    if (this.enabled) {
      this.stop();
      return false;
    }
    void this.start();
    return true;
  }

  private tone(freq: number, duration: number, type: OscillatorType, level: number, delay = 0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!this.master) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  click(): void {
    this.tone(660, 0.08, "triangle", 0.18);
    this.tone(990, 0.06, "sine", 0.08, 0.02);
  }

  hover(): void {
    this.tone(1320, 0.04, "sine", 0.04);
  }

  success(): void {
    this.tone(523.25, 0.14, "triangle", 0.16);
    this.tone(659.25, 0.16, "triangle", 0.15, 0.09);
    this.tone(783.99, 0.22, "triangle", 0.14, 0.18);
    this.tone(1046.5, 0.3, "sine", 0.1, 0.28);
  }

  settle(): void {
    this.tone(392, 0.2, "sawtooth", 0.08);
    this.tone(523.25, 0.26, "sawtooth", 0.07, 0.1);
    this.tone(784, 0.4, "sine", 0.1, 0.22);
  }

  error(): void {
    this.tone(220, 0.16, "square", 0.1);
    this.tone(174.61, 0.22, "square", 0.09, 0.08);
  }
}

export const sound = new SoundEngine();
