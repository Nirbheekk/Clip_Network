import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clip Network — Autonomous Stream-to-Clip Distribution',
  description: 'Tag creators, link clipping accounts, extract voice-synced viral shorts with SFX, and publish safely.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
