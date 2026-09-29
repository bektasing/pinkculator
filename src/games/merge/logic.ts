/**
 * Kalp Birleştir (2048) oyun mantığı — saf, UI'dan bağımsız, test edilebilir.
 *
 * Kurallar:
 * - Kaydırma yönünde taşlar kayar; aynı değerli iki komşu taş birleşir.
 * - Bir hamlede bir taş en fazla bir kez birleşir ([2,2,2,2] → [4,4], [4,4,8] → [8,8]).
 * - Her geçerli hamleden sonra boş bir hücreye %90 ihtimalle 2, %10 ihtimalle 4 gelir.
 * - Hiçbir taşın yerinin değişmediği hamle geçersizdir; yeni taş gelmez.
 * - Skor: birleşmelerde oluşan yeni taşların toplam değeri.
 *
 * Her taşın kalıcı bir `id`'si vardır; animasyon katmanı hangi taşın nereden nereye
 * gittiğini bu sayede bilir.
 */

export const SIZE = 4;
export const WIN_VALUE = 2048;

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
}

export interface MergeState {
  tiles: Tile[];
  score: number;
  nextId: number;
  /** 2048'e ulaşıldı mı (kart bir kez gösterilir) */
  won: boolean;
}

/** Eski bir taşın bu hamledeki hareketi. `mergedInto` doluysa hedefte kaybolur. */
export interface Movement {
  id: number;
  value: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  mergedInto: number | null;
}

export interface MoveOutcome {
  state: MergeState;
  movements: Movement[];
  /** Birleşmeden doğan yeni taşlar */
  merged: Tile[];
  spawned: Tile | null;
  gained: number;
  /** Bu hamlede ilk kez 2048 oluştu */
  reachedWin: boolean;
  /** Hamleden sonra oynanabilir hamle kalmadı */
  over: boolean;
}

/** [0, 1) aralığında sayı üreten rastgele kaynak (testlerde deterministik verilir). */
export type Random = () => number;

type Grid = (Tile | null)[][];

function toGrid(tiles: readonly Tile[]): Grid {
  const grid: Grid = Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
  for (const tile of tiles) {
    const row = grid[tile.row];
    if (row) row[tile.col] = tile;
  }
  return grid;
}

function emptyCells(tiles: readonly Tile[]): [number, number][] {
  const grid = toGrid(tiles);
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r]?.[c]) cells.push([r, c]);
  return cells;
}

/** Boş bir hücreye yeni taş koyar; boş hücre yoksa null. */
export function spawnTile(tiles: readonly Tile[], id: number, random: Random): Tile | null {
  const cells = emptyCells(tiles);
  if (cells.length === 0) return null;
  const cell = cells[Math.min(cells.length - 1, Math.floor(random() * cells.length))];
  if (!cell) return null;
  return { id, value: random() < 0.9 ? 2 : 4, row: cell[0], col: cell[1] };
}

export function newGame(random: Random): MergeState {
  let state: MergeState = { tiles: [], score: 0, nextId: 1, won: false };
  for (let i = 0; i < 2; i++) {
    const tile = spawnTile(state.tiles, state.nextId, random);
    if (tile) state = { ...state, tiles: [...state.tiles, tile], nextId: state.nextId + 1 };
  }
  return state;
}

/** Hamle yönünde okunacak hücre dizileri: her dizinin ilk elemanı taşların yığıldığı kenar. */
function lines(direction: Direction): [number, number][][] {
  const result: [number, number][][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: [number, number][] = [];
    for (let j = 0; j < SIZE; j++) {
      switch (direction) {
        case 'left':
          line.push([i, j]);
          break;
        case 'right':
          line.push([i, SIZE - 1 - j]);
          break;
        case 'up':
          line.push([j, i]);
          break;
        case 'down':
          line.push([SIZE - 1 - j, i]);
          break;
      }
    }
    result.push(line);
  }
  return result;
}

/**
 * Hamleyi uygular. Geçersizse (hiçbir taş yer değiştirmediyse) null döner.
 * Geçerliyse yeni taş eklenmiş durumu ve animasyon için hareket bilgisini döner.
 */
export function applyMove(state: MergeState, direction: Direction, random: Random): MoveOutcome | null {
  const grid = toGrid(state.tiles);
  let nextId = state.nextId;
  const movements: Movement[] = [];
  const merged: Tile[] = [];
  const tiles: Tile[] = [];
  let gained = 0;
  let moved = false;

  for (const line of lines(direction)) {
    // Bu satırdaki taşlar, yığılma kenarından başlayarak
    const items = line.map(([r, c]) => grid[r]?.[c] ?? null).filter((t): t is Tile => t !== null);
    let slot = 0;
    let last: { tile: Tile; row: number; col: number; mergeable: boolean } | null = null;

    for (const tile of items) {
      if (last && last.mergeable && last.tile.value === tile.value) {
        // Birleşme: iki taş hedefte kaybolur, yerine değeri iki katı yeni bir taş doğar.
        const value = tile.value * 2;
        const newTile: Tile = { id: nextId++, value, row: last.row, col: last.col };
        const previous = tiles.pop();
        if (previous) {
          const prevMove = movements.find((m) => m.id === previous.id);
          if (prevMove) prevMove.mergedInto = newTile.id;
        }
        movements.push({
          id: tile.id,
          value: tile.value,
          fromRow: tile.row,
          fromCol: tile.col,
          toRow: last.row,
          toCol: last.col,
          mergedInto: newTile.id,
        });
        tiles.push(newTile);
        merged.push(newTile);
        gained += value;
        moved = true;
        last = { tile: newTile, row: last.row, col: last.col, mergeable: false };
        continue;
      }

      const target = line[slot++];
      if (!target) continue;
      const [row, col] = target;
      if (row !== tile.row || col !== tile.col) moved = true;
      movements.push({
        id: tile.id,
        value: tile.value,
        fromRow: tile.row,
        fromCol: tile.col,
        toRow: row,
        toCol: col,
        mergedInto: null,
      });
      const placed: Tile = { ...tile, row, col };
      tiles.push(placed);
      last = { tile: placed, row, col, mergeable: true };
    }
  }

  if (!moved) return null;

  const spawned = spawnTile(tiles, nextId, random);
  if (spawned) {
    tiles.push(spawned);
    nextId++;
  }

  const reachedWin = !state.won && merged.some((t) => t.value >= WIN_VALUE);
  const next: MergeState = {
    tiles,
    score: state.score + gained,
    nextId,
    won: state.won || reachedWin,
  };

  return { state: next, movements, merged, spawned, gained, reachedWin, over: !canMove(tiles) };
}

/** Oynanabilir hamle var mı: boş hücre ya da yan yana aynı değerli iki taş. */
export function canMove(tiles: readonly Tile[]): boolean {
  if (tiles.length < SIZE * SIZE) return true;
  const grid = toGrid(tiles);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r]?.[c]?.value;
      if (value === undefined) return true;
      if (grid[r]?.[c + 1]?.value === value || grid[r + 1]?.[c]?.value === value) return true;
    }
  }
  return false;
}

export function maxTile(tiles: readonly Tile[]): number {
  return tiles.reduce((max, t) => Math.max(max, t.value), 0);
}

// ───────────────────────── Kayıt ─────────────────────────

/** Kalıcı kayıt biçimi: 16 hücrelik dizi (0 = boş) ve skor. */
export interface SavedGame {
  v: 1;
  cells: number[];
  score: number;
  won: boolean;
}

export function toSaved(state: MergeState): SavedGame {
  const cells = Array<number>(SIZE * SIZE).fill(0);
  for (const t of state.tiles) cells[t.row * SIZE + t.col] = t.value;
  return { v: 1, cells, score: state.score, won: state.won };
}

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

/** Kaydı doğrular ve oyuna çevirir; bozuk kayıtta null döner. */
export function fromSaved(saved: unknown): MergeState | null {
  if (!saved || typeof saved !== 'object') return null;
  const s = saved as Partial<SavedGame>;
  if (s.v !== 1 || !Array.isArray(s.cells) || s.cells.length !== SIZE * SIZE) return null;
  if (typeof s.score !== 'number' || !Number.isFinite(s.score) || s.score < 0) return null;
  const tiles: Tile[] = [];
  let id = 1;
  for (let i = 0; i < s.cells.length; i++) {
    const value = s.cells[i];
    if (value === 0) continue;
    if (typeof value !== 'number' || !isPowerOfTwo(value)) return null;
    tiles.push({ id: id++, value, row: Math.floor(i / SIZE), col: i % SIZE });
  }
  if (tiles.length === 0) return null;
  return { tiles, score: s.score, nextId: id, won: Boolean(s.won) };
}
