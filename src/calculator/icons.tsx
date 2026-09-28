import type { Operator } from './engine';

// Operatör ve ± simgeleri: yuvarlak uçlu kalın çizgiler, görseldeki dolgun stile uygun.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.15,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function OperatorIcon({ operator }: { operator: Operator }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      {operator === 'add' && <path d="M12 5.5v13M5.5 12h13" {...stroke} />}
      {operator === 'subtract' && <path d="M5.5 12h13" {...stroke} />}
      {operator === 'multiply' && <path d="M7 7l10 10M17 7L7 17" {...stroke} />}
      {operator === 'divide' && (
        <>
          <path d="M5.5 12h13" {...stroke} />
          <circle cx="12" cy="6.9" r="1.45" fill="currentColor" />
          <circle cx="12" cy="17.1" r="1.45" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function PlusMinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path d="M12 4.6v8.6M7.7 8.9h8.6M7.4 18h9.2" {...stroke} strokeWidth={1.9} />
    </svg>
  );
}
