import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LiveScope | Observe. Reproduce. Fix. Verify.',
  description: 'Observe production state, reproduce failures, and verify fixes before they reach a customer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js" async />
      </head>
      <body>{children}</body>
    </html>
  );
}
