import { useState, useEffect, useCallback } from 'react';

interface UseScrollToTopOptions {
  threshold?: number;
}

/**
 * ページスクロール位置を監視し、最上部へのスムーズスクロール機能を提供するカスタムフック
 */
export function useScrollToTop({ threshold = 300 }: UseScrollToTopOptions = {}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop;
          setIsVisible(currentScrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    // 初期マウント時のスクロール位置も判定
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  return { isVisible, scrollToTop };
}
