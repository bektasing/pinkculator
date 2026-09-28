import { getJSON, setJSON } from '../../platform/storage';
import { GAME_IDS, type GameId } from './types';

/**
 * Oyun başına en iyi skor. Menü kartları ve GameShell buradan okur;
 * değişiklikler abonelere bildirilir.
 */
type Listener = (gameId: GameId, best: number) => void;
const listeners = new Set<Listener>();

const key = (gameId: GameId) => `best:${gameId}`;

export async function getBest(gameId: GameId): Promise<number | null> {
  const value = await getJSON<unknown>(key(gameId), null);
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export async function getAllBest(): Promise<Record<GameId, number | null>> {
  const entries = await Promise.all(GAME_IDS.map(async (id) => [id, await getBest(id)] as const));
  return Object.fromEntries(entries) as Record<GameId, number | null>;
}

/** Yeni rekor mu? Sıfır skor asla rekor sayılmaz. */
export function isNewRecord(score: number, best: number | null): boolean {
  return score > 0 && score > (best ?? 0);
}

export async function submitScore(gameId: GameId, score: number): Promise<{ best: number | null; isNew: boolean }> {
  const previous = await getBest(gameId);
  if (!isNewRecord(score, previous)) return { best: previous, isNew: false };
  await setJSON(key(gameId), score);
  listeners.forEach((listener) => listener(gameId, score));
  return { best: score, isNew: true };
}

export function onRecordChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** GameShell göstergesi: en az 3 hane ("013") */
export function formatBest(best: number | null): string {
  return String(best ?? 0).padStart(3, '0');
}

/**
 * Skor biçimi: Türkçe yazımda 4 haneli sayılara nokta konmaz (görseldeki "2048"),
 * 5 ve daha fazla hanede binlik ayraç nokta olur ("12.480").
 */
export function formatScore(score: number): string {
  const digits = String(Math.trunc(score));
  return digits.length < 5 ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Menü kartı: "Rekor: 42" / hiç oynanmadıysa "Rekor: —" */
export function formatRecordLabel(best: number | null): string {
  return `Rekor: ${best === null ? '—' : formatScore(best)}`;
}
