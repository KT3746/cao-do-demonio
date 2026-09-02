/**
 * Sons sintetizados no navegador (Web Audio).
 * Nada de amostras prontas — só tons originais do Queda Certa.
 */

const STORAGE_KEY = "queda-certa-som";

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = readMuted();
    this.unlocked = false;
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.unlocked = true;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone({
    freq = 440,
    dur = 0.08,
    type = "sine",
    vol = 0.2,
    slide = 0,
    delay = 0,
    filter = 0,
  }) {
    if (this.muted || !this.ctx || !this.unlocked) return;
    const t = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    if (filter) {
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = filter;
      osc.connect(filt);
      filt.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur = 0.06, vol = 0.08) {
    if (this.muted || !this.ctx || !this.unlocked) return;
    const t = this.now();
    const size = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  move() {
    this.tone({ freq: 380, dur: 0.035, type: "square", vol: 0.05, filter: 1400 });
  }

  rotate() {
    this.tone({ freq: 620, dur: 0.05, type: "triangle", vol: 0.1 });
    this.tone({ freq: 930, dur: 0.04, type: "sine", vol: 0.06, delay: 0.015 });
  }

  lock() {
    this.tone({ freq: 160, dur: 0.1, type: "sine", vol: 0.16, slide: -50, filter: 600 });
    this.noise(0.04, 0.04);
  }

  hardDrop() {
    this.tone({ freq: 220, dur: 0.08, type: "sine", vol: 0.14, slide: -90 });
    this.tone({ freq: 90, dur: 0.12, type: "triangle", vol: 0.1, delay: 0.02 });
  }

  hold() {
    this.tone({ freq: 480, dur: 0.09, type: "sine", vol: 0.09, slide: 220 });
  }

  lineClear(count) {
    const chord =
      count >= 4
        ? [523, 659, 784, 1046]
        : count === 3
          ? [440, 554, 659]
          : count === 2
            ? [392, 523]
            : [349];
    chord.forEach((freq, i) => {
      this.tone({
        freq,
        dur: 0.16 + count * 0.02,
        type: "triangle",
        vol: 0.11,
        delay: i * 0.055,
      });
    });
    if (count >= 4) {
      this.tone({ freq: 1318, dur: 0.22, type: "sine", vol: 0.08, delay: 0.2 });
    }
  }

  levelUp() {
    [523, 659, 784, 988].forEach((freq, i) => {
      this.tone({ freq, dur: 0.12, type: "sine", vol: 0.1, delay: i * 0.07 });
    });
  }

  gameOver() {
    [392, 349, 294, 246, 196].forEach((freq, i) => {
      this.tone({
        freq,
        dur: 0.22,
        type: "triangle",
        vol: 0.12,
        delay: i * 0.12,
        slide: -30,
      });
    });
  }

  pause() {
    this.tone({ freq: 330, dur: 0.08, type: "sine", vol: 0.08 });
    this.tone({ freq: 247, dur: 0.1, type: "sine", vol: 0.07, delay: 0.08 });
  }

  resume() {
    this.tone({ freq: 247, dur: 0.07, type: "sine", vol: 0.07 });
    this.tone({ freq: 330, dur: 0.09, type: "sine", vol: 0.08, delay: 0.07 });
  }

  start() {
    [392, 523, 659].forEach((freq, i) => {
      this.tone({ freq, dur: 0.12, type: "triangle", vol: 0.1, delay: i * 0.06 });
    });
  }
}

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
