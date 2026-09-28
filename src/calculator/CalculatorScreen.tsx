import { useCallback, useRef, useState } from 'react';
import { heartBurst } from '../effects/heartBurst';
import { impactLight, notifyError } from '../platform/haptics';
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
import styles from './CalculatorScreen.module.css';

interface CalculatorScreenProps {
  onOpenMenu: (origin: { x: number; y: number }) => void;
}

export function CalculatorScreen({ onOpenMenu }: CalculatorScreenProps) {
  const [state, setState] = useState(initialState);
  // Durum ref'te de tutulur: çok hızlı art arda basışlarda her tuş en güncel duruma uygulanır.
  const stateRef = useRef(state);

  const dispatch = useCallback((action: CalculatorAction) => {
    const previous = stateRef.current;
    const next = calculatorReducer(previous, action);
    stateRef.current = next;
    setState(next);
    return !previous.error && next.error;
  }, []);

  const handleKey = useCallback(
    (action: CalculatorAction, x: number, y: number) => {
      heartBurst(x, y, 'tap');
      const becameError = dispatch(action);
      if (becameError) notifyError();
      else impactLight();
    },
    [dispatch],
  );

  const handleEquals = useCallback(() => {
    if (dispatch({ type: 'equals' })) notifyError();
  }, [dispatch]);

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
