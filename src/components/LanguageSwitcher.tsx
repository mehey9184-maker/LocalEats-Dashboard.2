import React, { useEffect } from 'react';
import { Globe } from 'lucide-react';

declare global {
  interface Window {
    google: {
      translate: {
        TranslateElement: new (
          options: { pageLanguage: string; includedLanguages: string; layout: unknown },
          elementId: string
        ) => unknown;
      };
    };
    googleTranslateElementInit: () => void;
  }
}

export const LanguageSwitcher: React.FC<{previewOnly?:boolean}> = ({previewOnly=false}) => {
  useEffect(() => {
    if(previewOnly)return; // Never fetch or run a third-party translation script inside the locked Preview.
    // Check if the script is already added
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);

      window.googleTranslateElementInit = () => {
        if (window.google && window.google.translate && window.google.translate.TranslateElement) {
          try {
            type TranslateCtor = new (
              options: { pageLanguage: string; includedLanguages: string; layout?: unknown },
              elementId: string
            ) => unknown;
            const TranslateElementClass = window.google.translate.TranslateElement as unknown as TranslateCtor & {
              InlineLayout?: { SIMPLE?: unknown };
            };
            new TranslateElementClass(
              {
                pageLanguage: 'en',
                includedLanguages: 'en,zu,xh,af,st,tn,ts,ss,ve,nr,nso', // 11 official languages of South Africa
                layout: TranslateElementClass.InlineLayout?.SIMPLE
              },
              'google_translate_element'
            );
          } catch {
            // Fail-safe translation loader
          }
        }
      };
    }
  }, [previewOnly]);

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-on-surface-variant" />
        <h3 className="font-headline font-bold text-lg">Language Settings</h3>
      </div>
      <p className="text-sm text-on-surface-variant mb-2">
        {previewOnly ? "Language translation is not activated or verified in this Preview. The original layout is shown for review only." : "Select your preferred South African language. Automatic translations may be incomplete; check important information in the original language."}
      </p>
      {previewOnly ? (
        <div role="status" className="mt-2 min-h-[40px] rounded-lg border border-outline-variant/20 p-2 bg-surface-container-low text-xs text-on-surface-variant">
          Translation control unavailable in Preview
        </div>
      ) : (
        <div id="google_translate_element" className="mt-2 min-h-[40px] rounded-lg overflow-hidden [&>div]:!bg-transparent border border-outline-variant/20 p-2 bg-surface-container-low" />
      )}
    </div>
  );
};
