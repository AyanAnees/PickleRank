import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', marginTop: '10vh' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>404 - Page Not Found</h1>
      <p style={{ margin: '2rem 0' }}>
        Sorry, the page you are looking for does not exist.
      </p>
      <p style={{ margin: '2rem 0' }}>Shaheer if you're poking around.. keep trying buddy.</p>
      <Link href="/">
        <span style={{ color: '#0070f3', textDecoration: 'underline', cursor: 'pointer' }}>
          Go back home
        </span>
      </Link>
    </div>
  );
} 