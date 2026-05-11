import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  return (
    <AnimatePresence>
      {(isSaving || isSuccess) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface-container-highest p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 min-w-[280px]"
          >
            <div className="relative w-16 h-16 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {isSaving && !isSuccess ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, rotate: -180 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 180 }}
                  >
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 100 }}
                    className="bg-green-500 rounded-full p-3 shadow-lg shadow-green-500/30"
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center"
            >
              <h3 className="text-xl font-headline font-bold text-on-surface">
                {isSuccess ? successMessage : message}
              </h3>
              {!isSuccess && (
                <p className="text-sm text-on-surface-variant mt-1">Please wait a moment</p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
