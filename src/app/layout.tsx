import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Footer from './Footer';
import { AuthProvider } from '@/contexts/AuthContext';
import ThemeSync from '@/components/ThemeToggle';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PickleRank - Go PICKLEHEADS',
  description: 'Do it to em Dib',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Bring back 24h Shami',
    description: 'Whatever it takes',
    images: [
      {
        url: 'https://pickle-rank.vercel.app/yoyo.png',
        width: 1200,
        height: 630,
        alt: 'PickleRank',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PickleRank - Go PICKLEHEADS',
    description: 'Cypress boyyyyyssss',
    images: ['https://pickle-rank.vercel.app/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta property="og:image" content="https://pickle-rank.vercel.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://pickle-rank.vercel.app/og-image.png" />
      </head>
      <body className={`${inter.className} bg-background dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100`}>
        <AuthProvider>
          <ThemeSync />
          <main className="max-w-md mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
} 