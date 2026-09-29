import { describe, expect, it } from 'vitest';
import { calculatorReducer, initialState, type CalculatorAction, type CalculatorState, type Digit } from './engine';
import { SECRET_CODE, isSecretEntry } from './secretCode';

const typeDigits = (state: CalculatorState, digits: string) =>
  [...digits].reduce((s, d) => calculatorReducer(s, { type: 'digit', digit: d as Digit }), state);
const run = (state: CalculatorState, ...actions: CalculatorAction[]) => actions.reduce(calculatorReducer, state);

describe('gizli kod', () => {
  it('sadece kod yazılınca tetiklenir', () => {
    expect(isSecretEntry(typeDigits(initialState, SECRET_CODE))).toBe(true);
  });

  it('kod eksik, fazla veya farklıysa tetiklenmez', () => {
    expect(isSecretEntry(typeDigits(initialState, SECRET_CODE.slice(0, -1)))).toBe(false);
    expect(isSecretEntry(typeDigits(initialState, SECRET_CODE + '1'))).toBe(false);
    expect(isSecretEntry(typeDigits(initialState, '29062024'))).toBe(false);
  });

  it('bekleyen bir işlem varsa tetiklenmez (5 + 29062023)', () => {
    const s = typeDigits(run(typeDigits(initialState, '5'), { type: 'operator', operator: 'add' }), SECRET_CODE);
    expect(isSecretEntry(s)).toBe(false);
  });

  it('kod yazıldıktan sonra operatöre basıldıysa tetiklenmez', () => {
    const s = run(typeDigits(initialState, SECRET_CODE), { type: 'operator', operator: 'multiply' });
    expect(isSecretEntry(s)).toBe(false);
  });

  it('virgüllü, işaretli veya yüzdeli giriş tetiklemez', () => {
    expect(isSecretEntry(run(typeDigits(initialState, SECRET_CODE), { type: 'decimal' }))).toBe(false);
    expect(isSecretEntry(run(typeDigits(initialState, SECRET_CODE), { type: 'toggleSign' }))).toBe(false);
    expect(isSecretEntry(run(typeDigits(initialState, SECRET_CODE), { type: 'percent' }))).toBe(false);
  });

  it('önceki bir sonuçtan sonra yeni giriş olarak yazılırsa tetiklenir', () => {
    const afterResult = run(typeDigits(initialState, '2'), { type: 'operator', operator: 'add' }, { type: 'digit', digit: '3' }, { type: 'equals' });
    expect(isSecretEntry(typeDigits(afterResult, SECRET_CODE))).toBe(true);
  });

  it('bir sonuç kodla aynı çıksa bile (hesaplanmış değer) tetiklenmez', () => {
    const s = run(typeDigits(initialState, '29062022'), { type: 'operator', operator: 'add' }, { type: 'digit', digit: '1' }, { type: 'equals' });
    expect(s.display).toBe(SECRET_CODE);
    expect(isSecretEntry(s)).toBe(false);
  });

  it('silme ile düzeltilip kod elde edilirse tetiklenir', () => {
    const s = run(typeDigits(initialState, SECRET_CODE + '9'), { type: 'backspace' });
    expect(isSecretEntry(s)).toBe(true);
  });
});
