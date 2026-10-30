'use client';

import { Button, type ButtonProps } from '@mantine/core';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type LinkButtonProps = ButtonProps & {
  href: ComponentProps<typeof Link>['href'];
  children: ReactNode;
};

export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  );
}
