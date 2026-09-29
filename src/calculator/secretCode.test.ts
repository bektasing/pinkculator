import { describe, expect, it } from 'vitest';
import { calculatorReducer, initialState, type CalculatorAction, type CalculatorState, type Digit } from './engine';
import {
  SECRET_ENTRIES,
  findSecretEntry as findEntry,
  nextSecretMessage,
  pickMessageIndex,
  trackTypedDigits,
  type SecretEntry,
} from './secretCode';

/** Hesap makinesi durumu + CalculatorScreen'deki gibi takip edilen tuş dizisi */
interface Sim {
  state: CalculatorState;
  typed: string;
}
const start: Sim = { state: initialState, typed: '' };
const run = (sim: Sim, ...actions: CalculatorAction[]): Sim =>
  actions.reduce(
    (s, action) => ({ state: calculatorReducer(s.state, action), typed: trackTypedDigits(s.typed, s.state, action) }),
    sim,
  );
const typeDigits = (sim: Sim, digits: string) =>
  run(sim, ...[...digits].map((d): CalculatorAction => ({ type: 'digit', digit: d as Digit })));
const findSecretEntry = (sim: Sim) => findEntry(sim.state, sim.typed);
const initial = start;

describe('gizli kodlar', () => {
  it('üç giriş tanımlı, her birinin mesajı ve fotoğraf adı var', () => {
    expect(SECRET_ENTRIES.map((e) => e.code)).toEqual(['29062023', '08072008', '25062007']);
    for (const entry of SECRET_ENTRIES) {
      expect(entry.photo).toBe(`${entry.code}.jpg`);
      expect(entry.messages.length).toBeGreaterThan(1);
    }
  });

  it.each(['29062023', '08072008', '25062007'])('%s kendi girişini tetikler', (code) => {
    expect(findSecretEntry(typeDigits(initial, code))?.code).toBe(code);
  });

  it('baştaki sıfır: ekranda 8072008 görünür ama 0 ile yazıldığı için 08072008 eşleşir', () => {
    const s = typeDigits(initial, '08072008');
    expect(s.state.display).toBe('8072008');
    expect(findSecretEntry(s)?.code).toBe('08072008');
    // Sıfırsız yazılırsa tetiklenmez (tam eşleşme)
    expect(findSecretEntry(typeDigits(initial, '8072008'))).toBeNull();
  });

  it('kod eksik, fazla veya farklıysa tetiklenmez', () => {
    expect(findSecretEntry(typeDigits(initial, '2906202'))).toBeNull();
    expect(findSecretEntry(typeDigits(initial, '290620231'))).toBeNull();
    expect(findSecretEntry(typeDigits(initial, '29062024'))).toBeNull();
  });

  it('bekleyen bir işlem varsa tetiklenmez (5 + kod)', () => {
    for (const { code } of SECRET_ENTRIES) {
      const s = typeDigits(run(typeDigits(initial, '5'), { type: 'operator', operator: 'add' }), code);
      expect(findSecretEntry(s)).toBeNull();
    }
  });

  it('kod yazıldıktan sonra operatöre basıldıysa tetiklenmez', () => {
    expect(findSecretEntry(run(typeDigits(initial, '25062007'), { type: 'operator', operator: 'multiply' }))).toBeNull();
  });

  it('virgüllü, işaretli veya yüzdeli giriş tetiklemez', () => {
    for (const action of [{ type: 'decimal' }, { type: 'toggleSign' }, { type: 'percent' }] as CalculatorAction[]) {
      expect(findSecretEntry(run(typeDigits(initial, '29062023'), action))).toBeNull();
    }
  });

  it('önceki bir sonuçtan sonra yeni giriş olarak yazılırsa tetiklenir', () => {
    const afterResult = run(typeDigits(initial, '2'), { type: 'operator', operator: 'add' }, { type: 'digit', digit: '3' }, { type: 'equals' });
    expect(findSecretEntry(typeDigits(afterResult, '08072008'))?.code).toBe('08072008');
  });

  it('bir sonuç kodla aynı çıksa bile (hesaplanmış değer) tetiklenmez', () => {
    const s = run(typeDigits(initial, '29062022'), { type: 'operator', operator: 'add' }, { type: 'digit', digit: '1' }, { type: 'equals' });
    expect(s.state.display).toBe('29062023');
    expect(findSecretEntry(s)).toBeNull();
  });

  it('silme ile düzeltilip kod elde edilirse tetiklenir', () => {
    expect(findSecretEntry(run(typeDigits(initial, '250620079'), { type: 'backspace' }))?.code).toBe('25062007');
  });
});

describe('rastgele mesaj', () => {
  it('tek elemanlı listede hep 0', () => {
    expect(pickMessageIndex(1, null)).toBe(0);
    expect(pickMessageIndex(1, 0)).toBe(0);
  });

  it('son gösterilen hariç tutulur; kalanların hepsi seçilebilir', () => {
    // random'ın uç değerleriyle: kalan indekslerin tamamı kapsanır, `last` asla gelmez
    for (let count = 2; count <= 5; count++) {
      for (let last = 0; last < count; last++) {
        const seen = new Set<number>();
        for (const r of [0, 0.2, 0.4, 0.6, 0.8, 0.999999]) seen.add(pickMessageIndex(count, last, () => r));
        expect(seen.has(last)).toBe(false);
        expect(seen.size).toBe(count - 1);
      }
    }
  });

  it('ilk seçimde (geçmiş yok) tüm mesajlar seçilebilir', () => {
    const seen = new Set([0, 0.3, 0.6, 0.99].map((r) => pickMessageIndex(4, null, () => r)));
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it('1000 açılışta hiçbir mesaj art arda iki kez gelmez', () => {
    const entry: SecretEntry = { code: 'test-a', photo: '', messages: ['a', 'b', 'c'] };
    let previous = '';
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const message = nextSecretMessage(entry);
      expect(message).not.toBe(previous);
      counts.set(message, (counts.get(message) ?? 0) + 1);
      previous = message;
    }
    // Hepsi gösteriliyor ve dağılım makul
    for (const m of entry.messages) expect(counts.get(m)).toBeGreaterThan(200);
  });

  it('girişlerin geçmişi birbirinden bağımsız', () => {
    const a: SecretEntry = { code: 'test-b', photo: '', messages: ['x', 'y'] };
    const b: SecretEntry = { code: 'test-c', photo: '', messages: ['x', 'y'] };
    const first = nextSecretMessage(a, () => 0); // 'x'
    expect(first).toBe('x');
    // b'nin geçmişi yok: 'x' seçilebilir (a'nın 'x'i onu etkilemez)
    expect(nextSecretMessage(b, () => 0)).toBe('x');
    // a için 'x' art arda gelemez
    expect(nextSecretMessage(a, () => 0)).toBe('y');
  });
});

describe('tuş takibi', () => {
  it('işlem sonrası yeni sayı yazılınca dizi baştan başlar', () => {
    const s = typeDigits(run(typeDigits(initial, '12'), { type: 'operator', operator: 'add' }), '34');
    expect(s.typed).toBe('34');
  });

  it('= sonrası yazılan sayı yeni dizi başlatır', () => {
    const s = typeDigits(run(typeDigits(initial, '12'), { type: 'operator', operator: 'add' }, { type: 'digit', digit: '1' }, { type: 'equals' }), '29062023');
    expect(s.typed).toBe('29062023');
    expect(findSecretEntry(s)?.code).toBe('29062023');
  });

  it('C ile silinip yeniden yazılırsa eşleşir', () => {
    const s = typeDigits(run(typeDigits(initial, '999'), { type: 'clear' }), '25062007');
    expect(findSecretEntry(s)?.code).toBe('25062007');
  });

  it('başa fazladan sıfır eklenirse eşleşmez (0029062023)', () => {
    expect(findSecretEntry(typeDigits(initial, '0029062023'))).toBeNull();
  });
});
