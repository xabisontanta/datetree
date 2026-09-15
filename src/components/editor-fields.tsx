import { Input } from '@/components/ui/input';
import { useId, type ComponentProps, type ReactNode } from 'react';

export function Field({
  label,
  help,
  ...props
}: ComponentProps<'input'> & { label: string; help?: string }) {
  const id = useId();
  return (
    <div className="dt-field">
      <label htmlFor={id}>{label}</label>
      <Input id={id} aria-describedby={help ? `${id}-help` : undefined} {...props} />
      {help && <small id={`${id}-help`}>{help}</small>}
    </div>
  );
}
export function TextArea({
  label,
  ...props
}: ComponentProps<'textarea'> & { label: string }) {
  const id = useId();
  return (
    <div className="dt-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} {...props} />
    </div>
  );
}
export function Select({
  label,
  children,
  ...props
}: ComponentProps<'select'> & { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="dt-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {children}
      </select>
    </div>
  );
}
export function Toggle({
  label,
  ...props
}: ComponentProps<'input'> & { label: string }) {
  return (
    <label className="dt-toggle">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={`dt-notice ${error ? 'dt-error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
