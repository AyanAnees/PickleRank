import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Footer from './Footer';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PickleRank - Go PICKLEHEADS',
  description: 'Do it to em Dib',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'PickleRank - Go PICKLEHEADS',
    description: 'Shaheer is not here is he',
    images: [
      {
        url: '/og-image.png',
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
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <AuthProvider>
        <main className="max-w-md mx-auto px-4 py-8">
          {children}
        </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
} 