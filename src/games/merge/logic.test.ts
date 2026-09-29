import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canMove,
  fromSaved,
  maxTile,
  newGame,
  spawnTile,
  toSaved,
  type Direction,
  type MergeState,
  type Random,
  type Tile,
} from './logic';

/** Sayı ızgarasından (0 = boş) durum kurar. */
function board(rows: number[][], score = 0, won = false): MergeState {
  const tiles: Tile[] = [];
  let id = 1;
  rows.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value) tiles.push({ id: id++, value, row: r, col: c });
    }),
  );
  return { tiles, score, nextId: id, won };
}

/** Durumu sayı ızgarasına çevirir. */
function grid(state: MergeState): number[][] {
  const g = Array.from({ length: 4 }, () => Array<number>(4).fill(0));
  for (const t of state.tiles) g[t.row]![t.col] = t.value;
  return g;
}

/** Yeni taşın nereye geldiğini testlerden gizlemek için: spawn'ı hariç tutan ızgara. */
function gridWithoutSpawn(outcome: NonNullable<ReturnType<typeof applyMove>>): number[][] {
  const g = grid(outcome.state);
  if (outcome.spawned) g[outcome.spawned.row]![outcome.spawned.col] = 0;
  return g;
}

/** Sabit dizi döndüren rastgele kaynak */
function seq(...values: number[]): Random {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

const noSpawnAt0: Random = seq(0.99, 0.5); // son boş hücre, değer 2

function move(rows: number[][], dir: Direction) {
  return applyMove(board(rows), dir, noSpawnAt0);
}

describe('kayma', () => {
  it('taşlar kaydırma yönündeki kenara kayar', () => {
    const out = move(
      [
        [0, 0, 2, 0],
        [0, 4, 0, 0],
        [0, 0, 0, 0],
        [8, 0, 0, 0],
      ],
      'left',
    );
    expect(out).not.toBeNull();
    expect(gridWithoutSpawn(out!)).toEqual([
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
      [8, 0, 0, 0],
    ]);
  });

  it('dört yönün hepsi doğru kenara kaydırır', () => {
    const start = [
      [0, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const pos = (dir: Direction) => {
      const out = move(start, dir)!;
      const t = out.state.tiles.find((x) => x.id === 1)!;
      return [t.row, t.col];
    };
    expect(pos('left')).toEqual([1, 0]);
    expect(pos('right')).toEqual([1, 3]);
    expect(pos('up')).toEqual([0, 1]);
    expect(pos('down')).toEqual([3, 1]);
  });

  it('hareket bilgisi her taşın nereden nereye gittiğini verir', () => {
    const out = move([[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')!;
    expect(out.movements).toEqual([
      { id: 1, value: 2, fromRow: 0, fromCol: 3, toRow: 0, toCol: 0, mergedInto: null },
    ]);
  });
});

describe('birleşme', () => {
  it('aynı değerli iki taş birleşir', () => {
    const out = move([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')!;
    expect(gridWithoutSpawn(out)[0]).toEqual([4, 0, 0, 0]);
    expect(out.merged).toHaveLength(1);
    expect(out.merged[0]!.value).toBe(4);
  });

  it('aralarında boşluk olan eşit taşlar da birleşir', () => {
    const out = move([[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right')!;
    expect(gridWithoutSpawn(out)[0]).toEqual([0, 0, 0, 4]);
  });

  it('bir hamlede bir taş en fazla bir kez birleşir: [2,2,2,2] → [4,4]', () => {
    const out = move([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')!;
    expect(gridWithoutSpawn(out)[0]).toEqual([4, 4, 0, 0]);
  });

  it('yeni oluşan taş aynı hamlede tekrar birleşmez: [4,4,8,0] → [8,8]', () => {
    const out = move([[4, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')!;
    expect(gridWithoutSpawn(out)[0]).toEqual([8, 8, 0, 0]);
  });

  it('birleşme kaydırma yönündeki kenardan başlar: [2,2,2,0] sağa → [0,0,2,4]', () => {
    const out = move([[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right')!;
    expect(gridWithoutSpawn(out)[0]).toEqual([0, 0, 2, 4]);
  });

  it('[2,2,4,4] → [4,8] ve skor birleşen taşların toplamı kadar artar', () => {
    const out = applyMove(board([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 100), 'left', noSpawnAt0)!;
    expect(gridWithoutSpawn(out)[0]).toEqual([4, 8, 0, 0]);
    expect(out.gained).toBe(12);
    expect(out.state.score).toBe(112);
  });

  it('birleşen iki taş hedefte kaybolur ve yeni taşa işaret eder', () => {
    const out = move([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')!;
    const newId = out.merged[0]!.id;
    expect(out.movements.map((m) => m.mergedInto)).toEqual([newId, newId]);
    expect(out.movements.every((m) => m.toRow === 0 && m.toCol === 0)).toBe(true);
    expect(out.state.tiles.some((t) => t.id === 1 || t.id === 2)).toBe(false);
  });

  it('sütunlarda da doğru birleşir (yukarı)', () => {
    const out = move(
      [
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [4, 0, 0, 0],
        [4, 0, 0, 0],
      ],
      'up',
    )!;
    expect(gridWithoutSpawn(out).map((r) => r[0])).toEqual([4, 8, 0, 0]);
  });
});

describe('geçersiz hamle ve yeni taş', () => {
  it('hiçbir şey değişmeyen hamle geçersizdir ve yeni taş gelmez', () => {
    const state = board([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(applyMove(state, 'left', noSpawnAt0)).toBeNull();
    expect(applyMove(state, 'up', noSpawnAt0)).toBeNull();
  });

  it('geçerli her hamleden sonra boş bir hücreye tam olarak bir taş gelir', () => {
    const out = move([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right')!;
    expect(out.spawned).not.toBeNull();
    expect(out.state.tiles).toHaveLength(2);
    expect(out.state.tiles.filter((t) => t.row === out.spawned!.row && t.col === out.spawned!.col)).toHaveLength(1);
  });

  it('yeni taş %90 ihtimalle 2, %10 ihtimalle 4 olur', () => {
    expect(spawnTile([], 1, seq(0, 0.89))!.value).toBe(2);
    expect(spawnTile([], 1, seq(0, 0.9))!.value).toBe(4);
    let fours = 0;
    let seed = 12345;
    const lcg: Random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let i = 0; i < 10000; i++) if (spawnTile([], 1, lcg)!.value === 4) fours++;
    expect(fours / 10000).toBeGreaterThan(0.08);
    expect(fours / 10000).toBeLessThan(0.12);
  });

  it('yeni oyun iki taşla başlar, skor sıfırdır', () => {
    const state = newGame(seq(0.1, 0.5, 0.7, 0.2));
    expect(state.tiles).toHaveLength(2);
    expect(state.score).toBe(0);
    expect(new Set(state.tiles.map((t) => `${t.row},${t.col}`)).size).toBe(2);
  });
});

describe('oyun sonu ve 2048', () => {
  const full = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];

  it('dolu ve komşu eşit taş yoksa hamle kalmamıştır', () => {
    expect(canMove(board(full).tiles)).toBe(false);
  });

  it('dolu ama yan yana eşit taş varsa hamle vardır', () => {
    const rows = full.map((r) => [...r]);
    rows[3]![3] = 4; // (3,2) ile aynı
    expect(canMove(board(rows).tiles)).toBe(true);
  });

  it('boş hücre varsa hamle vardır', () => {
    const rows = full.map((r) => [...r]);
    rows[0]![0] = 0;
    expect(canMove(board(rows).tiles)).toBe(true);
  });

  it('son hamleden sonra hamle kalmadıysa sonuç "over" olur', () => {
    const out = applyMove(
      board([
        [4, 2, 4, 0],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]),
      'right',
      seq(0, 0.5),
    );
    // İlk satır sağa kayar → [_,4,2,4]; tek boş hücre (0,0)'a 2 gelir → hiç hamle kalmaz
    expect(out).not.toBeNull();
    expect(grid(out!.state)[0]).toEqual([2, 4, 2, 4]);
    expect(out!.over).toBe(true);
  });

  it('hamle kalan tahtada sonuç "over" değildir', () => {
    const out = move([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right')!;
    expect(out.over).toBe(false);
  });

  it('2048 ilk kez oluştuğunda bir kez bildirilir', () => {
    const out = move([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')!;
    expect(out.reachedWin).toBe(true);
    expect(out.state.won).toBe(true);

    const again = applyMove(
      board([[1024, 1024, 0, 0], [2048, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 0, true),
      'left',
      noSpawnAt0,
    )!;
    expect(again.reachedWin).toBe(false);
  });

  it('2048 sonrası oyun devam edebilir (4096+)', () => {
    const out = applyMove(board([[2048, 2048, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 0, true), 'left', noSpawnAt0)!;
    expect(maxTile(out.state.tiles)).toBe(4096);
  });
});

describe('kayıt', () => {
  it('kaydedilen oyun aynen geri yüklenir', () => {
    const state = board([[2, 0, 4, 0], [0, 8, 0, 0], [0, 0, 16, 0], [2048, 0, 0, 2]], 3120, true);
    const restored = fromSaved(JSON.parse(JSON.stringify(toSaved(state))))!;
    expect(grid(restored)).toEqual(grid(state));
    expect(restored.score).toBe(3120);
    expect(restored.won).toBe(true);
    expect(new Set(restored.tiles.map((t) => t.id)).size).toBe(restored.tiles.length);
    expect(restored.nextId).toBeGreaterThan(Math.max(...restored.tiles.map((t) => t.id)));
  });

  it('bozuk veya eski kayıt reddedilir', () => {
    expect(fromSaved(null)).toBeNull();
    expect(fromSaved({ v: 2, cells: [], score: 0 })).toBeNull();
    expect(fromSaved({ v: 1, cells: Array(16).fill(3), score: 0, won: false })).toBeNull();
    expect(fromSaved({ v: 1, cells: Array(15).fill(0), score: 0, won: false })).toBeNull();
    expect(fromSaved({ v: 1, cells: Array(16).fill(0), score: 0, won: false })).toBeNull();
    expect(fromSaved({ v: 1, cells: Array(16).fill(2), score: -5, won: false })).toBeNull();
  });
});
