/*
 * 音频引擎：
 * 1. 使用 OfflineAudioContext 把每首免版权曲目渲染成 15 秒 AudioBuffer；
 * 2. 播放器支持 试听 / 暂停 / 进度拖动 / 结束回调；
 * 3. 支持用户上传本地音频文件，仅在浏览器内播放。
 */
(function () {
  const DURATION = 15;
  const buffers = {};
  let actx = null;

  function ctx() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    return actx;
  }

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 3, 5, 7, 10, 12]
  };

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function noiseBuffer(offline, dur) {
    const len = Math.ceil(offline.sampleRate * dur);
    const b = offline.createBuffer(1, len, offline.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  async function render(track) {
    if (buffers[track.id]) return buffers[track.id];
    const s = track.synth;
    const rate = 44100;
    const offline = new OfflineAudioContext(2, Math.ceil(rate * DURATION), rate);

    const master = offline.createGain();
    master.gain.value = 0.85;
    const filter = offline.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4200;
    master.connect(filter);
    filter.connect(offline.destination);

    const beat = 60 / s.bpm;
    const step = beat / 2;
    const barSteps = 8;
    const totalSteps = Math.ceil(DURATION / step);
    const prog = s.mode === "minor" ? [0, -3, 5, -5] : [0, 4, -3, -5];

    // 和弦垫 + 贝斯
    for (let bar = 0; bar * barSteps * step < DURATION; bar++) {
      const barStart = bar * barSteps * step;
      const root = s.root + prog[bar % prog.length];
      const chord = s.mode === "minor" ? [0, 3, 7] : [0, 4, 7];

      chord.forEach((iv) => {
        const o = offline.createOscillator();
        o.type = "triangle";
        o.frequency.value = midiToFreq(root + iv);
        const g = offline.createGain();
        g.gain.setValueAtTime(0, barStart);
        g.gain.linearRampToValueAtTime(0.07 * s.intensity, barStart + 0.08);
        g.gain.setValueAtTime(0.07 * s.intensity, Math.min(barStart + beat * 4 - 0.1, DURATION));
        g.gain.linearRampToValueAtTime(0, Math.min(barStart + beat * 4, DURATION));
        o.connect(g); g.connect(master);
        o.start(barStart); o.stop(barStart + beat * 4 + 0.05);
      });

      [0, 2].forEach((bi) => {
        const t = barStart + bi * beat;
        if (t >= DURATION) return;
        const o = offline.createOscillator();
        o.type = s.bassWave;
        o.frequency.value = midiToFreq(root - 12);
        const g = offline.createGain();
        g.gain.setValueAtTime(0.16 * s.intensity, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + beat);
      });
    }

    // 底鼓
    if (s.kick) {
      for (let t = 0; t < DURATION; t += beat) {
        const o = offline.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
        const g = offline.createGain();
        g.gain.setValueAtTime(0.28 * s.intensity, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.2);
      }
    }

    // 踩镲
    if (s.hats) {
      const hatBuf = noiseBuffer(offline, 0.05);
      for (let i = 0; i < totalSteps; i++) {
        if (i % 2 !== 1) continue;
        const t = i * step;
        const src = offline.createBufferSource(); src.buffer = hatBuf;
        const g = offline.createGain();
        g.gain.setValueAtTime(0.06 * s.intensity, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        const hp = offline.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
        src.connect(hp); hp.connect(g); g.connect(master);
        src.start(t); src.stop(t + 0.06);
      }
    }

    // 主旋律
    const scale = SCALES[s.mode];
    s.melody.forEach((deg, i) => {
      const t = i * step;
      if (t >= DURATION) return;
      const oct = Math.floor(deg / scale.length);
      const idx = ((deg % scale.length) + scale.length) % scale.length;
      const midi = s.root + 12 + scale[idx] + oct * 12;
      const o = offline.createOscillator();
      o.type = s.leadWave;
      o.frequency.value = midiToFreq(midi);
      const g = offline.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.10 * s.intensity, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.95);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + step);
    });

    const buf = await offline.startRendering();
    buffers[track.id] = buf;
    return buf;
  }

  const player = {
    track: null,
    buffer: null,
    audioEl: null,
    source: null,
    playing: false,
    startedAt: 0,
    offset: 0,
    duration: DURATION,
    raf: null,
    onTick: null,
    onEnded: null,
    onStateChange: null,

    async playTrack(track) {
      this.stopInternal();
      this.track = track;
      this.buffer = await render(track);
      this.duration = this.buffer.duration;
      const c = ctx();
      if (c.state === "suspended") await c.resume();
      this.source = c.createBufferSource();
      this.source.buffer = this.buffer;
      const g = c.createGain(); g.gain.value = 1;
      this.source.connect(g); g.connect(c.destination);
      this.source.onended = () => {
        if (this.playing) {
          this.playing = false;
          this.onEnded && this.onEnded();
        }
      };
      this.source.start();
      this.playing = true;
      this.startedAt = c.currentTime;
      this.offset = 0;
      this.emitState();
      this.tickLoop();
    },

    playFile(file) {
      this.stopInternal();
      this.track = null;
      const url = URL.createObjectURL(file);
      const el = new Audio();
      el.src = url;
      el.addEventListener("loadedmetadata", () => {
        this.duration = el.duration || DURATION;
        this.emitState();
      });
      el.addEventListener("ended", () => {
        this.playing = false;
        this.onEnded && this.onEnded();
      });
      el.addEventListener("timeupdate", () => {
        this.offset = el.currentTime;
        this.onTick && this.onTick(el.currentTime, this.duration);
      });
      this.audioEl = el;
      this.playing = true;
      el.play().catch(() => {
        this.playing = false;
        this.emitState();
      });
      this.emitState();
    },

    pause() {
      if (!this.playing) return;
      const c = ctx();
      if (this.source) {
        this.offset += c.currentTime - this.startedAt;
        try { this.source.onended = null; this.source.stop(); } catch (e) {}
        this.source = null;
      } else if (this.audioEl) {
        this.audioEl.pause();
      }
      this.playing = false;
      this.emitState();
    },

    resume() {
      const c = ctx();
      if (c.state === "suspended") c.resume();
      if (this.source && this.buffer) {
        this.source = c.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(c.destination);
        this.source.start(0, this.offset);
        this.playing = true;
        this.startedAt = c.currentTime;
        this.emitState();
        this.tickLoop();
      } else if (this.audioEl) {
        this.audioEl.play();
        this.playing = true;
        this.emitState();
      }
    },

    toggle() { this.playing ? this.pause() : this.resume(); },

    stopInternal() {
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.source) {
        try { this.source.onended = null; this.source.stop(); } catch (e) {}
        this.source = null;
      }
      if (this.audioEl) {
        this.audioEl.pause();
        URL.revokeObjectURL(this.audioEl.src);
        this.audioEl = null;
      }
      this.playing = false;
      this.offset = 0;
    },

    seek(sec) {
      sec = Math.max(0, Math.min(sec, this.duration));
      if (this.source && this.buffer) {
        const wasPlaying = this.playing;
        this.stopInternal();
        this.offset = sec;
        if (wasPlaying) {
          const c = ctx();
          this.source = c.createBufferSource();
          this.source.buffer = this.buffer;
          this.source.connect(c.destination);
          this.source.start(0, sec);
          this.playing = true;
          this.startedAt = c.currentTime;
          this.emitState();
          this.tickLoop();
        }
      } else if (this.audioEl) {
        this.audioEl.currentTime = sec;
        this.offset = sec;
      }
      this.onTick && this.onTick(sec, this.duration);
    },

    tickLoop() {
      const c = ctx();
      const loop = () => {
        if (!this.playing) return;
        const el = this.offset + (c.currentTime - this.startedAt);
        if (el >= this.duration) {
          this.onTick && this.onTick(this.duration, this.duration);
          this.onEnded && this.onEnded();
          return;
        }
        this.onTick && this.onTick(el, this.duration);
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    },

    emitState() { this.onStateChange && this.onStateChange(this.playing); },

    currentTime() {
      if (this.source) return this.offset + ctx().currentTime - this.startedAt;
      if (this.audioEl) return this.audioEl.currentTime;
      return this.offset;
    }
  };

  window.BGM = { player, render, DURATION };
})();
