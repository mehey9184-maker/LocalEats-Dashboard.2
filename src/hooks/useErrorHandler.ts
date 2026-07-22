import { useState, useCallback, useEffect } from "react";
import {
  handleCentralizedError,
  getLoggedNetworkErrors,
  clearLoggedNetworkErrors,
  LoggedNetworkError,
  mapSupabaseError,
} from "../utils/errorHandler";

export const useErrorHandler = () => {
  const [errorLog, setErrorLog] = useState<LoggedNetworkError[]>(() => getLoggedNetworkErrors());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshLog = useCallback(() => {
    setErrorLog(getLoggedNetworkErrors());
  }, []);

  const handleError = useCallback(
    (error: unknown, context: string, fallbackMessage?: string, showToast = true) => {
      const msg = handleCentralizedError(error, context, fallbackMessage, showToast);
      refreshLog();
      return msg;
    },
    [refreshLog]
  );

  const clearLog = useCallback(() => {
    clearLoggedNetworkErrors();
    setErrorLog([]);
  }, []);

  return {
    handleError,
    mapSupabaseError,
    errorLog,
    refreshLog,
    clearLog,
    isOnline,
  };
};
