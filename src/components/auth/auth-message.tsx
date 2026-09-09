type AuthMessageProps = {
  error?: string;
  message?: string;
};

export function AuthMessage({ error, message }: AuthMessageProps) {
  if (!error && !message) return null;

  return (
    <p
      className={error ? 'auth-message auth-message-error' : 'auth-message'}
      role={error ? 'alert' : 'status'}
    >
      {error ?? message}
    </p>
  );
}
