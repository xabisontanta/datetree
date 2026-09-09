import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-transparent px-5 text-base font-semibold transition duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_14px_36px_color-mix(in_oklch,var(--primary)_26%,transparent)] hover:-translate-y-0.5 hover:bg-primary/90',
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/80',
        ghost: 'text-foreground hover:bg-foreground/6',
      },
      size: {
        default: 'min-h-12 px-5',
        sm: 'min-h-10 px-4 text-sm',
        lg: 'min-h-14 px-7 text-base',
        icon: 'size-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
