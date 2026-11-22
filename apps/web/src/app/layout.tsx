import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clip Network — Autonomous Stream-to-Clip Distribution',
  description:
    'Tag creator accounts, link clipping accounts, extract voice-synced 9:16 shorts with procedural SFX, and route safely.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
