import type { Metadata } from 'next';
import { Inter, Sora, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700', '800'], display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Conic — Creator Partnership Platform',
  description:
    'AI-powered contracts, deliverables, and payments for brands and creators.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${sora.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <div className="app-aura" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
