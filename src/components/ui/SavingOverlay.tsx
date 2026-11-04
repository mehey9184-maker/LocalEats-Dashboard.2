import React from "react";
import { OperationFeedback } from "./OperationFeedback";

interface SavingOverlayProps {
  isSaving: boolean;
  isSuccess: boolean;
  message?: string;
  successMessage?: string;
}

/**
 * Existing save callers retain control of verification: isSuccess must only
 * be set after the save operation has been confirmed. This small status chip
 * never blocks the whole dashboard or claims progress percentages.
 */
export const SavingOverlay: React.FC<SavingOverlayProps> = ({
  isSaving,
  isSuccess,
  message = "Saving changes…",
  successMessage = "Changes saved",
}) => {
  if (!isSaving && !isSuccess) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[100] mx-auto max-w-sm md:bottom-6">
      <OperationFeedback
        status={isSaving ? "loading" : "success"}
        message={isSaving ? message : successMessage}
        detail={isSaving ? "Waiting for confirmation." : undefined}
        className="shadow-lg"
      />
    </div>
  );
};
