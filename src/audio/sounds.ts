import boingUrl from '../assets/sounds/boing.wav';
import dingUrl from '../assets/sounds/ding.wav';
import mergeUrl from '../assets/sounds/merge.wav';
import perfectUrl from '../assets/sounds/perfect.wav';
import placeUrl from '../assets/sounds/place.wav';
import pulseUrl from '../assets/sounds/pulse.wav';
import recordUrl from '../assets/sounds/record.wav';
import tapUrl from '../assets/sounds/tap.wav';
import unlockUrl from '../assets/sounds/unlock.wav';
import winUrl from '../assets/sounds/win.wav';
import { onAppPause, onAppResume } from '../platform/lifecycle';
import { decodeWav, type DecodedWav } from './wav';

/**
 * Ses efektleri (Web Audio). Dosyalar uygulamaya gömülüdür (scripts/generate-sounds.mjs
 * ile sentezlenir), internet gerekmez. Uygulama içinde ses ayarı yoktur; seviye telefonun
 * medya sesiyle ayarlanır.
 *
 * - AudioContext, tarayıcının "kullanıcı etkileşimi" kısıtlamasına takılmamak için ancak
 *   sayfaya ilk dokunulduktan sonra kurulur; o ana kadar `playSound` sessizce hiçbir şey yapmaz.
 * - Aynı ses üst üste çok kez tetiklenirse en eski kopya kısaca susturulur (ses bozulmaz),
 *   ana çıkıştaki yumuşak kompresör de toplam seviyenin patlamasını engeller.
 */

export type SoundName =
  | 'tap'
  | 'ding'
  | 'pulse'
  | 'unlock'
  | 'boing'
  | 'merge'
  | 'win'
  | 'place'
  | 'perfect'
  | 'record';

const URLS: Record<SoundName, string> = {
  tap: tapUrl,
  ding: dingUrl,
  pulse: pulseUrl,
  unlock: unlockUrl,
  boing: boingUrl,
  merge: mergeUrl,
  win: winUrl,
  place: placeUrl,
  perfect: perfectUrl,
  record: recordUrl,
};

/** Seslerin birbirine göre seviyesi: sık çalanlar en kısık, kutlamalar biraz daha belirgin. */
const VOLUMES: Record<SoundName, number> = {
  tap: 0.32,
  pulse: 0.3,
  ding: 0.46,
  place: 0.4,
  merge: 0.36,
  boing: 0.38,
  perfect: 0.44,
  unlock: 0.5,
  record: 0.52,
  win: 0.55,
};

/** Aynı sesin aynı anda en fazla kaç kopyası çalar */
const MAX_VOICES: Partial<Record<SoundName, number>> = { tap: 4, pulse: 2, place: 3, merge: 3, boing: 3 };
const DEFAULT_MAX_VOICES = 2;
/** Tüm uygulamanın genel seviyesi ("arka planda kalan" his) */
const MASTER_GAIN = 0.8;
/** Susturulan kopyanın sönme süresi (s) */
const STEAL_FADE_S = 0.012;

export interface PlayOptions {
  /** 0–1, sesin kendi seviyesine çarpan */
  volume?: number;
  /** Oynatma hızı (perde): 1 = orijinal */
  rate?: number;
  /** Perdede küçük rastgele sapma (ör. 0.03 = ±%3); sık çalan seslerde makine hissini kırar */
  jitter?: number;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

let context: AudioContext | null = null;
let master: GainNode | null = null;
const decoded = new Map<SoundName, DecodedWav>();
const buffers = new Map<SoundName, AudioBuffer>();
const voices = new Map<SoundName, Voice[]>();
let installed = false;

function hasUserActivation(): boolean {
  const activation = navigator.userActivation;
  return activation ? activation.hasBeenActive : true;
}

/** Dosyaları önceden indirip çözer (AudioContext gerekmez). */
function preload(): void {
  for (const name of Object.keys(URLS) as SoundName[]) {
    fetch(URLS[name])
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
      .then((data) => {
        decoded.set(name, decodeWav(data));
        if (context) createBuffer(name);
      })
      .catch(() => undefined); // ses yoksa uygulama sessiz çalışmaya devam eder
  }
}

function createBuffer(name: SoundName): void {
  const wav = decoded.get(name);
  if (!context || !wav || buffers.has(name)) return;
  const buffer = context.createBuffer(1, wav.samples.length, wav.sampleRate);
  buffer.copyToChannel(wav.samples as Float32Array<ArrayBuffer>, 0);
  buffers.set(name, buffer);
}

function ensureContext(): void {
  if (context || !hasUserActivation()) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    context = new Ctor({ latencyHint: 'interactive' });
  } catch {
    return;
  }
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;
  master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(compressor).connect(context.destination);
  for (const name of decoded.keys()) createBuffer(name);
}

function resume(): void {
  if (context && context.state === 'suspended' && !document.hidden) context.resume().catch(() => undefined);
}

/** Uygulama başlarken bir kez çağrılır. */
export function installSounds(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  preload();
  // Dokunmatikte tarayıcı etkileşimi parmak kalkınca sayar; her iki olayda da dene.
  const unlock = () => {
    ensureContext();
    resume();
    if (context?.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('pointerup', unlock, true);
    }
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('pointerup', unlock, true);

  // Arka planda ses motoru dursun (pil), dönünce devam etsin.
  onAppPause(() => {
    context?.suspend().catch(() => undefined);
  });
  onAppResume(resume);
}

function stopVoice(voice: Voice, when: number): void {
  try {
    voice.gain.gain.cancelScheduledValues(when);
    voice.gain.gain.setTargetAtTime(0, when, STEAL_FADE_S / 3);
    voice.source.stop(when + STEAL_FADE_S * 2);
  } catch {
    // zaten durmuş
  }
}

/** Sesi çalar. Ses motoru henüz hazır değilse (ilk dokunuştan önce) hiçbir şey yapmaz. */
export function playSound(name: SoundName, options: PlayOptions = {}): void {
  if (!context || !master) {
    ensureContext();
    if (!context || !master) return;
  }
  if (context.state !== 'running') {
    resume();
    return;
  }
  const buffer = buffers.get(name);
  if (!buffer) return;

  const now = context.currentTime;
  const active = voices.get(name) ?? [];
  const limit = MAX_VOICES[name] ?? DEFAULT_MAX_VOICES;
  while (active.length >= limit) {
    const oldest = active.shift();
    if (oldest) stopVoice(oldest, now);
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  const jitter = options.jitter ?? 0;
  source.playbackRate.value = (options.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter);

  const gain = context.createGain();
  gain.gain.value = VOLUMES[name] * Math.max(0, Math.min(1, options.volume ?? 1));
  source.connect(gain).connect(master);

  const voice: Voice = { source, gain };
  active.push(voice);
  voices.set(name, active);
  source.onended = () => {
    const list = voices.get(name);
    const index = list?.indexOf(voice) ?? -1;
    if (list && index >= 0) list.splice(index, 1);
    source.disconnect();
    gain.disconnect();
  };
  source.start(now);
}
