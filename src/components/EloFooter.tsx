import Link from 'next/link';

export default function EloFooter() {
  return (
    <footer className="text-center py-4 text-gray-500">
      <Link href="/rankings-explained" className="underline">
        How is ELO calculated?
      </Link>
    </footer>
  );
} 