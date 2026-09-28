import { describe, expect, it } from 'vitest';
import {
  activeOperator,
  applyOperator,
  calculatorReducer,
  clearLabel,
  displayText,
  expressionText,
  formatEntry,
  formatNumber,
  initialState,
  roundSignificant,
  type CalculatorAction,
  type CalculatorState,
  type Digit,
} from './engine';

/**
 * Tuş dizisini motora uygular. Boşlukla ayrılmış tuşlar:
 * rakamlar (çok haneli yazılabilir: "100,15"), "," "+" "−" "×" "÷" "=" "C" "±" "%" "⌫"
 */
function press(keys: string, from: CalculatorState = initialState): CalculatorState {
  let state = from;
  for (const token of keys.split(' ').filter(Boolean)) {
    for (const action of toActions(token)) state = calculatorReducer(state, action);
  }
  return state;
}

function toActions(token: string): CalculatorAction[] {
  switch (token) {
    case '+':
      return [{ type: 'operator', operator: 'add' }];
    case '−':
      return [{ type: 'operator', operator: 'subtract' }];
    case '×':
      return [{ type: 'operator', operator: 'multiply' }];
    case '÷':
      return [{ type: 'operator', operator: 'divide' }];
    case '=':
      return [{ type: 'equals' }];
    case 'C':
      return [{ type: 'clear' }];
    case '±':
      return [{ type: 'toggleSign' }];
    case '%':
      return [{ type: 'percent' }];
    case '⌫':
      return [{ type: 'backspace' }];
  }
  return [...token].map((ch): CalculatorAction => {
    if (ch === ',') return { type: 'decimal' };
    if (ch >= '0' && ch <= '9') return { type: 'digit', digit: ch as Digit };
    throw new Error(`Bilinmeyen tuş: ${ch}`);
  });
}

const show = (keys: string) => displayText(press(keys));

describe('rakam girişi', () => {
  it('başlangıçta ekran 0 ve tuş AC', () => {
    expect(displayText(initialState)).toBe('0');
    expect(clearLabel(initialState)).toBe('AC');
    expect(expressionText(initialState)).toBe('');
  });

  it('baştaki 0 yerine yeni rakam yazılır', () => {
    expect(show('0 0 7')).toBe('7');
  });

  it('çok haneli giriş binlik ayraçla gösterilir', () => {
    expect(show('1234567')).toBe('1.234.567');
  });

  it('en fazla 12 hane kabul edilir', () => {
    expect(show('1234567890123')).toBe('123.456.789.012');
  });

  it('12 hane sınırına ondalık haneler de dahildir', () => {
    expect(show('12345678901,234')).toBe('12.345.678.901,2');
  });

  it('12 hane dolduktan sonra virgül eklenmez', () => {
    expect(show('123456789012 ,')).toBe('123.456.789.012');
  });
});

describe('virgül', () => {
  it('ondalık sayı girilir', () => {
    expect(show('1,5')).toBe('1,5');
  });

  it('bir sayıda tek virgül olur', () => {
    expect(show('1,,5,2')).toBe('1,52');
  });

  it('boş ekranda virgül "0," ile başlar', () => {
    expect(show(',')).toBe('0,');
    expect(show(',5')).toBe('0,5');
  });

  it('işlemden sonra basılan virgül "0," ile başlar', () => {
    expect(show('5 + ,')).toBe('0,');
    expect(show('5 + ,5 =')).toBe('5,5');
  });

  it('sonuçtan sonra basılan virgül yeni sayıyı "0," ile başlatır', () => {
    const state = press('5 + 2 = ,');
    expect(displayText(state)).toBe('0,');
    expect(expressionText(state)).toBe('');
  });

  it('yazarken sondaki sıfırlar korunur', () => {
    expect(show('1,50')).toBe('1,50');
  });
});

describe('dört işlem', () => {
  it('toplama', () => {
    expect(show('2 + 3 =')).toBe('5');
  });

  it('çıkarma ve negatif sonuç', () => {
    expect(show('3 − 11 =')).toBe('−8');
  });

  it('çarpma ve ifade satırı (görseldeki örnek)', () => {
    const state = press('14 × 100,15 =');
    expect(displayText(state)).toBe('1.402,1');
    expect(expressionText(state)).toBe('14 × 100,15');
  });

  it('bölme', () => {
    expect(show('1 ÷ 4 =')).toBe('0,25');
  });
});

describe('zincirleme işlemler', () => {
  it('ikinci operatörde önceki işlem hesaplanır (2 + 3 × → 5)', () => {
    const state = press('2 + 3 ×');
    expect(displayText(state)).toBe('5');
    expect(expressionText(state)).toBe('2 + 3 ×');
  });

  it('işlem önceliği yoktur, soldan sağa hesaplanır (2 + 3 × 4 = 20)', () => {
    const state = press('2 + 3 × 4 =');
    expect(displayText(state)).toBe('20');
    expect(expressionText(state)).toBe('2 + 3 × 4');
  });

  it('uzun zincir', () => {
    expect(show('10 − 4 ÷ 2 × 5 + 1 =')).toBe('16');
  });

  it('art arda operatöre basılırsa son operatör geçerli olur', () => {
    const state = press('6 + − × 2 =');
    expect(displayText(state)).toBe('12');
    expect(expressionText(state)).toBe('6 × 2');
  });

  it('sonuç üzerinden işleme devam edilir', () => {
    const state = press('5 + 2 = × 3 =');
    expect(displayText(state)).toBe('21');
    expect(expressionText(state)).toBe('7 × 3');
  });
});

describe('aktif operatör', () => {
  it('operatör seçilip ikinci sayı girilmediyse aktiftir', () => {
    expect(activeOperator(press('5 +'))).toBe('add');
  });

  it('ikinci sayı girilmeye başlayınca vurgu kalkar', () => {
    expect(activeOperator(press('5 + 3'))).toBeNull();
  });

  it('operatör değiştirilince aktif operatör güncellenir', () => {
    expect(activeOperator(press('5 + ÷'))).toBe('divide');
  });

  it('eşittirden sonra aktif operatör yoktur', () => {
    expect(activeOperator(press('5 + 3 ='))).toBeNull();
  });
});

describe('eşittir', () => {
  it('tekrar basılırsa son işlem tekrarlanır (5 + 2 = = = → 7, 9, 11)', () => {
    const first = press('5 + 2 =');
    const second = press('=', first);
    const third = press('=', second);
    expect(displayText(first)).toBe('7');
    expect(displayText(second)).toBe('9');
    expect(displayText(third)).toBe('11');
    expect(expressionText(third)).toBe('9 + 2');
  });

  it('ikinci sayı girilmeden = basılırsa ekrandaki sayı kullanılır (5 + = → 10)', () => {
    expect(show('5 + =')).toBe('10');
  });

  it('tek bir sayıda = hiçbir şey değiştirmez', () => {
    expect(show('5 =')).toBe('5');
  });

  it('= sonrası ifade kalır, yeni giriş başlayınca temizlenir', () => {
    const done = press('5 + 2 =');
    expect(expressionText(done)).toBe('5 + 2');
    const next = press('3', done);
    expect(displayText(next)).toBe('3');
    expect(expressionText(next)).toBe('');
  });

  it('sonuçtan sonra başlayan yeni sayıda = eski işlemi tekrarlamaz', () => {
    expect(show('5 + 2 = 3 =')).toBe('3');
  });
});

describe('AC / C', () => {
  it('girilmiş bir sayı varken tuş "C" olur', () => {
    expect(clearLabel(press('5'))).toBe('C');
    expect(clearLabel(press('5 + 3'))).toBe('C');
  });

  it('C sadece mevcut girişi siler, bekleyen işlem korunur', () => {
    const state = press('5 + 3 C');
    expect(displayText(state)).toBe('0');
    expect(clearLabel(state)).toBe('AC');
    expect(activeOperator(state)).toBe('add');
    expect(expressionText(state)).toBe('5 +');
    expect(show('5 + 3 C 2 =')).toBe('7');
  });

  it('C sonrası AC her şeyi sıfırlar', () => {
    expect(press('5 + 3 C C')).toEqual(initialState);
  });

  it('sonuç gösterilirken tuş "AC" olur ve her şeyi sıfırlar', () => {
    const done = press('5 + 2 =');
    expect(clearLabel(done)).toBe('AC');
    expect(press('C', done)).toEqual(initialState);
  });
});

describe('± işaret değiştirme', () => {
  it('girilen sayının işaretini çevirir, ikinci basışta geri alır', () => {
    expect(show('5 ±')).toBe('−5');
    expect(show('5 ± ±')).toBe('5');
  });

  it('boş ekranda "−0" ile başlar ve rakam yazılabilir', () => {
    expect(show('±')).toBe('−0');
    expect(show('± 5')).toBe('−5');
  });

  it('operatörden sonra basılırsa ikinci sayı negatif başlar', () => {
    const state = press('5 × ± 3 =');
    expect(displayText(state)).toBe('−15');
    expect(expressionText(state)).toBe('5 × −3');
  });

  it('sonucun işaretini çevirir, ardından = son işlemi tekrarlar', () => {
    const negated = press('5 + 2 = ±');
    expect(displayText(negated)).toBe('−7');
    expect(displayText(press('=', negated))).toBe('−5');
  });
});

describe('% yüzde', () => {
  it('tek başına sayıyı 100e böler', () => {
    expect(show('50 %')).toBe('0,5');
  });

  it('toplamada a + b% → a + a·b/100', () => {
    expect(show('200 + 10 %')).toBe('20');
    expect(show('200 + 10 % =')).toBe('220');
  });

  it('çıkarmada a − b% → a − a·b/100', () => {
    expect(show('200 − 10 % =')).toBe('180');
  });

  it('çarpma ve bölmede b% sadece b/100 olur', () => {
    expect(show('200 × 10 % =')).toBe('20');
    expect(show('200 ÷ 50 % =')).toBe('400');
  });

  it('% uygulanan girişte tuş "C" olur, yeni rakam yeni sayı başlatır', () => {
    expect(clearLabel(press('200 + 10 %'))).toBe('C');
    expect(show('50 % 7')).toBe('7');
  });
});

describe('sıfıra bölme', () => {
  it('ekranda "Tanımsız" yazar', () => {
    const state = press('5 ÷ 0 =');
    expect(displayText(state)).toBe('Tanımsız');
    expect(state.error).toBe(true);
  });

  it('zincirleme işlemde de yakalanır', () => {
    expect(show('5 ÷ 0 +')).toBe('Tanımsız');
  });

  it('0 ÷ 0 da tanımsızdır', () => {
    expect(show('0 ÷ 0 =')).toBe('Tanımsız');
  });

  it('hatadan sonra herhangi bir tuş sıfırlar', () => {
    for (const key of ['+', '=', 'C', '±', '%', '⌫']) {
      expect(press(`5 ÷ 0 = ${key}`)).toEqual(initialState);
    }
  });

  it('hatadan sonra basılan rakam yeni sayıyı başlatır', () => {
    const state = press('5 ÷ 0 = 7');
    expect(displayText(state)).toBe('7');
    expect(state.error).toBe(false);
    expect(expressionText(state)).toBe('');
  });

  it('sayı taşması (sonsuz) da "Tanımsız" olur', () => {
    // 999.999.999.999'u sürekli kendisiyle çarp: ~26 adımda sayı sonsuza taşar.
    let state = press('999999999999 × =');
    let steps = 0;
    while (!state.error && steps < 40) {
      state = press('=', state);
      steps++;
    }
    expect(steps).toBeGreaterThan(20);
    expect(displayText(state)).toBe('Tanımsız');
  });
});

describe('kayan nokta hataları gizlenir', () => {
  it('0,1 + 0,2 = 0,3', () => {
    expect(show('0,1 + 0,2 =')).toBe('0,3');
  });

  it('0,3 − 0,1 = 0,2', () => {
    expect(show('0,3 − 0,1 =')).toBe('0,2');
  });

  it('1,1 × 3 = 3,3', () => {
    expect(show('1,1 × 3 =')).toBe('3,3');
  });

  it('1 ÷ 3 ekrana sığacak şekilde yuvarlanır', () => {
    expect(show('1 ÷ 3 =')).toBe('0,33333333333');
  });

  it('sonuçlar 12 anlamlı basamağa yuvarlanır', () => {
    expect(roundSignificant(0.1 + 0.2)).toBe(0.3);
    expect(roundSignificant(1 / 3)).toBe(0.333333333333);
    expect(applyOperator(0.1, 'add', 0.2)).toBe(0.3);
  });
});

describe('bilimsel gösterim', () => {
  it('12 haneyi aşan büyük sonuçlar bilimsel gösterilir', () => {
    expect(show('123456789 × 10000 =')).toBe('1,23456789e12');
    expect(show('1000000 × 1000000 =')).toBe('1e12');
  });

  it('en büyük 12 haneli sayı normal gösterilir', () => {
    expect(show('999999999999 × 1 =')).toBe('999.999.999.999');
  });

  it('çok küçük sonuçlar bilimsel gösterilir (negatif üs)', () => {
    expect(show('1 ÷ 10000000 =')).toBe('1e−7');
  });

  it('negatif büyük sayı', () => {
    expect(show('1000000 × 1000000 = ±')).toBe('−1e12');
  });
});

describe('silme (kaydırma → backspace)', () => {
  it('son haneyi siler', () => {
    expect(show('123 ⌫')).toBe('12');
  });

  it('tek hane silinince 0 olur ve tuş AC olur', () => {
    const state = press('5 ⌫');
    expect(displayText(state)).toBe('0');
    expect(clearLabel(state)).toBe('AC');
  });

  it('virgülü de siler', () => {
    expect(show('1,5 ⌫')).toBe('1,');
    expect(show('1,5 ⌫ ⌫')).toBe('1');
  });

  it('negatif tek hane silinince 0 olur', () => {
    expect(show('5 ± ⌫')).toBe('0');
  });

  it('hesaplanmış sonuç silinemez', () => {
    expect(show('5 + 2 = ⌫')).toBe('7');
    expect(show('5 + ⌫')).toBe('5');
  });
});

describe('Türkçe biçimlendirme', () => {
  it.each([
    [1402, '1.402'],
    [100.15, '100,15'],
    [-8, '−8'],
    [1234567.891, '1.234.567,891'],
    [0.5, '0,5'],
    [0, '0'],
    [-0, '0'],
    [999, '999'],
    [1000, '1.000'],
  ])('formatNumber(%s) → %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  it.each([
    ['1234.50', '1.234,50'],
    ['0.', '0,'],
    ['-0', '−0'],
    ['-1234', '−1.234'],
  ])('formatEntry(%s) → %s', (raw, expected) => {
    expect(formatEntry(raw)).toBe(expected);
  });
});
