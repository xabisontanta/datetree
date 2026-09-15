'use client';
import { Button } from '@/components/ui/button';

import Image from 'next/image';

import { useId, useState } from 'react';
import { mediaUrl } from '@/components/public-page';
import { Notice } from '@/components/editor-fields';

/** Decode pixels and re-encode: EXIF, GPS, comments and original names never leave the browser. */
export async function prepareImage(file: File): Promise<Blob> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('Choose a JPG, PNG or WebP under 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width < 64 ||
      bitmap.height < 64 ||
      bitmap.width * bitmap.height > 40000000
    )
      throw new Error(
        'Use an image at least 64 pixels wide and tall, under 40 megapixels.',
      );
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image editing is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob || blob.size > 5 * 1024 * 1024)
      throw new Error(
        'This image is too large after processing. Choose a smaller image.',
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
export function ImageUpload({
  label,
  value,
  onChange,
  position,
  onPosition,
}: {
  label: string;
  value: string;
  onChange: (path: string) => void;
  position?: number;
  onPosition?: (position: number) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="dt-image-upload">
      <label htmlFor={id}>{label}</label>
      {value && (
        <Image
          unoptimized
          width={1400}
          height={1400}
          src={mediaUrl(value)}
          alt={`${label} preview`}
          style={{ objectPosition: `center ${position ?? 50}%` }}
        />
      )}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError('');
          try {
            const blob = await prepareImage(file);
            const response = await fetch('/api/media', {
              method: 'POST',
              headers: { 'Content-Type': 'image/png' },
              body: blob,
            });
            const result = (await response.json()) as { path?: string; error?: string };
            if (!response.ok || !result.path)
              throw new Error(
                result.error || 'Upload failed. Retry when your connection returns.',
              );
            onChange(result.path);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Could not process this image.',
            );
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
      {busy && <output>Preparing and uploading image…</output>}
      {value && onPosition && (
        <label>
          Crop position
          <input
            type="range"
            min="0"
            max="100"
            value={position ?? 50}
            onChange={(e) => onPosition(Number(e.target.value))}
          />
        </label>
      )}
      {value && (
        <Button
          variant="ghost"
          type="button"
          className="dt-text-button"
          onClick={() => onChange('')}
        >
          Remove from page
        </Button>
      )}
      <small>JPG, PNG or WebP · up to 10 MB. Location metadata is removed.</small>
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
