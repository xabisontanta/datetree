import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Manrope } from 'next/font/google';

import './globals.css';
import './studio.css';

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
    process.env.NEXT_PUBLIC_APP_URL ||
      'https://date-tree-social-booking.xabison.chatgpt.site',
  ),
  title: {
    default: 'Date Tree — Your services. Your link.',
    template: '%s — Date Tree',
  },
  description:
    'One personal link for your services, appointments and creative work. Build a page that feels like you.',
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
