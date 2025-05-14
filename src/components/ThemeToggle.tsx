'use client';

import { useEffect } from 'react';

export default function ThemeSync() {
  useEffect(() => {
    // Function to update theme based on system preference
    const updateTheme = () => {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Initial theme setup
    updateTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    // Cleanup listener on component unmount
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, []);

  return null; // This component doesn't render anything
} 