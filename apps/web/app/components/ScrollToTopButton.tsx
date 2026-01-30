import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up';
import { Button } from '@/components/ui/button';
import { useScrollToTop } from '@/hooks';
import { cn } from '@/utils';

export function ScrollToTopButton() {
  const { isVisible, scrollToTop } = useScrollToTop();

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      variant="default"
      className={cn(
        'fixed right-6 bottom-6 z-50 shadow-lg motion-safe:transition-opacity motion-safe:duration-300',
        'hover:shadow-xl',
        isVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
