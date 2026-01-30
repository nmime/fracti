import { useState, useEffect, useCallback } from 'react';

/**
 * Scroll to Top Hook
 * Detects scroll position and provides smooth scroll to top functionality
 */

const SCROLL_THRESHOLD = 300;

export function useScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = useCallback(() => {
    // SSR guard
    if (typeof window === 'undefined') return;

    const scrollY = window.scrollY || document.documentElement.scrollTop;

    if (scrollY > SCROLL_THRESHOLD) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    // SSR guard
    if (typeof window === 'undefined') return;

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    // SSR guard - only run on client
    if (typeof window === 'undefined') return;

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  return {
    isVisible,
    scrollToTop,
  };
}
