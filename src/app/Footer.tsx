'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  
  // Don't show footer on the rankings-explained page
  if (pathname === '/rankings-explained') {
    return null;
  }

  return (
    <footer className="mt-8 text-center text-gray-500 text-sm">
      <p>© PickleRank. All rights reserved.</p>
      <Link href="/rankings-explained" className="text-indigo-600 hover:text-indigo-500 mt-2 inline-block">
        How do rankings work?
      </Link>
    </footer>
  );
} 