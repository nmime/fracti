import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { useTranslation } from 'react-i18next';

export function RouteLoadingFallback() {
  const { t } = useTranslation();

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-primary h-8 w-8 motion-safe:animate-spin motion-reduce:opacity-50" />
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      </div>
    </div>
  );
}
