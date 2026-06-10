import { useState, useCallback } from "react";

export const useAppNavigation = (defaultTab = "dashboard") => {
  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("localeats_active_tab") || defaultTab;
    }
    return defaultTab;
  });

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("localeats_active_tab", tab);
    }
  }, []);

  return { activeTab, setActiveTab };
};
