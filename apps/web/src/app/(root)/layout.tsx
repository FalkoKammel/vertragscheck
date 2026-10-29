import type { ReactNode } from 'react';

export default function RootRedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
