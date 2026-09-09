import type * as React from 'react';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // This primitive receives `htmlFor` from each form field at the call site.
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      data-slot="label"
      className={cn('text-sm font-semibold leading-none text-foreground', className)}
      {...props}
    />
  );
}

export { Label };
