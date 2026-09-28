import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('../../platform/storage', () => ({
  getJSON: async (key: string, fallback: unknown) => (store.has(key) ? JSON.parse(store.get(key) as string) : fallback),
  setJSON: async (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
  },
}));

const { formatBest, formatRecordLabel, getBest, isNewRecord, onRecordChange, submitScore } = await import('./records');

describe('rekor kaydı', () => {
  beforeEach(() => store.clear());

  it('hiç oynanmamış oyunun rekoru yoktur', async () => {
    expect(await getBest('bounce')).toBeNull();
  });

  it('ilk pozitif skor rekor olur ve kaydedilir', async () => {
    expect(await submitScore('bounce', 12)).toEqual({ best: 12, isNew: true });
    expect(await getBest('bounce')).toBe(12);
  });

  it('düşük veya eşit skor rekoru değiştirmez', async () => {
    await submitScore('stack', 20);
    expect(await submitScore('stack', 20)).toEqual({ best: 20, isNew: false });
    expect(await submitScore('stack', 5)).toEqual({ best: 20, isNew: false });
  });

  it('sıfır skor rekor sayılmaz', async () => {
    expect(isNewRecord(0, null)).toBe(false);
    expect(await submitScore('merge', 0)).toEqual({ best: null, isNew: false });
  });

  it('oyunların rekorları birbirinden bağımsızdır', async () => {
    await submitScore('bounce', 42);
    expect(await getBest('merge')).toBeNull();
  });

  it('yeni rekor abonelere bildirilir', async () => {
    const seen: [string, number][] = [];
    const off = onRecordChange((id, best) => seen.push([id, best]));
    await submitScore('bounce', 3);
    await submitScore('bounce', 1);
    off();
    expect(seen).toEqual([['bounce', 3]]);
  });

  it('gösterge 3 haneli, menü etiketi Türkçe biçimli', () => {
    expect(formatBest(null)).toBe('000');
    expect(formatBest(13)).toBe('013');
    expect(formatBest(2048)).toBe('2048');
    expect(formatRecordLabel(null)).toBe('Rekor: —');
    expect(formatRecordLabel(42)).toBe('Rekor: 42');
    expect(formatRecordLabel(2048)).toBe('Rekor: 2048');
    expect(formatRecordLabel(12480)).toBe('Rekor: 12.480');
  });
});
