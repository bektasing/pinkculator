/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeWav } from './wav';

const DIR = new URL('../assets/sounds/', import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith('.wav'));
const load = (name: string) => {
  const b = readFileSync(new URL(name, DIR));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

/** 16 bit PCM mono WAV üretir (test için) */
function pcmWav(samples: number[], rate = 8000): ArrayBuffer {
  const data = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + data));
  const put = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  put(0, 'RIFF'); view.setUint32(4, 36 + data, true); put(8, 'WAVE');
  put(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  put(36, 'data'); view.setUint32(40, data, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, v, true));
  return view.buffer;
}

describe('WAV çözücü', () => {
  it('16 bit PCM okur', () => {
    const { sampleRate, samples } = decodeWav(pcmWav([0, 16384, -32768, 32767]));
    expect(sampleRate).toBe(8000);
    expect(Array.from(samples)).toEqual([0, 0.5, -1, 32767 / 32768]);
  });

  it('WAV olmayan veriyi reddeder', () => {
    expect(() => decodeWav(new ArrayBuffer(16))).toThrow();
  });

  it('10 gömülü sesin hepsi var', () => {
    expect(files.sort()).toEqual(
      ['boing', 'ding', 'merge', 'perfect', 'place', 'pulse', 'record', 'tap', 'unlock', 'win'].map((n) => `${n}.wav`),
    );
  });

  it.each(files)('%s: ADPCM çözülür, süre ve seviye makul, kırpılma yok', (file) => {
    const { sampleRate, samples } = decodeWav(load(file));
    expect(sampleRate).toBe(16000);
    const seconds = samples.length / sampleRate;
    expect(seconds).toBeGreaterThan(0.05);
    expect(seconds).toBeLessThan(2);
    let peak = 0;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.6);
    expect(peak).toBeLessThan(1);
    // Sonu sessiz biter (tık sesi olmasın)
    expect(Math.abs(samples[samples.length - 1] ?? 1)).toBeLessThan(0.02);
  });

  it('ses dosyaları küçük (her biri < 16 KB, toplam < 80 KB)', () => {
    let total = 0;
    for (const file of files) {
      const size = readFileSync(new URL(file, DIR)).length;
      expect(size).toBeLessThan(16 * 1024);
      total += size;
    }
    expect(total).toBeLessThan(80 * 1024);
  });
});
