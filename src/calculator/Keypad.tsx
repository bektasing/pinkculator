import type { CalculatorAction, Digit, Operator } from './engine';
import { HeartEqualsKey } from './HeartEqualsKey';
import { OperatorIcon, PlusMinusIcon } from './icons';
import { Key } from './Key';
import styles from './Keypad.module.css';

interface KeypadProps {
  clearLabel: 'AC' | 'C';
  activeOperator: Operator | null;
  onKey: (action: CalculatorAction, x: number, y: number) => void;
  onEquals: () => void;
  onOpenMenu: (origin: { x: number; y: number }) => void;
}

const OPERATOR_LABELS: Record<Operator, string> = {
  divide: 'Bölü',
  multiply: 'Çarpı',
  subtract: 'Eksi',
  add: 'Artı',
};

const ROWS: { digits: Digit[]; operator: Operator }[] = [
  { digits: ['7', '8', '9'], operator: 'multiply' },
  { digits: ['4', '5', '6'], operator: 'subtract' },
  { digits: ['1', '2', '3'], operator: 'add' },
];

export function Keypad({ clearLabel, activeOperator, onKey, onEquals, onOpenMenu }: KeypadProps) {
  const operatorKey = (operator: Operator) => (
    <Key
      key={operator}
      variant="op"
      ariaLabel={OPERATOR_LABELS[operator]}
      active={activeOperator === operator}
      onPress={(x, y) => onKey({ type: 'operator', operator }, x, y)}
    >
      <OperatorIcon operator={operator} />
    </Key>
  );

  const digitKey = (digit: Digit, className?: string) => (
    <Key
      key={digit}
      variant="num"
      ariaLabel={digit}
      className={className}
      onPress={(x, y) => onKey({ type: 'digit', digit }, x, y)}
    >
      {digit}
    </Key>
  );

  return (
    <div className={styles.keypad}>
      <Key
        variant="fn"
        ariaLabel={clearLabel === 'AC' ? 'Tümünü temizle' : 'Temizle'}
        onPress={(x, y) => onKey({ type: 'clear' }, x, y)}
      >
        <span className={styles.clearLabel}>{clearLabel}</span>
      </Key>
      <Key variant="fn" ariaLabel="İşaret değiştir" onPress={(x, y) => onKey({ type: 'toggleSign' }, x, y)}>
        <PlusMinusIcon />
      </Key>
      <Key variant="fn" ariaLabel="Yüzde" onPress={(x, y) => onKey({ type: 'percent' }, x, y)}>
        <span className={styles.percent}>%</span>
      </Key>
      {operatorKey('divide')}

      {ROWS.map((row) => [...row.digits.map((digit) => digitKey(digit)), operatorKey(row.operator)])}

      {digitKey('0', styles.zero)}
      <Key variant="num" ariaLabel="Virgül" onPress={(x, y) => onKey({ type: 'decimal' }, x, y)}>
        <span className={styles.comma}>,</span>
      </Key>
      <HeartEqualsKey onEquals={onEquals} onOpenMenu={onOpenMenu} />
    </div>
  );
}
