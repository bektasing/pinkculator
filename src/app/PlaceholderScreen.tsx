import styles from './PlaceholderScreen.module.css';

// Aşama 3'te gerçek menü ve oyun ekranlarıyla değiştirilecek geçici ekran.
export function PlaceholderScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className={styles.root}>
      <button type="button" className={styles.back} onPointerDown={onBack} aria-label="Geri">
        ‹
      </button>
      <h1 className={styles.title}>{title}</h1>
    </div>
  );
}
