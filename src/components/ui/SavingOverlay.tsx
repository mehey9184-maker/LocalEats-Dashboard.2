import React from 'react';
import { Loader2, Check } from 'lucide-react';

interface SavingOverlayProps {
  isSaving: boolean;
  isSuccess: boolean;
  message?: string;
  successMessage?: string;
}

export const SavingOverlay: React.FC<SavingOverlayProps> = ({
  isSaving,
  isSuccess,
  message = "Saving changes...",
  successMessage = "Saved successfully!"
}) => {
  if (!isSaving && !isSuccess) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container-highest p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 min-w-[280px]">
        <div className="relative w-16 h-16 flex items-center justify-center">
          {isSaving && !isSuccess ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : (
            <div className="bg-green-500 rounded-full p-3 shadow-lg shadow-green-500/30">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
          )}
        </div>
        
        <div className="text-center">
          <h3 className="text-xl font-headline font-bold text-on-surface">
            {isSuccess ? successMessage : message}
          </h3>
          {!isSuccess && (
            <p className="text-sm text-on-surface-variant mt-1">Please wait a moment</p>
          )}
        </div>
      </div>
    </div>
  );
};
