import styles from './ResultView.module.css';

export function ResultFallback() {
  return (
    <main className={styles.page}>
      <div className={styles.fallback} aria-hidden="true" />
    </main>
  );
}
