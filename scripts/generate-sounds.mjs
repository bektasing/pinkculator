// Uygulamanın ses efektlerini sentezler ve src/assets/sounds/ altına WAV olarak yazar.
// Hiçbir dış kaynak veya örnek (sample) kullanılmaz; her ses burada matematiksel olarak üretilir.
//
//   node scripts/generate-sounds.mjs            → IMA ADPCM (4 bit, küçük)
//   node scripts/generate-sounds.mjs --pcm      → 16 bit PCM (karşılaştırma için)
//   node scripts/generate-sounds.mjs --out DIR  → başka klasöre yaz
//
// Sesler normalize edilir (tepe ≈ −1 dBFS); birbirine göre ses seviyeleri
// oynatma sırasında src/audio/sounds.ts içindeki VOLUMES tablosuyla dengelenir.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 16000;
const NYQUIST = SAMPLE_RATE / 2;
const args = process.argv.slice(2);
const PCM = args.includes('--pcm');
const outIndex = args.indexOf('--out');
const OUT_DIR = outIndex >= 0 ? args[outIndex + 1] : join(dirname(fileURLToPath(import.meta.url)), '../src/assets/sounds');

// ───────────────────────── Sentez yardımcıları ─────────────────────────

/** `duration` saniyelik boş tampon */
const buffer = (duration) => new Float32Array(Math.ceil(duration * SAMPLE_RATE));

/** Sabit aralıklarla tekrarlanabilir sözde rastgele gürültü (her üretimde aynı sonuç) */
function noiseSource(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967295) * 2 - 1;
  };
}

/**
 * Tek bir ton ekler. `freq(t)` zamanla değişebilir (glide); `env(t)` genlik zarfı.
 * `partials`: [frekans oranı, genlik, sönüm çarpanı] — çan/zil tınısı için.
 */
function addTone(out, { start = 0, freq, env, partials = [[1, 1, 1]], gain = 1, vibrato }) {
  const first = Math.floor(start * SAMPLE_RATE);
  const phases = partials.map(() => 0);
  for (let i = first; i < out.length; i++) {
    const t = (i - first) / SAMPLE_RATE;
    const e = env(t);
    if (t > 0.05 && e < 1e-4) break;
    let f = typeof freq === 'function' ? freq(t) : freq;
    if (vibrato) f *= 1 + vibrato.depth(t) * Math.sin(2 * Math.PI * vibrato.rate * t);
    let sample = 0;
    partials.forEach(([ratio, amp, decay = 1], p) => {
      const pf = f * ratio;
      if (pf >= NYQUIST * 0.92) return;
      phases[p] += (2 * Math.PI * pf) / SAMPLE_RATE;
      // Üst partiyeller daha hızlı söner (decay > 1)
      sample += amp * Math.sin(phases[p]) * (decay === 1 ? 1 : Math.pow(Math.max(e, 1e-6), decay - 1));
    });
    out[i] += sample * e * gain;
  }
}

/** Kısa, yumuşatılmış gürültü "tık"ı (dokunma dokusu) */
function addClick(out, { start = 0, duration = 0.006, gain = 0.2, smooth = 0.35, seed = 7 }) {
  const noise = noiseSource(seed);
  const first = Math.floor(start * SAMPLE_RATE);
  const n = Math.floor(duration * SAMPLE_RATE);
  let lp = 0;
  for (let i = 0; i < n && first + i < out.length; i++) {
    lp += smooth * (noise() - lp);
    const e = Math.exp(-i / (n / 4));
    out[first + i] += lp * e * gain;
  }
}

/** Atak + üstel sönüm zarfı */
const pluck = (attack, tau) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));
/** Üstel glide: f0 → f1, zaman sabiti tau */
const glide = (f0, f1, tau) => (t) => f1 + (f0 - f1) * Math.exp(-t / tau);

/** Çan / zil tınısı (hafif uyumsuz üst partiyeller) */
const BELL = [
  [1, 1, 1],
  [2.0, 0.32, 1.8],
  [3.01, 0.12, 2.6],
  [4.18, 0.05, 3.4],
];
/** Yumuşak, yuvarlak "şeker" tınısı */
const SOFT = [
  [1, 1, 1],
  [2, 0.18, 1.5],
];

/** Sonu kısa bir rampa ile sıfıra indirir (tık sesi olmasın) ve tepe değeri normalize eder */
function finish(out, peak = 0.89) {
  const fade = Math.min(out.length, Math.floor(0.012 * SAMPLE_RATE));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return out;
}

const note = (name) => {
  const map = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const [, letter, octave] = /^([A-G])(\d)$/.exec(name);
  return 440 * Math.pow(2, (map[letter] + (Number(octave) - 4) * 12) / 12);
};

// ───────────────────────── Sesler ─────────────────────────

const SOUNDS = {
  /** Hesap makinesi tuşları, kart seçimi: yumuşak, kısa "pop" */
  tap() {
    const out = buffer(0.075);
    addTone(out, { freq: glide(980, 560, 0.012), env: pluck(0.0015, 0.016), partials: SOFT });
    addClick(out, { duration: 0.004, gain: 0.12, smooth: 0.25 });
    return finish(out);
  },

  /** = kısa basış: tatlı, kısa "ding" */
  ding() {
    const out = buffer(0.42);
    addTone(out, { freq: note('E6'), env: pluck(0.002, 0.13), partials: BELL });
    addTone(out, { start: 0.004, freq: note('B6'), env: pluck(0.002, 0.07), partials: SOFT, gain: 0.22 });
    return finish(out);
  },

  /** Basılı tutarken her kalp atışında: yumuşak "tuk" */
  pulse() {
    const out = buffer(0.09);
    addTone(out, { freq: glide(420, 230, 0.02), env: pluck(0.002, 0.022), partials: [[1, 1], [2, 0.35, 1.4]] });
    return finish(out);
  },

  /** Gizli ekran / menü açılışı: yükselen parlak arpej */
  unlock() {
    const out = buffer(0.78);
    ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => {
      addTone(out, { start: i * 0.065, freq: note(n), env: pluck(0.003, i === 3 ? 0.26 : 0.12), partials: BELL, gain: 0.8 + i * 0.07 });
    });
    addTone(out, {
      start: 0.2,
      freq: note('G7'),
      env: (t) => (t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) / 0.18)),
      partials: [[1, 1]],
      gain: 0.12,
      vibrato: { rate: 9, depth: () => 0.004 },
    });
    return finish(out);
  },

  /** Kalp Sektirme vuruşu: kısa, sevimli "boing" */
  boing() {
    const out = buffer(0.2);
    addTone(out, {
      freq: (t) => 260 + 300 * (1 - Math.exp(-t / 0.018)),
      env: pluck(0.002, 0.055),
      partials: [[1, 1], [2, 0.28, 1.3], [3, 0.08, 1.8]],
      vibrato: { rate: 26, depth: (t) => 0.07 * Math.exp(-t / 0.05) },
    });
    return finish(out);
  },

  /** Kalp Birleştir: iki taş birleşince yukarı kayan kısa "blip" */
  merge() {
    const out = buffer(0.16);
    addTone(out, { freq: glide(700, 760, 0.02), env: pluck(0.002, 0.025), partials: SOFT });
    addTone(out, { start: 0.042, freq: glide(1050, 1120, 0.02), env: pluck(0.002, 0.04), partials: SOFT, gain: 0.85 });
    return finish(out);
  },

  /** 2048'e ulaşınca: kutlama arpeji + parıltı */
  win() {
    const out = buffer(1.05);
    ['C6', 'E6', 'G6', 'C7', 'E7'].forEach((n, i) => {
      addTone(out, { start: i * 0.075, freq: note(n), env: pluck(0.003, i === 4 ? 0.34 : 0.14), partials: BELL, gain: 0.72 + i * 0.05 });
    });
    // Son akor: yumuşak, uzun
    for (const n of ['C6', 'G6', 'E6']) {
      addTone(out, { start: 0.38, freq: note(n), env: pluck(0.02, 0.3), partials: SOFT, gain: 0.22 });
    }
    return finish(out);
  },

  /** Kalp Kulesi: blok oturunca yumuşak "tok" */
  place() {
    const out = buffer(0.11);
    addTone(out, { freq: glide(520, 300, 0.015), env: pluck(0.0015, 0.03), partials: [[1, 1], [2.4, 0.2, 1.6]] });
    addClick(out, { duration: 0.008, gain: 0.25, smooth: 0.18, seed: 3 });
    return finish(out);
  },

  /** Kalp Kulesi mükemmel yerleştirme: parlak çınlama */
  perfect() {
    const out = buffer(0.5);
    addTone(out, { freq: note('G6'), env: pluck(0.002, 0.16), partials: BELL });
    addTone(out, { start: 0.035, freq: note('D7'), env: pluck(0.002, 0.14), partials: BELL, gain: 0.55 });
    addTone(out, { freq: glide(520, 300, 0.015), env: pluck(0.0015, 0.025), partials: SOFT, gain: 0.35 });
    return finish(out);
  },

  /** Yeni rekor: kısa fanfar */
  record() {
    const out = buffer(0.95);
    ['G5', 'C6', 'E6'].forEach((n, i) => {
      addTone(out, { start: i * 0.085, freq: note(n), env: pluck(0.003, 0.1), partials: BELL, gain: 0.8 });
    });
    addTone(out, {
      start: 0.255,
      freq: note('G6'),
      env: (t) => (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.28)),
      partials: BELL,
      vibrato: { rate: 6, depth: (t) => 0.006 * Math.min(1, t / 0.15) },
    });
    addTone(out, { start: 0.255, freq: note('C6'), env: pluck(0.02, 0.25), partials: SOFT, gain: 0.25 });
    return finish(out);
  },
};

// ───────────────────────── WAV kodlama ─────────────────────────

function toInt16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  return pcm;
}

function wavHeader(format, dataBytes, extra) {
  const { formatTag, blockAlign, bitsPerSample, byteRate, extraBytes } = format;
  const fmtSize = 16 + (extraBytes ? 2 + extraBytes.length : 0);
  const factSize = extra?.fact ? 12 : 0;
  const header = Buffer.alloc(12 + 8 + fmtSize + factSize + 8);
  let o = 0;
  header.write('RIFF', o); o += 4;
  header.writeUInt32LE(header.length - 8 + dataBytes, o); o += 4;
  header.write('WAVE', o); o += 4;
  header.write('fmt ', o); o += 4;
  header.writeUInt32LE(fmtSize, o); o += 4;
  header.writeUInt16LE(formatTag, o); o += 2;
  header.writeUInt16LE(1, o); o += 2; // mono
  header.writeUInt32LE(SAMPLE_RATE, o); o += 4;
  header.writeUInt32LE(byteRate, o); o += 4;
  header.writeUInt16LE(blockAlign, o); o += 2;
  header.writeUInt16LE(bitsPerSample, o); o += 2;
  if (extraBytes) {
    header.writeUInt16LE(extraBytes.length, o); o += 2;
    extraBytes.copy(header, o); o += extraBytes.length;
  }
  if (extra?.fact) {
    header.write('fact', o); o += 4;
    header.writeUInt32LE(4, o); o += 4;
    header.writeUInt32LE(extra.fact, o); o += 4;
  }
  header.write('data', o); o += 4;
  header.writeUInt32LE(dataBytes, o);
  return header;
}

function encodePcm16(samples) {
  const pcm = toInt16(samples);
  const data = Buffer.from(pcm.buffer);
  const header = wavHeader({ formatTag: 1, blockAlign: 2, bitsPerSample: 16, byteRate: SAMPLE_RATE * 2 }, data.length);
  return Buffer.concat([header, data]);
}

// IMA ADPCM (WAV format 0x11): 4 bit/örnek, 16 bit PCM'in yaklaşık dörtte biri.
const STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060,
  1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132,
  7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];
const INDEX_TABLE = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const BLOCK_ALIGN = 256;
const SAMPLES_PER_BLOCK = (BLOCK_ALIGN - 4) * 2 + 1; // 505

function encodeAdpcm(samples) {
  const pcm = toInt16(samples);
  const blocks = Math.ceil(pcm.length / SAMPLES_PER_BLOCK);
  const data = Buffer.alloc(blocks * BLOCK_ALIGN);
  let index = 0;
  for (let b = 0; b < blocks; b++) {
    const base = b * SAMPLES_PER_BLOCK;
    const at = (i) => (base + i < pcm.length ? pcm[base + i] : 0);
    let predictor = at(0);
    const off = b * BLOCK_ALIGN;
    data.writeInt16LE(predictor, off);
    data.writeUInt8(index, off + 2);
    data.writeUInt8(0, off + 3);
    for (let i = 1; i < SAMPLES_PER_BLOCK; i++) {
      const step = STEP_TABLE[index];
      let diff = at(i) - predictor;
      let code = 0;
      if (diff < 0) { code = 8; diff = -diff; }
      let delta = step >> 3;
      if (diff >= step) { code |= 4; diff -= step; delta += step; }
      if (diff >= step >> 1) { code |= 2; diff -= step >> 1; delta += step >> 1; }
      if (diff >= step >> 2) { code |= 1; delta += step >> 2; }
      predictor += code & 8 ? -delta : delta;
      predictor = Math.max(-32768, Math.min(32767, predictor));
      index = Math.max(0, Math.min(88, index + INDEX_TABLE[code]));
      const nibbleIndex = i - 1;
      const byteOff = off + 4 + (nibbleIndex >> 1);
      if (nibbleIndex & 1) data[byteOff] |= code << 4;
      else data[byteOff] = code;
    }
  }
  const extraBytes = Buffer.alloc(2);
  extraBytes.writeUInt16LE(SAMPLES_PER_BLOCK, 0);
  const header = wavHeader(
    {
      formatTag: 0x11,
      blockAlign: BLOCK_ALIGN,
      bitsPerSample: 4,
      byteRate: Math.round((SAMPLE_RATE * BLOCK_ALIGN) / SAMPLES_PER_BLOCK),
      extraBytes,
    },
    data.length,
    { fact: pcm.length },
  );
  return Buffer.concat([header, data]);
}

// ───────────────────────── Yaz ─────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
let total = 0;
for (const [name, make] of Object.entries(SOUNDS)) {
  const samples = make();
  const file = (PCM ? encodePcm16 : encodeAdpcm)(samples);
  writeFileSync(join(OUT_DIR, `${name}.wav`), file);
  total += file.length;
  console.log(`${name.padEnd(8)} ${(samples.length / SAMPLE_RATE).toFixed(2)} s  ${(file.length / 1024).toFixed(1)} KB`);
}
console.log(`toplam   ${(total / 1024).toFixed(1)} KB (${PCM ? '16 bit PCM' : 'IMA ADPCM'}, ${SAMPLE_RATE} Hz mono)`);
