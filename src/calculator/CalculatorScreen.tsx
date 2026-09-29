import { useCallback, useRef, useState } from 'react';
import { playSound } from '../audio/sounds';
import { heartBurst } from '../effects/heartBurst';
import { impactHeavy, impactLight, notifyError } from '../platform/haptics';
import { Display } from './Display';
import {
  activeOperator,
  calculatorReducer,
  clearLabel,
  displayText,
  expressionText,
  initialState,
  type CalculatorAction,
} from './engine';
import { Keypad } from './Keypad';
import { findSecretEntry, trackTypedDigits, type SecretEntry } from './secretCode';
import styles from './CalculatorScreen.module.css';

interface CalculatorScreenProps {
  onOpenMenu: (origin: { x: number; y: number }) => void;
  /** Gizli kodlardan biri yazılıp = kısa basıldığında (bkz. secretCode.ts) */
  onOpenSecret: (origin: { x: number; y: number }, entry: SecretEntry) => void;
}

/** Patlamadan sonra gizli ekrana geçişe kadar kısa bekleme (menü açılışıyla aynı) */
const SECRET_DELAY_MS = 160;

export function CalculatorScreen({ onOpenMenu, onOpenSecret }: CalculatorScreenProps) {
  const [state, setState] = useState(initialState);
  // Durum ref'te de tutulur: çok hızlı art arda basışlarda her tuş en güncel duruma uygulanır.
  const stateRef = useRef(state);
  // Basılan rakamlar (gizli kodlar için; ekran baştaki sıfırı göstermez)
  const typedRef = useRef('');

  const dispatch = useCallback((action: CalculatorAction) => {
    const previous = stateRef.current;
    const next = calculatorReducer(previous, action);
    typedRef.current = trackTypedDigits(typedRef.current, previous, action);
    stateRef.current = next;
    setState(next);
    return !previous.error && next.error;
  }, []);

  const handleKey = useCallback(
    (action: CalculatorAction, x: number, y: number) => {
      heartBurst(x, y, 'tap');
      // Rakamlar biraz daha parlak, fonksiyon/operatör tuşları biraz daha tok.
      playSound('tap', { rate: action.type === 'digit' || action.type === 'decimal' ? 1 : 0.86, jitter: 0.03 });
      const becameError = dispatch(action);
      if (becameError) notifyError();
      else impactLight();
    },
    [dispatch],
  );

  const secretOpening = useRef(false);
  const handleEquals = useCallback(
    (origin: { x: number; y: number }) => {
      if (secretOpening.current) return;
      const secret = findSecretEntry(stateRef.current, typedRef.current);
      if (secret) {
        // Normal hesaplama yapılmaz: güçlü titreşim, büyük kalp patlaması, sonra gizli ekran.
        secretOpening.current = true;
        impactHeavy();
        playSound('unlock');
        heartBurst(origin.x, origin.y, 'grand');
        window.setTimeout(() => onOpenSecret(origin, secret), SECRET_DELAY_MS);
        return;
      }
      playSound('ding');
      if (dispatch({ type: 'equals' })) notifyError();
    },
    [dispatch, onOpenSecret],
  );

  const handleSwipe = useCallback(() => {
    const before = stateRef.current;
    dispatch({ type: 'backspace' });
    if (stateRef.current !== before) impactLight();
  }, [dispatch]);

  return (
    <div className={styles.root}>
      <div className={styles.displayArea}>
        <Display expression={expressionText(state)} result={displayText(state)} onSwipe={handleSwipe} />
      </div>
      <Keypad
        clearLabel={clearLabel(state)}
        activeOperator={activeOperator(state)}
        onKey={handleKey}
        onEquals={handleEquals}
        onOpenMenu={onOpenMenu}
      />
    </div>
  );
}
