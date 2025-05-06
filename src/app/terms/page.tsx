'use client';

import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
      
      <div className="prose prose-indigo">
        <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
        <p className="mb-4">
          By accessing and using PickleRank, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">2. Use License</h2>
        <p className="mb-4">
          Permission is granted to temporarily use PickleRank for personal, non-commercial purposes. This is the grant of a license, not a transfer of title, and under this license you may not:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose</li>
          <li>Attempt to decompile or reverse engineer any software contained on PickleRank</li>
          <li>Remove any copyright or other proprietary notations from the materials</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">3. User Data</h2>
        <p className="mb-4">
          By using PickleRank, you agree that we may collect, store, and process your personal information, including but not limited to your name, phone number, and game statistics. This data may be used to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Provide and improve our services</li>
          <li>Analyze usage patterns</li>
          <li>Communicate with you about our services</li>
          <li>Share with third parties for marketing or other purposes</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">4. Disclaimer</h2>
        <p className="mb-4">
          The materials on PickleRank are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">5. Limitations</h2>
        <p className="mb-4">
          In no event shall PickleRank or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on PickleRank.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">6. Revisions and Errata</h2>
        <p className="mb-4">
          The materials appearing on PickleRank could include technical, typographical, or photographic errors. We do not warrant that any of the materials on our website are accurate, complete, or current.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">7. Links</h2>
        <p className="mb-4">
          We have not reviewed all of the sites linked to our website and are not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by PickleRank of the site.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">8. Modifications</h2>
        <p className="mb-4">
          We may revise these terms of service at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">9. Governing Law</h2>
        <p className="mb-4">
          These terms and conditions are governed by and construed in accordance with the laws of the United States and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
        </p>
      </div>

      <div className="mt-8">
        <Link href="/" className="text-indigo-600 hover:text-indigo-500">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
} 