'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import ReCAPTCHA from 'react-google-recaptcha';

export default function SignIn() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [recaptchaCompleted, setRecaptchaCompleted] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const initializeRecaptcha = async () => {
    try {
      // Clear any existing reCAPTCHA
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }

      // Wait for the container to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create new reCAPTCHA verifier
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
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
        }
      });

      // Store the verifier
      recaptchaVerifierRef.current = verifier;

      // Render the reCAPTCHA
      await verifier.render();
    } catch (error) {
      console.error('Error initializing reCAPTCHA:', error);
      setError('Error loading reCAPTCHA. Please refresh the page.');
      
      // Clear the verifier on error
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    }
  };

  useEffect(() => {
    // Initialize reCAPTCHA
    initializeRecaptcha();

    // Cleanup function
    return () => {
      try {
        if (recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        }
      } catch (error) {
        console.error('Error cleaning up reCAPTCHA:', error);
      }
    };
  }, []);

  // Add a retry button for reCAPTCHA
  const handleRetryRecaptcha = () => {
    setError(null);
    const container = document.getElementById('recaptcha-container');
    if (container) {
      container.innerHTML = ''; // Clear the container
    }
    // Re-initialize reCAPTCHA
    initializeRecaptcha();
  };

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
      if (!recaptchaVerifierRef.current) {
        throw new Error('reCAPTCHA not initialized');
      }

      const formattedPhone = formatPhoneNumber(phoneNumber);
      if (!validatePhoneNumber(formattedPhone)) {
        throw new Error('Please enter a valid phone number');
      }

      // Format phone number to E.164 format with US country code
      const e164Phone = `+1${formattedPhone.replace(/\D/g, '')}`;

      // Check network connectivity
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      const confirmationResult = await signInWithPhoneNumber(auth, e164Phone, recaptchaVerifierRef.current);
      setVerificationId(confirmationResult.verificationId);
      setVerificationSent(true);
    } catch (err: any) {
      console.error('Error sending code:', err);
      
      // Handle specific error cases
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
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
      if (!verificationId) {
        throw new Error('No verification ID found');
      }

      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Get the ID token
      const idToken = await userCredential.user.getIdToken();
      
      // Verify the token with our API
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify token');
      }

      // Check if this is a new user or if registration is incomplete
      const response = await fetch(`/api/users?id=${userCredential.user.uid}`);
      if (!response.ok) {
        setIsNewUser(true);
        return;
      }

      const userData = await response.json();
      
      // Check if registration is incomplete (no firstName or lastName)
      if (!userData.firstName || !userData.lastName) {
        setIsNewUser(true);
        return;
      }

      // Set the token in a cookie
      document.cookie = `auth-token=${idToken}; path=/`;
      
      // Redirect to the original destination or home page
      router.push(from);
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      console.error('Error verifying code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user found');
      }

      const userData = {
        id: auth.currentUser.uid,
        phoneNumber: auth.currentUser.phoneNumber || '',
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
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create account');
      }

      // Get the ID token
      const idToken = await auth.currentUser.getIdToken();
      
      // Set the token in a cookie
      document.cookie = `auth-token=${idToken}; path=/`;
      
      // Redirect to the original destination or home page
      router.push(from);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
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