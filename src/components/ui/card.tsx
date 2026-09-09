import type * as React from 'react';

import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-3xl border border-border bg-card text-card-foreground shadow-[0_24px_80px_rgb(0_0_0/24%)]',
        className,
      )}
      {...props}
    />
  );
}

export { Card };
