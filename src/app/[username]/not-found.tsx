import Link from 'next/link';
export default function UnavailablePage() {
  return (
    <main className="dt-app dt-empty">
      <h1>This page isn’t available.</h1>
      <p>It may be unpublished, or the link may be incorrect.</p>
      <Link className="dt-button-secondary" href="/">
        Go to Date Tree
      </Link>
    </main>
  );
}
