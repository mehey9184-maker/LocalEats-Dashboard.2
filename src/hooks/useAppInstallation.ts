import { useRef, useState, useSyncExternalStore } from "react";
import { getInstallInstructions } from "../services/installInstructions";
import {
  appAlreadyInstalled,
  availableInstallEvent,
  requestNativeInstall,
  subscribeToInstallability,
} from "../services/pwaInstallInvite";

const serverSnapshot = () => false;

export function useAppInstallation() {
  const installed = useSyncExternalStore(subscribeToInstallability, appAlreadyInstalled, serverSnapshot);
  const offer = useSyncExternalStore(subscribeToInstallability, availableInstallEvent, () => null);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const pending = useRef(false);
  const instructions = typeof navigator === "undefined"
    ? null
    : getInstallInstructions(navigator.userAgent, navigator.maxTouchPoints);

  const install = async () => {
    if (pending.current || appAlreadyInstalled()) return;
    if (!availableInstallEvent()) {
      setShowHelp(true);
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const outcome = await requestNativeInstall();
      if (outcome === "error" || outcome === "unavailable") setShowHelp(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return {
    available: !installed && Boolean(offer || instructions || busy),
    busy,
    install,
    showHelp: showHelp && !installed,
    instructions,
    closeHelp: () => setShowHelp(false),
  };
}
