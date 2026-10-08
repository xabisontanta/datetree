'use client';
import { useEffect } from 'react';
import { markRequestActivityRead } from '@/app/requests/actions';
export function ActivityRead({ id, through }: { id: string; through: number }) {
  useEffect(() => {
    void markRequestActivityRead(id, through).catch(() => {});
  }, [id, through]);
  return null;
}
