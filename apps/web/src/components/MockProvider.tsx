'use client';

import { useEffect, useState, type ReactNode } from 'react';

const enabled = process.env.NODE_ENV === 'development';

export function MockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    void import('@/mocks/browser')
      .then((module) => module.startMocking())
      .then(() => {
        setReady(true);
      });
  }, []);

  return ready ? children : null;
}
