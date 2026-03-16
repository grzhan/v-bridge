import { useI18n, LANGUAGE_OPTIONS } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

type LanguageToggleProps = {
  className?: string;
};

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className={cn('flex items-center gap-2 text-xs text-slate-500', className)}>
      <span>{t('language.label')}</span>
      <div className="flex overflow-hidden rounded-md border border-slate-200">
        {LANGUAGE_OPTIONS.map((option, index) => (
          <button
            key={option.code}
            type="button"
            className={cn(
              'px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
              index > 0 && 'border-l border-slate-200',
              language === option.code ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            )}
            aria-pressed={language === option.code}
            onClick={() => setLanguage(option.code)}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
