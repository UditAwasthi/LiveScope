import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Lora } from 'next/font/google';
import './globals.css';

const lora = Lora({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-lora', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'LiveScope — Observe. Reproduce. Fix. Verify.',
  description:
    'Every observability tool stops at the red graph. LiveScope reconstructs the incident, reproduces it, attempts a fix, verifies the result, and rolls back if things get worse.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${jetbrains.variable} ${inter.variable}`}>
      <body className="bg-bg text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
