import { ArrowUp } from 'lucide-react';
import { useScrollToTop } from '../hooks/useScrollToTop';

interface ScrollToTopButtonProps {
  threshold?: number;
}

/**
 * ページ最上部へスムーズスクロールするフローティングアクションボタン
 */
export function ScrollToTopButton({ threshold = 300 }: ScrollToTopButtonProps) {
  const { isVisible, scrollToTop } = useScrollToTop({ threshold });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // クリック後にフォーカスを解除し、スクロール後の非表示化によるaria-hiddenの競合を防止
    e.currentTarget.blur();
    scrollToTop();
  };

  return (
    <button
      type="button"
      className={`scroll-to-top-btn ${isVisible ? 'visible' : ''}`}
      onClick={handleClick}
      aria-label="ページ最上部へ戻る"
      title="ページ最上部へ戻る"
      tabIndex={isVisible ? 0 : -1}
      aria-hidden={!isVisible ? 'true' : undefined}
    >
      <ArrowUp size={20} strokeWidth={2.2} />
    </button>
  );
}
