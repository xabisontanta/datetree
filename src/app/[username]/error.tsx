'use client';
export default function ProfileError({ reset }: { reset: () => void }) {
  return (
    <main className="dt-app dt-empty">
      <h1>We couldn’t load this page.</h1>
      <p>Please check your connection and try again.</p>
      <button className="dt-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
