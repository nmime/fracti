import Globe from 'lucide-react/dist/esm/icons/globe';
import { useTranslation } from 'react-i18next';
import { api } from '@/services';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTelegram } from '@/providers';
import { cn } from '@/utils';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
] as const;

interface LanguageSwitcherProps {
  variant?: 'icon' | 'dropdown';
  className?: string;
}

export function LanguageSwitcher({ variant = 'icon', className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const { hapticFeedback } = useTelegram();

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  const handleChangeLanguage = (langCode: string) => {
    hapticFeedback.selectionChanged();
    void i18n.changeLanguage(langCode);
    // Store preference in localStorage
    localStorage.setItem('fracti_language', langCode);
    // Sync with server (fire and forget)
    if (api.hasAuth()) {
      void api.setUserLanguage(langCode as 'en' | 'ru').catch(() => {
        // Ignore errors - localStorage is the fallback
      });
    }
  };

  if (variant === 'icon') {
    // Simple toggle between EN and RU
    const nextLang = currentLang.code === 'en' ? 'ru' : 'en';

    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleChangeLanguage(nextLang)}
        className={cn('h-9 w-9', className)}
        aria-label="Switch language"
      >
        <span className="text-sm font-medium">{currentLang.code.toUpperCase()}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('h-9 w-9', className)}>
          <Globe className="h-5 w-5" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChangeLanguage(lang.code)}
            className={cn(i18n.language === lang.code && 'bg-accent')}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
