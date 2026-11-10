import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = true,
}: ConfirmModalProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      onClick={(e) => {
         if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === "Tab") {
            if (e.shiftKey && document.activeElement === cancelRef.current) {
              e.preventDefault();
              confirmRef.current?.focus();
            } else if (!e.shiftKey && document.activeElement === confirmRef.current) {
              e.preventDefault();
              cancelRef.current?.focus();
            }
          }
        }}
        className="relative w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden transform scale-100 opacity-100 transition-all duration-300"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
              <AlertCircle size={24} />
            </div>
            <div className="flex-1 pt-1">
              <h3 id={titleId} className="text-lg font-bold text-on-surface leading-tight mb-2">
                {title}
              </h3>
              <p id={descriptionId} className="text-sm text-on-surface-variant leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-surface-container-low border-t border-outline-variant/10">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="le-press-feedback min-h-11 flex-1 px-4 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            className={`le-press-feedback min-h-11 flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm cursor-pointer ${
              isDestructive 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

