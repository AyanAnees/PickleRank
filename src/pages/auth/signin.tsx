'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth } from '../../client/firebase';

export default function SignIn() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [consent, setConsent] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [recaptchaCompleted, setRecaptchaCompleted] = useState(false);
  const recaptchaVerifierRef = useRef<any>(null);
  const authRef = useRef<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const from = searchParams ? searchParams.get('from') || '/' : '/';

  // Check if user is already registered
  useEffect(() => {
    authRef.current = auth;
    (async () => {
      try {
        const user = authRef.current.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          document.cookie = `auth-token=${idToken}; path=/`;
          const response = await fetch('/api/users/me', {
            headers: { 'Cookie': `auth-token=${idToken}` }
          });
          if (response.ok) {
            const userData = await response.json();
            if (userData && userData.firstName && userData.lastName) {
              if (pathname !== '/dashboard') {
                router.push('/dashboard');
              }
              return;
            }
          }
        }
      } catch (error) {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
    })();
  }, [router, pathname]);

  useEffect(() => {
    authRef.current = auth;
    (async () => {
      const { RecaptchaVerifier } = await import('firebase/auth');
      const verifier = new RecaptchaVerifier(authRef.current, 'recaptcha-container', {
        size: 'normal',
        callback: () => {
          setRecaptchaCompleted(true);
          setError(null);
        },
        'expired-callback': () => {
          setRecaptchaCompleted(false);
          setError('reCAPTCHA expired. Please verify again.');
        },
        'error-callback': () => {
          setRecaptchaCompleted(false);
          setError('reCAPTCHA error. Please try again.');
        },
        'invisible': false
      });
      recaptchaVerifierRef.current = verifier;
      verifier.render();
    })();
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format the number as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const validatePhoneNumber = (phone: string) => {
    // Check if we have exactly 10 digits
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10;
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaptchaCompleted) {
      setError('Please complete the reCAPTCHA verification first');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (!recaptchaVerifierRef.current) throw new Error('reCAPTCHA not initialized');
      const formattedPhone = formatPhoneNumber(phoneNumber);
      if (!validatePhoneNumber(formattedPhone)) throw new Error('Please enter a valid phone number');
      const e164Phone = `+1${formattedPhone.replace(/\D/g, '')}`;
      if (!authRef.current) {
        const { getAuth } = await import('firebase/auth');
        authRef.current = getAuth();
      }
      const { signInWithPhoneNumber } = await import('firebase/auth');
      const confirmationResult = await signInWithPhoneNumber(authRef.current, e164Phone, recaptchaVerifierRef.current);
      setVerificationId(confirmationResult.verificationId);
      setVerificationSent(true);
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format. Please check and try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!verificationId) throw new Error('No verification ID found');
      if (!authRef.current) {
        const { getAuth } = await import('firebase/auth');
        authRef.current = getAuth();
      }
      const { PhoneAuthProvider, signInWithCredential } = await import('firebase/auth');
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const userCredential = await signInWithCredential(authRef.current, credential);
      const idToken = await userCredential.user.getIdToken();
      document.cookie = `auth-token=${idToken}; path=/`;
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!verifyResponse.ok) throw new Error('Failed to verify token');
      const response = await fetch('/api/users/me', {
        headers: { 'Cookie': `auth-token=${idToken}` }
      });
      if (!response.ok) {
        setIsNewUser(true);
        return;
      }
      const userData = await response.json();
      if (!userData || !userData.firstName || !userData.lastName) {
        setIsNewUser(true);
        return;
      }
      if (pathname !== '/dashboard') {
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!consent) {
        setError('Please accept the Terms of Service and Privacy Policy to continue');
        setLoading(false);
        return;
      }
      if (!authRef.current) {
        const { getAuth } = await import('firebase/auth');
        authRef.current = getAuth();
      }
      if (!authRef.current.currentUser) throw new Error('No authenticated user found');
      const idToken = await authRef.current.currentUser.getIdToken(true);
      document.cookie = `auth-token=${idToken}; path=/`;
      const userData = {
        id: authRef.current.currentUser.uid,
        phoneNumber: authRef.current.currentUser.phoneNumber || '',
        displayName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        elo: 1500,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAdmin: false,
        seasonStats: {}
      };
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth-token=${idToken}`
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create account');
      }
      if (pathname !== '/dashboard') {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } finally {
      setLoading(false);
    }
  };

  const handleRetryRecaptcha = async () => {
    setError(null);
    const container = document.getElementById('recaptcha-container');
    if (container) container.innerHTML = '';
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
    if (!authRef.current) {
      const { getAuth } = await import('firebase/auth');
      authRef.current = getAuth();
    }
    const { RecaptchaVerifier } = await import('firebase/auth');
    const verifier = new RecaptchaVerifier(authRef.current, 'recaptcha-container', {
      size: 'normal',
      callback: () => {
        setRecaptchaCompleted(true);
        setError(null);
      },
      'expired-callback': () => {
        setRecaptchaCompleted(false);
        setError('reCAPTCHA expired. Please verify again.');
      },
      'error-callback': () => {
        setRecaptchaCompleted(false);
        setError('reCAPTCHA error. Please try again.');
      },
      'invisible': false
    });
    recaptchaVerifierRef.current = verifier;
    verifier.render();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isNewUser ? 'Welcome to PickleRank' : 'Sign in to PickleRank'}
          </h2>
        </div>

        {error && !error.includes('reCAPTCHA') && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!verificationSent && !isNewUser && (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">+1</span>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  maxLength={14}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 pl-8 pr-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="(555) 555-5555"
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  onKeyPress={(e) => {
                    if (!/[\d]/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex justify-center min-h-[78px] bg-white rounded-lg shadow-sm p-2">
              <div id="recaptcha-container" className="transform scale-100"></div>
            </div>
            
            {error && error.includes('reCAPTCHA') && !isNewUser && (
              <div className="flex flex-col items-center space-y-2">
                <p className="text-sm text-red-500 text-center">{error}</p>
                <button
                  type="button"
                  onClick={handleRetryRecaptcha}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Retry reCAPTCHA
                </button>
              </div>
            )}
            
            {!error && !recaptchaCompleted && !isNewUser && (
              <p className="text-sm text-gray-500 text-center">
                Check the box above to verify you're human
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !validatePhoneNumber(phoneNumber) || !recaptchaCompleted || !navigator.onLine}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </div>
          </form>
        )}

        {verificationSent && !isNewUser && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <input
                type="text"
                id="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </form>
        )}

        {isNewUser && (
          <form className="mt-8 space-y-6" onSubmit={handleRegister}>
            <div className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  id="consent"
                  name="consent"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <label htmlFor="consent" className="ml-2 block text-sm text-gray-900">
                  I agree to the{' '}
                  <Link href="/terms" className="text-indigo-600 hover:text-indigo-500" target="_blank">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-indigo-600 hover:text-indigo-500" target="_blank">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 