import Link from 'next/link';

export function BrandMark() {
  return (
    <Link className="brand-mark" href="/" aria-label="Date Tree home">
      <span className="brand-glyph" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>Date Tree</span>
    </Link>
  );
}
