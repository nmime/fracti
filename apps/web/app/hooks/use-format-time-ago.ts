import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Hook that returns a translated time-ago formatter
 */
export function useFormatTimeAgo() {
  const { t } = useTranslation();

  return useCallback(
    (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const hours = diffMs / (1000 * 60 * 60);

      if (hours < 1) return t('home.justNow');
      if (hours < 24) return t('home.hoursAgo', { count: Math.floor(hours) });
      const days = Math.floor(hours / 24);

      return t('home.daysAgo', { count: days });
    },
    [t],
  );
}
