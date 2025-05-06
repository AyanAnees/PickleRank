'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-indigo">
        <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
        <p className="mb-4">
          We collect information that you provide directly to us, including:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Name and contact information</li>
          <li>Phone number</li>
          <li>Game statistics and rankings</li>
          <li>Any other information you choose to provide</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
        <p className="mb-4">
          We use the information we collect to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Provide, maintain, and improve our services</li>
          <li>Process and complete transactions</li>
          <li>Send you technical notices and support messages</li>
          <li>Communicate with you about products, services, and events</li>
          <li>Monitor and analyze trends and usage</li>
          <li>Personalize your experience</li>
          <li>Share with third parties for marketing or other purposes</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">3. Information Sharing</h2>
        <p className="mb-4">
          We may share your information with:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Service providers who perform services on our behalf</li>
          <li>Business partners with whom we jointly offer products or services</li>
          <li>Third parties for marketing purposes</li>
          <li>Other users of the platform as part of the ranking system</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Security</h2>
        <p className="mb-4">
          We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">5. Your Choices</h2>
        <p className="mb-4">
          You can:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Update your account information</li>
          <li>Opt out of marketing communications</li>
          <li>Request deletion of your account</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">6. Cookies and Tracking</h2>
        <p className="mb-4">
          We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">7. Changes to This Policy</h2>
        <p className="mb-4">
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">8. Contact Us</h2>
        <p className="mb-4">
          If you have any questions about this Privacy Policy, please contact us.
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