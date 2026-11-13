'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import styles from './BackToTop.module.css';

/** Scroll distance after which the top of the page counts as out of view. */
const SHOW_AFTER_PX = 400;

export function BackToTop() {
  const t = useTranslations('Result');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
      {t('backToTop')}
    </button>
  );
}
