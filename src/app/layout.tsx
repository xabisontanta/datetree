import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Manrope } from 'next/font/google';

import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const dmSerif = DM_Serif_Display({
  variable: '--font-dm-serif',
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://date-tree-social-booking.shady-poppy-7166.chatgpt.site',
  ),
  title: {
    default: 'Date Tree — Make the plan happen',
    template: '%s — Date Tree',
  },
  description:
    'Create a personal social booking link and let people request time with you, on your terms.',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101017',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${dmSerif.variable}`}>{children}</body>
    </html>
  );
}
