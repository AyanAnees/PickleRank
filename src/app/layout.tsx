import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import EloFooter from '../components/EloFooter';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PickleRank - Track Your Pickleball Rankings',
  description: 'A modern application for tracking and ranking pickleball players using an ELO rating system.',
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
          <EloFooter />
        </AuthProvider>
      </body>
    </html>
  );
} 