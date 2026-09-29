/**
 * Gömülü ses dosyalarını çözen küçük WAV okuyucu.
 *
 * Sesler 4 bit IMA ADPCM WAV olarak saklanır (16 bit PCM'in ~dörtte biri boyutunda).
 * Tarayıcıların `decodeAudioData`'sı bu biçimi desteklemediği için çözüm burada yapılır;
 * 16 bit PCM WAV da desteklenir. Çıktı: −1…1 aralığında mono örnekler.
 */

export interface DecodedWav {
  sampleRate: number;
  samples: Float32Array;
}

const FORMAT_PCM = 1;
const FORMAT_IMA_ADPCM = 0x11;

const STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060,
  1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132,
  7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];
const INDEX_TABLE = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

interface Format {
  tag: number;
  channels: number;
  sampleRate: number;
  blockAlign: number;
  bitsPerSample: number;
  samplesPerBlock: number;
}

export function decodeWav(input: ArrayBuffer): DecodedWav {
  const view = new DataView(input);
  const text = (offset: number) => String.fromCharCode(...new Uint8Array(input, offset, 4));
  if (view.byteLength < 12 || text(0) !== 'RIFF' || text(8) !== 'WAVE') throw new Error('WAV değil');

  let format: Format | null = null;
  let totalSamples = 0;
  let dataOffset = -1;
  let dataLength = 0;

  for (let offset = 12; offset + 8 <= view.byteLength; ) {
    const id = text(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      const tag = view.getUint16(body, true);
      format = {
        tag,
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        blockAlign: view.getUint16(body + 12, true),
        bitsPerSample: view.getUint16(body + 14, true),
        samplesPerBlock: tag === FORMAT_IMA_ADPCM && size >= 20 ? view.getUint16(body + 18, true) : 0,
      };
    } else if (id === 'fact') {
      totalSamples = view.getUint32(body, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = Math.min(size, view.byteLength - body);
    }
    offset = body + size + (size & 1);
  }

  if (!format || dataOffset < 0) throw new Error('WAV başlığı eksik');
  if (format.channels !== 1) throw new Error('Sadece mono WAV desteklenir');

  if (format.tag === FORMAT_PCM && format.bitsPerSample === 16) {
    const count = dataLength >> 1;
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
    return { sampleRate: format.sampleRate, samples };
  }

  if (format.tag === FORMAT_IMA_ADPCM && format.bitsPerSample === 4) {
    const { blockAlign } = format;
    const perBlock = format.samplesPerBlock || (blockAlign - 4) * 2 + 1;
    const blocks = Math.floor(dataLength / blockAlign);
    const count = totalSamples || blocks * perBlock;
    const samples = new Float32Array(count);
    let n = 0;
    for (let b = 0; b < blocks && n < count; b++) {
      const offset = dataOffset + b * blockAlign;
      let predictor = view.getInt16(offset, true);
      let index = Math.min(88, view.getUint8(offset + 2));
      samples[n++] = predictor / 32768;
      for (let i = 0; i < perBlock - 1 && n < count; i++) {
        const byte = view.getUint8(offset + 4 + (i >> 1));
        const code = i & 1 ? byte >> 4 : byte & 0x0f;
        const step = STEP_TABLE[index] as number;
        let delta = step >> 3;
        if (code & 4) delta += step;
        if (code & 2) delta += step >> 1;
        if (code & 1) delta += step >> 2;
        predictor += code & 8 ? -delta : delta;
        if (predictor > 32767) predictor = 32767;
        else if (predictor < -32768) predictor = -32768;
        index += INDEX_TABLE[code] as number;
        if (index < 0) index = 0;
        else if (index > 88) index = 88;
        samples[n++] = predictor / 32768;
      }
    }
    return { sampleRate: format.sampleRate, samples };
  }

  throw new Error(`Desteklenmeyen WAV biçimi: ${format.tag}/${format.bitsPerSample}`);
}
