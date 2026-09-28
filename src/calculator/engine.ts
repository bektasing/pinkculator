/**
 * Hesap makinesi motoru — UI'dan tamamen bağımsız, saf durum makinesi.
 * `calculatorReducer(state, action) → newState`
 *
 * Davranış iOS hesap makinesine yakındır: işlem önceliği yoktur, her operatör
 * basışında o ana kadarki işlem soldan sağa anında hesaplanır.
 */

export type Operator = 'add' | 'subtract' | 'multiply' | 'divide';

/**
 * Ekrandaki değerin kaynağı:
 * - `none`: başlangıç 0'ı veya hesaplanmış bir sonuç (üzerine rakam eklenmez)
 * - `typing`: kullanıcı rakam giriyor (rakamlar sona eklenir)
 * - `computed`: girilen sayıya % uygulandı; yeni rakam yeni sayı başlatır ama C ile silinebilir
 */
export type EntryMode = 'none' | 'typing' | 'computed';

export type ExpressionToken =
  | { kind: 'number'; value: number }
  | { kind: 'operator'; operator: Operator };

export interface CalculatorState {
  /** Ekrandaki değer, makine biçiminde: "-12.5", "0.", "1.5e+21" */
  display: string;
  entry: EntryMode;
  /** Bekleyen işlemin sol tarafı */
  accumulator: number | null;
  /** Bekleyen işlem */
  operator: Operator | null;
  /** Operatör seçildi, ikinci sayı henüz girilmedi (UI'da operatör vurgulanır) */
  awaitingOperand: boolean;
  /** Tekrarlı `=` için son işlem */
  lastOperation: { operator: Operator; operand: number } | null;
  /** Ekranın üstündeki küçük işlem satırı */
  expression: ExpressionToken[];
  /** Son tuş `=` idi (veya sonuç üzerinde ±/% yapıldı) */
  evaluated: boolean;
  /** Sıfıra bölme / taşma: ekranda "Tanımsız" */
  error: boolean;
}

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export type CalculatorAction =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'operator'; operator: Operator }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'toggleSign' }
  | { type: 'percent' }
  | { type: 'backspace' };

export const MAX_DIGITS = 12;
const SIGNIFICANT_DIGITS = 12;
const ERROR_TEXT = 'Tanımsız';
const MINUS = '−'; // "−" tipografik eksi

export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  add: '+',
  subtract: MINUS,
  multiply: '×',
  divide: '÷',
};

export const initialState: CalculatorState = {
  display: '0',
  entry: 'none',
  accumulator: null,
  operator: null,
  awaitingOperand: false,
  lastOperation: null,
  expression: [],
  evaluated: false,
  error: false,
};

// ───────────────────────── Sayısal yardımcılar ─────────────────────────

/** 12 anlamlı basamağa yuvarlar; kayan nokta artıklarını (0.30000000000000004) temizler. */
export function roundSignificant(value: number): number {
  if (value === 0 || !Number.isFinite(value)) return value === 0 ? 0 : value;
  const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS));
  return rounded === 0 ? 0 : rounded; // -0 → 0
}

function toMachine(value: number): string {
  return String(roundSignificant(value));
}

function countDigits(text: string): number {
  let count = 0;
  for (const ch of text) if (ch >= '0' && ch <= '9') count++;
  return count;
}

/** Sonuç sonlu değilse veya sıfıra bölme varsa `null`. */
export function applyOperator(a: number, operator: Operator, b: number): number | null {
  let result: number;
  switch (operator) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      if (b === 0) return null;
      result = a / b;
      break;
  }
  if (!Number.isFinite(result)) return null;
  return roundSignificant(result);
}

function displayValue(state: CalculatorState): number {
  const value = Number(state.display);
  return Number.isNaN(value) || value === 0 ? 0 : value;
}

const errorState: CalculatorState = { ...initialState, display: ERROR_TEXT, error: true };

// ───────────────────────── Reducer ─────────────────────────

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  // Hata ekranında herhangi bir tuş sıfırlar. Rakam ve virgül ayrıca yeni sayıyı başlatır.
  if (state.error) {
    if (action.type === 'digit' || action.type === 'decimal') {
      return calculatorReducer(initialState, action);
    }
    return initialState;
  }

  switch (action.type) {
    case 'digit':
      return inputDigit(state, action.digit);
    case 'decimal':
      return inputDecimal(state);
    case 'operator':
      return inputOperator(state, action.operator);
    case 'equals':
      return evaluate(state);
    case 'clear':
      return clear(state);
    case 'toggleSign':
      return toggleSign(state);
    case 'percent':
      return percent(state);
    case 'backspace':
      return backspace(state);
  }
}

/** Yeni bir sayı girişine başlanırken ekrandaki eski değer atılır. */
function startEntry(state: CalculatorState, display: string): CalculatorState {
  const base = state.evaluated ? initialState : state;
  return { ...base, display, entry: 'typing', awaitingOperand: false };
}

function inputDigit(state: CalculatorState, digit: Digit): CalculatorState {
  if (state.entry !== 'typing') return startEntry(state, digit);

  const { display } = state;
  if (display === '0') return { ...state, display: digit };
  if (display === '-0') return { ...state, display: `-${digit}` };
  if (countDigits(display) >= MAX_DIGITS) return state;
  return { ...state, display: display + digit };
}

function inputDecimal(state: CalculatorState): CalculatorState {
  if (state.entry !== 'typing') return startEntry(state, '0.');

  const { display } = state;
  if (display.includes('.') || countDigits(display) >= MAX_DIGITS) return state;
  return { ...state, display: `${display}.` };
}

function inputOperator(state: CalculatorState, operator: Operator): CalculatorState {
  // Art arda operatör: sadece son operatör geçerli.
  if (state.awaitingOperand && state.operator !== null) {
    const expression = state.expression.slice(0, -1);
    expression.push({ kind: 'operator', operator });
    return { ...state, operator, expression };
  }

  const value = displayValue(state);

  // Zincirleme işlem: bekleyen işlemi önce hesapla (2 + 3 × → 5).
  if (state.operator !== null && state.accumulator !== null) {
    const result = applyOperator(state.accumulator, state.operator, value);
    if (result === null) return errorState;
    return {
      ...state,
      display: toMachine(result),
      entry: 'none',
      accumulator: result,
      operator,
      awaitingOperand: true,
      expression: [
        ...state.expression,
        { kind: 'number', value },
        { kind: 'operator', operator },
      ],
      evaluated: false,
    };
  }

  return {
    ...state,
    entry: 'none',
    accumulator: value,
    operator,
    awaitingOperand: true,
    lastOperation: null,
    expression: [
      { kind: 'number', value },
      { kind: 'operator', operator },
    ],
    evaluated: false,
  };
}

function evaluate(state: CalculatorState): CalculatorState {
  if (state.operator !== null && state.accumulator !== null) {
    // "5 + =" → 5 + 5 (ekrandaki değer ikinci sayı olarak kullanılır)
    const operand = displayValue(state);
    const result = applyOperator(state.accumulator, state.operator, operand);
    if (result === null) return errorState;
    return {
      ...initialState,
      display: toMachine(result),
      lastOperation: { operator: state.operator, operand },
      expression: [...state.expression, { kind: 'number', value: operand }],
      evaluated: true,
    };
  }

  // Tekrarlı eşittir: 5 + 2 = = = → 7, 9, 11
  if (state.evaluated && state.lastOperation !== null) {
    const { operator, operand } = state.lastOperation;
    const left = displayValue(state);
    const result = applyOperator(left, operator, operand);
    if (result === null) return errorState;
    return {
      ...state,
      display: toMachine(result),
      entry: 'none',
      expression: [
        { kind: 'number', value: left },
        { kind: 'operator', operator },
        { kind: 'number', value: operand },
      ],
    };
  }

  return state;
}

function clear(state: CalculatorState): CalculatorState {
  // "C": sadece mevcut girişi sil; bekleyen işlem korunur ve operatör yeniden vurgulanır.
  if (clearLabel(state) === 'C') {
    return {
      ...state,
      display: '0',
      entry: 'none',
      awaitingOperand: state.operator !== null,
    };
  }
  // "AC": her şeyi sıfırla.
  return initialState;
}

function toggleSign(state: CalculatorState): CalculatorState {
  // Operatörden sonra ± → ikinci sayı "−0" olarak başlar.
  if (state.awaitingOperand) {
    return { ...state, display: '-0', entry: 'typing', awaitingOperand: false };
  }

  if (state.entry === 'typing' || (state.entry === 'none' && state.display === '0' && !state.evaluated)) {
    const display = state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`;
    return { ...state, display, entry: 'typing' };
  }

  // Hesaplanmış bir sonucun işaretini çevir.
  const negated = -displayValue(state);
  return {
    ...state,
    display: toMachine(negated),
    expression: state.evaluated ? [] : state.expression,
  };
}

function percent(state: CalculatorState): CalculatorState {
  const value = displayValue(state);
  let result: number;

  if ((state.operator === 'add' || state.operator === 'subtract') && state.accumulator !== null) {
    // a + b% → a + a·b/100
    result = roundSignificant((state.accumulator * value) / 100);
  } else {
    result = roundSignificant(value / 100);
  }

  if (state.evaluated) {
    return { ...state, display: toMachine(result), entry: 'none', expression: [] };
  }
  return {
    ...state,
    display: toMachine(result),
    entry: 'computed',
    awaitingOperand: false,
  };
}

function backspace(state: CalculatorState): CalculatorState {
  if (state.entry !== 'typing') return state;
  const trimmed = state.display.slice(0, -1);
  const display = trimmed === '' || trimmed === '-' ? '0' : trimmed;
  return { ...state, display };
}

// ───────────────────────── Seçiciler (UI için) ─────────────────────────

/** Temizleme tuşunun etiketi: girilmiş bir sayı varsa "C", yoksa "AC". */
export function clearLabel(state: CalculatorState): 'AC' | 'C' {
  if (state.error) return 'AC';
  return state.entry !== 'none' && state.display !== '0' ? 'C' : 'AC';
}

/** Vurgulanacak operatör (işlem seçilmiş, ikinci sayı henüz girilmemiş). */
export function activeOperator(state: CalculatorState): Operator | null {
  return state.awaitingOperand ? state.operator : null;
}

/** Büyük sonuç satırı, Türkçe biçimde. */
export function displayText(state: CalculatorState): string {
  if (state.error) return ERROR_TEXT;
  if (state.entry === 'typing') return formatEntry(state.display);
  return formatNumber(displayValue(state));
}

/** Üstteki küçük işlem satırı: "14 × 100,15" */
export function expressionText(state: CalculatorState): string {
  return state.expression
    .map((token) => (token.kind === 'number' ? formatNumber(token.value) : OPERATOR_SYMBOLS[token.operator]))
    .join(' ');
}

// ───────────────────────── Türkçe biçimlendirme ─────────────────────────

function groupThousands(integerDigits: string): string {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Yazılmakta olan girdiyi biçimlendirir; sondaki virgül ve sıfırlar korunur.
 * "1234.50" → "1.234,50", "0." → "0,", "-0" → "−0"
 */
export function formatEntry(raw: string): string {
  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const [integerPart = '0', fractionPart] = body.split('.');
  let text = groupThousands(integerPart);
  if (fractionPart !== undefined) text += `,${fractionPart}`;
  return negative ? MINUS + text : text;
}

const SCIENTIFIC_UPPER = 1e12;
const SCIENTIFIC_LOWER = 1e-6;
const SCIENTIFIC_MANTISSA_DECIMALS = 8;

function formatScientific(abs: number): string {
  const [mantissa = '0', exponent = '0'] = abs.toExponential(SCIENTIFIC_MANTISSA_DECIMALS).split('e');
  const trimmedMantissa = mantissa.replace(/\.?0+$/, '').replace('.', ',');
  const exp = Number(exponent);
  return `${trimmedMantissa}e${exp < 0 ? MINUS : ''}${Math.abs(exp)}`;
}

/**
 * Sayıyı Türkçe biçimde gösterir: binlik ayraç nokta, ondalık ayraç virgül.
 * Toplam en fazla 12 hane; sığmayan büyük/küçük sayılar bilimsel gösterime geçer.
 * 1402.1 → "1.402,1", -8 → "−8", 1.5e15 → "1,5e15"
 */
export function formatNumber(value: number): string {
  const rounded = roundSignificant(value);
  if (rounded === 0) return '0';

  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  let text: string | null = null;

  if (abs < SCIENTIFIC_UPPER && abs >= SCIENTIFIC_LOWER) {
    const integerDigits = Math.max(1, Math.floor(Math.log10(abs)) + 1);
    const decimals = Math.max(0, MAX_DIGITS - integerDigits);
    const fixed = abs.toFixed(decimals);
    const [integerPart = '0', fractionPart = ''] = fixed.split('.');
    // Yuvarlama tam sayı kısmını 12 hanenin üstüne taşıdıysa bilimsele geç.
    if (integerPart.length <= MAX_DIGITS) {
      const fraction = fractionPart.replace(/0+$/, '');
      text = groupThousands(integerPart) + (fraction ? `,${fraction}` : '');
      if (text === '0') text = null; // çok küçük değer 0'a yuvarlandıysa bilimsel göster
    }
  }

  text ??= formatScientific(abs);
  return negative ? MINUS + text : text;
}
