// Uygulamanın ses efektlerini sentezler ve src/assets/sounds/ altına WAV olarak yazar.
// Hiçbir dış kaynak veya örnek (sample) kullanılmaz; her ses burada matematiksel olarak üretilir.
//
//   node scripts/generate-sounds.mjs                     → uygulamanın sesleri (varsayılan varyasyon, IMA ADPCM)
//   node scripts/generate-sounds.mjs --variant cam       → başka bir varyasyonu uygulamaya yaz
//   node scripts/generate-sounds.mjs --preview           → tüm varyasyonlar design/sound-preview/ altına (16 bit PCM)
//   node scripts/generate-sounds.mjs --pcm --out DIR     → 16 bit PCM, başka klasöre
//
// Karakter: yumuşak ve sıcak ("pahalı uygulama" hissi). Her ses yumuşak bir atakla başlar,
// yumuşakça söner; tonlar eskisine göre yaklaşık bir oktav pes, tek sinüs yerine katmanlı
// (harmonikler / FM / marimba partiyelleri), üstüne çok kısa bir oda yankısı eklenir.
// Sesler normalize edilir (tepe ≈ −1 dBFS); birbirine göre seviyeleri oynatma sırasında
// src/audio/sounds.ts içindeki VOLUMES tablosuyla dengelenir.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 16000;
const NYQUIST = SAMPLE_RATE / 2;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Uygulamada kullanılan varyasyon */
const DEFAULT_VARIANT = 'sicak';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

// ───────────────────────── Sentez yardımcıları ─────────────────────────

const buffer = (duration) => new Float32Array(Math.ceil(duration * SAMPLE_RATE));

/** Tekrarlanabilir gürültü (her üretimde aynı sonuç) */
function noiseSource(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967295) * 2 - 1;
  };
}

/** Yumuşak (yükseltilmiş kosinüs) atak: ani başlangıç "tık"ı olmaz */
const softAttack = (t, attack) => (t >= attack ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / attack));
/** Yumuşak atak + üstel sönüm */
const env = (attack, tau) => (t) => softAttack(t, attack) * (t < attack ? 1 : Math.exp(-(t - attack) / tau));
/** Üstel glide: f0 → f1 */
const glide = (f0, f1, tau) => (t) => f1 + (f0 - f1) * Math.exp(-t / tau);

const note = (name) => {
  const map = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(name);
  return 440 * Math.pow(2, (map[letter] + (sharp ? 1 : 0) + (Number(octave) - 4) * 12) / 12);
};

/**
 * Katmanlı ton: temel frekans + partiyeller. `partials`: [oran, genlik, sönüm çarpanı]
 * (sönüm çarpanı < 1 → o partiyel daha hızlı söner; üst partiyeller hızla sönerek
 * atakta parlaklık, kuyrukta sıcaklık verir).
 */
function addTone(out, { start = 0, freq, attack = 0.004, tau, partials = [[1, 1, 1]], gain = 1, vibrato }) {
  const first = Math.floor(start * SAMPLE_RATE);
  const phases = partials.map(() => 0);
  for (let i = first; i < out.length; i++) {
    const t = (i - first) / SAMPLE_RATE;
    const a = softAttack(t, attack);
    const decayT = Math.max(0, t - attack);
    if (decayT > tau * 12) break;
    let f = typeof freq === 'function' ? freq(t) : freq;
    if (vibrato) f *= 1 + vibrato.depth(t) * Math.sin(2 * Math.PI * vibrato.rate * t);
    let sample = 0;
    for (let p = 0; p < partials.length; p++) {
      const [ratio, amp, decayMul = 1] = partials[p];
      const pf = f * ratio;
      if (pf >= NYQUIST * 0.9) continue;
      phases[p] += (2 * Math.PI * pf) / SAMPLE_RATE;
      sample += amp * Math.sin(phases[p]) * Math.exp(-decayT / (tau * decayMul));
    }
    out[i] += sample * a * gain;
  }
}

/**
 * FM çan: taşıyıcının fazı ikinci bir osilatörle modüle edilir. Modülasyon indeksi
 * zamanla azalır: vuruşta parlak, sonra yuvarlak ve sıcak ("kalp/çan" tınısı).
 */
function addFmBell(out, { start = 0, freq, ratio = 1, index = 1.2, indexTau = 0.12, attack = 0.005, tau = 0.35, gain = 1, detune = 0 }) {
  const first = Math.floor(start * SAMPLE_RATE);
  let pc = 0;
  let pm = 0;
  let pd = 0;
  for (let i = first; i < out.length; i++) {
    const t = (i - first) / SAMPLE_RATE;
    const decayT = Math.max(0, t - attack);
    if (decayT > tau * 12) break;
    const e = softAttack(t, attack) * Math.exp(-decayT / tau);
    const idx = index * Math.exp(-t / indexTau);
    pm += (2 * Math.PI * freq * ratio) / SAMPLE_RATE;
    pc += (2 * Math.PI * freq) / SAMPLE_RATE;
    let s = Math.sin(pc + idx * Math.sin(pm));
    if (detune) {
      // Hafif ikinci ses: tınıya canlılık (chorus) katar
      pd += (2 * Math.PI * freq * (1 + detune)) / SAMPLE_RATE;
      s = s * 0.75 + Math.sin(pd + idx * 0.8 * Math.sin(pm)) * 0.25;
    }
    out[i] += s * e * gain;
  }
}

/** Marimba / tahta tınısı: temel + hızla sönen uyumsuz üst partiyeller */
const MARIMBA = [
  [1, 1, 1],
  [3.93, 0.28, 0.22],
  [9.2, 0.06, 0.1],
];
/** Yumuşak, yuvarlak "şeker" tınısı: temel + yarım seviyede üst harmonik */
const ROUND = [
  [1, 1, 1],
  [2, 0.42, 0.55],
  [3, 0.12, 0.35],
];

/** Keçe/parmak ucu dokusu: alçak geçirgen, çok kısa gürültü */
function addFelt(out, { start = 0, cutoff = 1200, attack = 0.0015, tau = 0.006, gain = 0.2, seed = 7 }) {
  const noise = noiseSource(seed);
  const first = Math.floor(start * SAMPLE_RATE);
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
  let lp1 = 0;
  let lp2 = 0;
  for (let i = first; i < out.length; i++) {
    const t = (i - first) / SAMPLE_RATE;
    if (t > attack + tau * 10) break;
    lp1 += alpha * (noise() - lp1);
    lp2 += alpha * (lp1 - lp2);
    out[i] += lp2 * softAttack(t, attack) * Math.exp(-Math.max(0, t - attack) / tau) * gain;
  }
}

/** İki kademeli alçak geçiren (tizleri yumuşatır) */
function lowpass(out, cutoff) {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
  let a = 0;
  let b = 0;
  for (let i = 0; i < out.length; i++) {
    a += alpha * (out[i] - a);
    b += alpha * (a - b);
    out[i] = b;
  }
}

/**
 * Kısa oda yankısı: 10–30 ms'lik tarak filtreler + iki all-pass (Schroeder).
 * Yankının tizleri kısılır, sadece "boşluk" hissini doldurur.
 */
function room(out, { wet = 0.15, time = 0.35, damp = 2600 }) {
  const combDelays = [0.0113, 0.0167, 0.0229, 0.0293];
  const allpassDelays = [0.0051, 0.0017];
  const wetBuf = new Float32Array(out.length);
  for (const d of combDelays) {
    const n = Math.round(d * SAMPLE_RATE);
    const g = Math.pow(10, (-3 * d) / time);
    const line = new Float32Array(n);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const y = line[idx];
      line[idx] = out[i] + y * g;
      idx = (idx + 1) % n;
      wetBuf[i] += y / combDelays.length;
    }
  }
  for (const d of allpassDelays) {
    const n = Math.round(d * SAMPLE_RATE);
    const g = 0.5;
    const line = new Float32Array(n);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const x = wetBuf[i];
      const delayed = line[idx];
      const y = -g * x + delayed;
      line[idx] = x + g * y;
      idx = (idx + 1) % n;
      wetBuf[i] = y;
    }
  }
  lowpass(wetBuf, damp);
  for (let i = 0; i < out.length; i++) out[i] = out[i] * (1 - wet * 0.35) + wetBuf[i] * wet;
}

/** DC'yi temizler, sonu yumuşakça sıfıra indirir, tepeyi normalize eder */
function finish(out, { release = 0.03, peak = 0.89 } = {}) {
  // DC / çok pes gürültü: tek kutuplu yüksek geçiren (~40 Hz)
  const r = Math.exp((-2 * Math.PI * 40) / SAMPLE_RATE);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < out.length; i++) {
    const y = out[i] - prevX + r * prevY;
    prevX = out[i];
    prevY = y;
    out[i] = y;
  }
  const n = Math.min(out.length, Math.floor(release * SAMPLE_RATE));
  for (let i = 0; i < n; i++) out[out.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return out;
}

// ───────────────────────── Varyasyonlar ─────────────────────────
//
// sicak : (önerilen) FM çan + yuvarlak harmonikler; keçe dokunuşlu pes "pop"
// cam   : daha berrak, cam/kristal çanlar (FM oranı 3.5); damla gibi "blip" tık
// ahsap : her şey marimba/kalimba; tahta, içi boş ve sıcak

function bellFor(kind) {
  if (kind === 'cam') return (out, o) => addFmBell(out, { ratio: 3.5, index: 0.9, indexTau: 0.08, ...o, tau: (o.tau ?? 0.35) * 0.9 });
  if (kind === 'ahsap') return (out, o) => addTone(out, { freq: o.freq, start: o.start, attack: 0.004, tau: (o.tau ?? 0.35) * 0.7, partials: MARIMBA, gain: o.gain });
  return (out, o) => addFmBell(out, { ratio: 1, index: 1.3, indexTau: 0.11, detune: 0.0035, ...o });
}

function makeSounds(kind) {
  const bell = bellFor(kind);
  const wetMul = kind === 'cam' ? 1.25 : kind === 'ahsap' ? 0.8 : 1;

  return {
    /** Tuşlar, kart seçimi: en sık duyulan ses; yumuşak "pop" */
    tap() {
      const out = buffer(0.14);
      if (kind === 'cam') {
        // Su damlası: kısa, yukarı kayan yumuşak "blip"
        addTone(out, { freq: glide(380, 620, 0.012), attack: 0.003, tau: 0.02, partials: ROUND });
        addFelt(out, { cutoff: 1800, gain: 0.08 });
      } else if (kind === 'ahsap') {
        addTone(out, { freq: 440, attack: 0.0025, tau: 0.028, partials: MARIMBA });
        addFelt(out, { cutoff: 1400, gain: 0.12 });
      } else {
        // Parmak ucuyla yumuşak bir yüzeye dokunma: pes gövde + keçe dokusu
        // (Perde telefon hoparlörünün iyi çaldığı banda yakın: çok pes olursa telefonda kaybolur.)
        addTone(out, { freq: glide(540, 390, 0.01), attack: 0.003, tau: 0.024, partials: [[1, 1, 1], [2, 0.5, 0.6], [3, 0.16, 0.4]] });
        addFelt(out, { cutoff: 1500, attack: 0.002, tau: 0.005, gain: 0.14 });
      }
      lowpass(out, 3800);
      room(out, { wet: 0.07 * wetMul, time: 0.12 });
      return finish(out, { release: 0.04 });
    },

    /** = kısa basış: sıcak, tatlı "ding" */
    ding() {
      const out = buffer(1.0);
      bell(out, { freq: note('E5'), tau: 0.32 });
      addTone(out, { freq: note('E4'), attack: 0.006, tau: 0.22, partials: ROUND, gain: 0.28 });
      lowpass(out, 5200);
      room(out, { wet: 0.2 * wetMul, time: 0.45 });
      return finish(out, { release: 0.12 });
    },

    /** Basılı tutarken her kalp atışı: yumuşak "lub-dub" */
    pulse() {
      const out = buffer(0.22);
      const heart = [[1, 1, 1], [2, 0.6, 0.6], [3, 0.2, 0.4]];
      addTone(out, { freq: glide(360, 260, 0.02), attack: 0.005, tau: 0.03, partials: heart });
      addTone(out, { start: 0.085, freq: glide(320, 240, 0.02), attack: 0.005, tau: 0.028, partials: heart, gain: 0.5 });
      lowpass(out, 2400);
      room(out, { wet: 0.06 * wetMul, time: 0.15 });
      return finish(out, { release: 0.05 });
    },

    /** Menü / gizli ekran açılışı: yükselen yumuşak arpej + sıcak alt ses */
    unlock() {
      const out = buffer(1.3);
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
        bell(out, { start: i * 0.075, freq: note(n), tau: i === 3 ? 0.45 : 0.22, gain: 0.78 + i * 0.06 });
      });
      for (const n of ['C4', 'G4']) addTone(out, { start: 0.05, freq: note(n), attack: 0.06, tau: 0.45, partials: ROUND, gain: 0.16 });
      lowpass(out, 5000);
      room(out, { wet: 0.24 * wetMul, time: 0.6 });
      return finish(out, { release: 0.2 });
    },

    /** Kalp Sektirme: yumuşak, lastik gibi "boing" */
    boing() {
      const out = buffer(0.34);
      addTone(out, {
        freq: (t) => 240 + 230 * (1 - Math.exp(-t / 0.022)),
        attack: 0.004,
        tau: 0.085,
        partials: ROUND,
        vibrato: { rate: 17, depth: (t) => 0.06 * Math.exp(-t / 0.07) },
      });
      addFelt(out, { cutoff: 900, gain: 0.08 });
      lowpass(out, 2600);
      room(out, { wet: 0.08 * wetMul, time: 0.18 });
      return finish(out, { release: 0.06 });
    },

    /** Kalp Birleştir: iki yumuşak marimba notası (yukarı) */
    merge() {
      const out = buffer(0.42);
      const timbre = kind === 'cam' ? ROUND : MARIMBA;
      addTone(out, { freq: note('A4'), attack: 0.003, tau: 0.09, partials: timbre });
      addTone(out, { start: 0.055, freq: note('E5'), attack: 0.003, tau: 0.12, partials: timbre, gain: 0.9 });
      lowpass(out, 4200);
      room(out, { wet: 0.12 * wetMul, time: 0.3 });
      return finish(out, { release: 0.08 });
    },

    /** 2048: kutlama arpeji + yumuşak akor */
    win() {
      const out = buffer(1.7);
      ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => {
        bell(out, { start: i * 0.085, freq: note(n), tau: i === 4 ? 0.55 : 0.24, gain: 0.72 + i * 0.05 });
      });
      for (const n of ['C4', 'E4', 'G4']) addTone(out, { start: 0.3, freq: note(n), attack: 0.08, tau: 0.6, partials: ROUND, gain: 0.14 });
      lowpass(out, 5200);
      room(out, { wet: 0.26 * wetMul, time: 0.7 });
      return finish(out, { release: 0.3 });
    },

    /** Kalp Kulesi: blok oturunca yumuşak tahta "tok" */
    place() {
      const out = buffer(0.3);
      addTone(out, { freq: note('G4'), attack: 0.003, tau: 0.075, partials: MARIMBA });
      addTone(out, { freq: note('G3'), attack: 0.004, tau: 0.05, partials: [[1, 1], [2, 0.5, 0.6]], gain: 0.4 });
      addFelt(out, { cutoff: 1300, gain: 0.14, seed: 3 });
      lowpass(out, 3600);
      room(out, { wet: 0.1 * wetMul, time: 0.2 });
      return finish(out, { release: 0.06 });
    },

    /** Kalp Kulesi mükemmel: tahta vuruşun üstünde parlak ama yumuşak çan */
    perfect() {
      const out = buffer(1.05);
      addTone(out, { freq: note('G4'), attack: 0.003, tau: 0.07, partials: MARIMBA, gain: 0.4 });
      bell(out, { start: 0.01, freq: note('G5'), tau: 0.32 });
      bell(out, { start: 0.05, freq: note('D6'), tau: 0.26, gain: 0.45 });
      lowpass(out, 5400);
      room(out, { wet: 0.2 * wetMul, time: 0.5 });
      return finish(out, { release: 0.15 });
    },

    /** Yeni rekor: küçük, sıcak fanfar */
    record() {
      const out = buffer(1.55);
      ['G4', 'C5', 'E5'].forEach((n, i) => bell(out, { start: i * 0.09, freq: note(n), tau: 0.2, gain: 0.8 }));
      bell(out, { start: 0.27, freq: note('G5'), tau: 0.55 });
      addTone(out, {
        start: 0.27,
        freq: note('G4'),
        attack: 0.05,
        tau: 0.5,
        partials: ROUND,
        gain: 0.22,
        vibrato: { rate: 5.5, depth: (t) => 0.004 * Math.min(1, t / 0.2) },
      });
      addTone(out, { start: 0.27, freq: note('C4'), attack: 0.07, tau: 0.5, partials: ROUND, gain: 0.14 });
      lowpass(out, 5200);
      room(out, { wet: 0.25 * wetMul, time: 0.65 });
      return finish(out, { release: 0.28 });
    },
  };
}

const VARIANTS = ['sicak', 'cam', 'ahsap'];

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
  return Buffer.concat([wavHeader({ formatTag: 1, blockAlign: 2, bitsPerSample: 16, byteRate: SAMPLE_RATE * 2 }, data.length), data]);
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

/** Tek bir ADPCM kodunun çözümü (kodlayıcı ve SNR ölçümü aynı mantığı kullanır) */
function adpcmStep(predictor, index, code) {
  const step = STEP_TABLE[index];
  let delta = step >> 3;
  if (code & 4) delta += step;
  if (code & 2) delta += step >> 1;
  if (code & 1) delta += step >> 2;
  predictor = Math.max(-32768, Math.min(32767, predictor + (code & 8 ? -delta : delta)));
  index = Math.max(0, Math.min(88, index + INDEX_TABLE[code]));
  return [predictor, index];
}

function encodeAdpcm(samples) {
  const pcm = toInt16(samples);
  const blocks = Math.ceil(pcm.length / SAMPLES_PER_BLOCK);
  const data = Buffer.alloc(blocks * BLOCK_ALIGN);
  const decoded = new Int16Array(pcm.length);
  let index = 0;
  for (let b = 0; b < blocks; b++) {
    const base = b * SAMPLES_PER_BLOCK;
    const at = (i) => (base + i < pcm.length ? pcm[base + i] : 0);
    let predictor = at(0);
    if (base < pcm.length) decoded[base] = predictor;
    const off = b * BLOCK_ALIGN;
    data.writeInt16LE(predictor, off);
    data.writeUInt8(index, off + 2);
    data.writeUInt8(0, off + 3);
    for (let i = 1; i < SAMPLES_PER_BLOCK; i++) {
      // İleriye bakan seçim: bu kodu ve bir sonraki örneğin en iyi kodunu birlikte değerlendirir
      // (adım boyu uyumunun gelecekteki etkisini de hesaba katar → daha az sıkıştırma gürültüsü).
      const target = at(i);
      const nextTarget = i + 1 < SAMPLES_PER_BLOCK ? at(i + 1) : null;
      let best = 0;
      let bestErr = Infinity;
      for (let code = 0; code < 16; code++) {
        const [p, idx] = adpcmStep(predictor, index, code);
        let err = (target - p) ** 2;
        if (nextTarget !== null && err < bestErr) {
          let nextBest = Infinity;
          for (let c2 = 0; c2 < 16; c2++) {
            const [p2] = adpcmStep(p, idx, c2);
            nextBest = Math.min(nextBest, (nextTarget - p2) ** 2);
          }
          err += nextBest;
        }
        if (err < bestErr) {
          bestErr = err;
          best = code;
        }
      }
      [predictor, index] = adpcmStep(predictor, index, best);
      if (base + i < pcm.length) decoded[base + i] = predictor;
      const nibbleIndex = i - 1;
      const byteOff = off + 4 + (nibbleIndex >> 1);
      if (nibbleIndex & 1) data[byteOff] |= best << 4;
      else data[byteOff] = best;
    }
  }
  const extraBytes = Buffer.alloc(2);
  extraBytes.writeUInt16LE(SAMPLES_PER_BLOCK, 0);
  const header = wavHeader(
    { formatTag: 0x11, blockAlign: BLOCK_ALIGN, bitsPerSample: 4, byteRate: Math.round((SAMPLE_RATE * BLOCK_ALIGN) / SAMPLES_PER_BLOCK), extraBytes },
    data.length,
    { fact: pcm.length },
  );
  return { file: Buffer.concat([header, data]), pcm, decoded };
}

// ───────────────────────── Ölçümler ─────────────────────────

/** Spektral merkez (Hz): sesin "parlaklığı"; düşük = daha pes/sıcak (enerjiye göre ağırlıklı) */
function spectralCentroid(samples) {
  const N = 1024;
  const cos = new Float64Array(N);
  const sin = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / N);
    sin[i] = Math.sin((2 * Math.PI * i) / N);
  }
  let weighted = 0;
  let total = 0;
  const frame = new Float64Array(N);
  for (let startAt = 0; startAt < samples.length; startAt += N) {
    for (let i = 0; i < N; i++) frame[i] = (samples[startAt + i] ?? 0) * (0.5 - 0.5 * cos[i]);
    for (let k = 1; k < N / 2; k++) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < N; i++) {
        const j = (k * i) % N;
        re += frame[i] * cos[j];
        im -= frame[i] * sin[j];
      }
      const power = re * re + im * im;
      weighted += power * ((k * SAMPLE_RATE) / N);
      total += power;
    }
  }
  return total ? weighted / total : 0;
}

/** Telefon hoparlörü benzetimi: ~500 Hz altını kırpan 2 kademeli yüksek geçiren, sonra RMS (dBFS) */
function phoneDb(samples) {
  const r = Math.exp((-2 * Math.PI * 500) / SAMPLE_RATE);
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  const hp = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i] - x1 + r * y1;
    x1 = samples[i];
    y1 = a;
    const b = a - x2 + r * y2;
    x2 = a;
    y2 = b;
    hp[i] = b;
  }
  return rmsDb(hp);
}

function snr(pcm, decoded) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < pcm.length; i++) {
    s += pcm[i] * pcm[i];
    n += (pcm[i] - decoded[i]) ** 2;
  }
  return n ? 10 * Math.log10(s / n) : Infinity;
}

/** İlk 150 ms'nin RMS'i (dBFS): algılanan yüksekliğin kaba göstergesi */
function rmsDb(samples) {
  const n = Math.min(samples.length, Math.floor(0.15 * SAMPLE_RATE));
  let s = 0;
  for (let i = 0; i < n; i++) s += samples[i] * samples[i];
  return 10 * Math.log10(s / n);
}

// ───────────────────────── Yaz ─────────────────────────

function writeSet(kind, dir, pcmOnly) {
  mkdirSync(dir, { recursive: true });
  let total = 0;
  const rows = [];
  for (const [name, make] of Object.entries(makeSounds(kind))) {
    const samples = make();
    let file;
    let quality = '';
    if (pcmOnly) {
      file = encodePcm16(samples);
    } else {
      const encoded = encodeAdpcm(samples);
      file = encoded.file;
      quality = `ADPCM SNR ${snr(encoded.pcm, encoded.decoded).toFixed(1)} dB`;
    }
    writeFileSync(join(dir, `${name}.wav`), file);
    total += file.length;
    rows.push(
      `${name.padEnd(8)} ${(samples.length / SAMPLE_RATE).toFixed(2)} s  ${(file.length / 1024).toFixed(1).padStart(5)} KB  ` +
        `parlaklık ${Math.round(spectralCentroid(samples)).toString().padStart(4)} Hz  RMS ${rmsDb(samples).toFixed(1)} dB  telefonda ${phoneDb(samples).toFixed(1)} dB  ${quality}`,
    );
  }
  console.log(`[${kind}] → ${dir}\n  ${rows.join('\n  ')}\n  toplam ${(total / 1024).toFixed(1)} KB`);
}

if (flag('--measure')) {
  // Var olan PCM WAV'ların parlaklığını ölçer (eski/yeni karşılaştırması için)
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = option('--measure');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.wav')).sort()) {
    const b = readFileSync(join(dir, f));
    const samples = new Float32Array((b.length - 44) >> 1).map((_, i) => b.readInt16LE(44 + i * 2) / 32768);
    console.log(`${f.padEnd(12)} parlaklık ${Math.round(spectralCentroid(samples))} Hz  RMS ${rmsDb(samples).toFixed(1)} dB  telefonda ${phoneDb(samples).toFixed(1)} dB`);
  }
} else if (flag('--preview')) {
  for (const kind of VARIANTS) writeSet(kind, join(ROOT, 'design/sound-preview', kind), true);
} else {
  const kind = option('--variant') ?? DEFAULT_VARIANT;
  if (!VARIANTS.includes(kind)) throw new Error(`Bilinmeyen varyasyon: ${kind} (${VARIANTS.join(', ')})`);
  writeSet(kind, option('--out') ?? join(ROOT, 'src/assets/sounds'), flag('--pcm'));
}
