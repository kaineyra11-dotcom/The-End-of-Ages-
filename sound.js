let audio = null;
let enabled = true;
let master = null;
let volume = 0.6; // 0..1
let musicOn = true;
let musicNode = null;

function ctx() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audio = new AC();
  }
  return audio;
}

function out() {
  const c = ctx();
  if (!master) {
    master = c.createGain();
    master.gain.value = enabled ? volume : 0;
    master.connect(c.destination);
  }
  return master;
}

function beep({ freq = 440, dur = 0.07, type = "triangle", gain = 0.05 } = {}) {
  if (!enabled) return;
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;

    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    o.connect(g);
    g.connect(out());
    o.start(now);
    o.stop(now + dur + 0.02);
  } catch {
    // ignore
  }
}

export function soundEnabled() {
  return enabled;
}

export function setSoundEnabled(v) {
  enabled = !!v;
  if (master) master.gain.value = enabled ? volume : 0;
}

export function soundVolume() {
  return volume;
}

export function setSoundVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  volume = Math.max(0, Math.min(1, n));
  if (master) master.gain.value = enabled ? volume : 0;
}

export async function unlockAudio() {
  try {
    const c = ctx();
    if (c.state === "suspended") await c.resume();
  } catch {
    // ignore
  }
}

export function sfxChoice() {
  beep({ freq: 520, dur: 0.05, type: "triangle", gain: 0.05 });
}

export function sfxGood() {
  beep({ freq: 660, dur: 0.06, type: "sine", gain: 0.05 });
  beep({ freq: 880, dur: 0.05, type: "sine", gain: 0.04 });
}

export function sfxBad() {
  beep({ freq: 220, dur: 0.09, type: "sawtooth", gain: 0.04 });
}

export function sfxOpen() {
  beep({ freq: 392, dur: 0.06, type: "triangle", gain: 0.04 });
}

function noiseSplash({ dur = 0.18, gain = 0.07 } = {}) {
  if (!enabled) return;
  try {
    const c = ctx();
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.exp(-6 * t);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = c.createBufferSource();
    src.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.9;

    const g = c.createGain();
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(out());
    src.start(now);
    src.stop(now + dur + 0.02);
  } catch {
    // ignore
  }
}

export function sfxSplashFail() {
  noiseSplash({ dur: 0.22, gain: 0.08 });
  beep({ freq: 180, dur: 0.08, type: "sawtooth", gain: 0.03 });
}

export function musicEnabled() {
  return musicOn;
}

export function setMusicEnabled(v) {
  musicOn = !!v;
  if (!musicOn) stopMusic();
}

export function startMusic() {
  if (!enabled) return;
  if (!musicOn) return;
  if (musicNode) return;
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = 110;
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.02, now + 0.4);
    g.gain.setValueAtTime(0.02, now + 2.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
    o.connect(g);
    g.connect(out());
    o.start(now);
    // loop by restarting periodically (very lightweight ambient)
    o.stop(now + 3.05);
    musicNode = { o, until: now + 3.05 };
    setTimeout(() => {
      musicNode = null;
      startMusic();
    }, 2800);
  } catch {
    musicNode = null;
  }
}

export function stopMusic() {
  if (!musicNode) return;
  try {
    musicNode.o.stop();
  } catch {
    // ignore
  } finally {
    musicNode = null;
  }
}

