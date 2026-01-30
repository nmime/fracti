import { cn } from '@/utils';

interface TextTrimmerProps {
  text: string;
  maxLength?: number;
  className?: string;
}

/**
 * Trims text to a maximum length and adds ellipsis
 */
export function TextTrimmer({ text, maxLength = 20, className }: TextTrimmerProps) {
  const trimmedText = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

  return (
    <span className={cn('truncate', className)} title={text.length > maxLength ? text : undefined}>
      {trimmedText}
    </span>
  );
}
