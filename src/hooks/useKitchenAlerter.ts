// LocalEatsSA Kitchen Attention & Device Vigilance Hook
// Combines Web Audio API dual-tone synthesized sirens with the Screen Wake Lock API.
// Keeps screens on during busy shifts and pierces high kitchen background noise on new PENDING orders.

import { useEffect, useState, useRef, useCallback } from "react";
import { Order } from "../types";

export interface KitchenAlerterResult {
  isAudioEnabled: boolean;
  enableAudio: () => Promise<void>;
  isWakeLocked: boolean;
  hasPendingAlarm: boolean;
  stopAlarmManual: () => void;
}

interface CustomWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export const useKitchenAlerter = (orders: Order[]): KitchenAlerterResult => {
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isWakeLocked, setIsWakeLocked] = useState<boolean>(false);
  const [hasPendingAlarm, setHasPendingAlarm] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const osc1Ref = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const sirenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<unknown>(null);

  // --- 1. Web Audio Siren Orchestration ---
  const startSiren = () => {
    try {
      if (!audioCtxRef.current) {
        const Win = window as unknown as CustomWindow;
        const AudioCtxClass = window.AudioContext || Win.webkitAudioContext;
        if (AudioCtxClass) {
          audioCtxRef.current = new AudioCtxClass();
        }
      }

      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        void audioCtxRef.current.resume();
      }

      // If already playing, don't double stack
      if (osc1Ref.current || osc2Ref.current) return;

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const mainGain = ctx.createGain();
      mainGain.gain.setValueAtTime(0, ctx.currentTime);
      // Soft start to avoid click/pop sounds
      mainGain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.15);
      mainGain.connect(ctx.destination);
      mainGainRef.current = mainGain;

      // Primary penetrative sine tone (Tembisa emergency style)
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(580, ctx.currentTime);
      osc1.connect(mainGain);
      osc1.start();
      osc1Ref.current = osc1;

      // Secondary aggressive sawtooth tone for acoustic texture
      const osc2 = ctx.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(780, ctx.currentTime);
      
      const textureGain = ctx.createGain();
      textureGain.gain.setValueAtTime(0.35, ctx.currentTime);
      
      osc2.connect(textureGain);
      textureGain.connect(mainGain);
      osc2.start();
      osc2Ref.current = osc2;

      // Continuous pitch sweep alternation (Siren loop)
      let highState = false;
      sirenIntervalRef.current = setInterval(() => {
        if (!audioCtxRef.current) return;
        const now = audioCtxRef.current.currentTime;
        if (osc1Ref.current) {
          osc1Ref.current.frequency.exponentialRampToValueAtTime(
            highState ? 750 : 520,
            now + 0.18
          );
        }
        if (osc2Ref.current) {
          osc2Ref.current.frequency.exponentialRampToValueAtTime(
            highState ? 920 : 680,
            now + 0.18
          );
        }
        highState = !highState;
      }, 220);

      // Defer state update to prevent synchronous cascading renders warnings
      setTimeout(() => {
        setHasPendingAlarm(true);
      }, 0);
    } catch (err) {
      console.error("Failed to spin up Web Audio Alerter:", err);
    }
  };

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }

    const ctx = audioCtxRef.current;
    const gainNode = mainGainRef.current;

    if (gainNode && ctx) {
      try {
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      } catch {
        // Safe catch
      }
    }

    // Delayed release to let decay fade finish cleanly
    setTimeout(() => {
      try {
        if (osc1Ref.current) {
          osc1Ref.current.stop();
          osc1Ref.current.disconnect();
          osc1Ref.current = null;
        }
        if (osc2Ref.current) {
          osc2Ref.current.stop();
          osc2Ref.current.disconnect();
          osc2Ref.current = null;
        }
        if (mainGainRef.current) {
          mainGainRef.current.disconnect();
          mainGainRef.current = null;
        }
      } catch (err) {
        console.warn("Audio node teardown issue:", err);
      }
      setHasPendingAlarm(false);
    }, 180);
  };

  // --- 2. Screen Wake Lock Orchestration ---
  const requestWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) {
      console.debug("This browser does not support native Screen Wake Locks.");
      return;
    }

    try {
      const nav = navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } };
      const lock = await nav.wakeLock.request("screen");
      wakeLockRef.current = lock;
      setIsWakeLocked(true);

      const sentinel = lock as { addEventListener: (type: string, listener: () => void) => void };
      sentinel.addEventListener("release", () => {
        setIsWakeLocked(false);
      });
    } catch (err) {
      console.debug("Screen Wake Lock allocation blocked or disallowed by policy:", err);
      setIsWakeLocked(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        const lock = wakeLockRef.current as { release: () => Promise<void> };
        await lock.release();
        wakeLockRef.current = null;
        setIsWakeLocked(false);
      } catch (err) {
        console.error("Failed releasing wake lock:", err);
      }
    }
  }, []);

  // Explicit user unlock/opt-in to whitelist modern browsers autoplay policies
  const enableAudioAndGoOnline = useCallback(async () => {
    try {
      const Win = window as unknown as CustomWindow;
      const AudioCtxClass = window.AudioContext || Win.webkitAudioContext;
      if (AudioCtxClass) {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtxClass();
        }
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      }
      setIsAudioEnabled(true);
      await requestWakeLock();
    } catch (err) {
      console.error("Audio Whitelisting Error:", err);
    }
  }, [requestWakeLock]);

  // Auto-enable audio context & wake lock on first user gesture anywhere
  useEffect(() => {
    const handleFirstGesture = () => {
      void enableAudioAndGoOnline();
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };

    window.addEventListener("click", handleFirstGesture, { once: true });
    window.addEventListener("touchstart", handleFirstGesture, { once: true });
    window.addEventListener("keydown", handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };
  }, [enableAudioAndGoOnline]);

  // Visibility Change Auto-Rehydration (standard Screen Wake Lock requirement)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isAudioEnabled) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAudioEnabled, requestWakeLock]);

  // Evaluate orders live status triggers
  useEffect(() => {
    const hasPendingOrder = orders.some((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "pending";
    });

    if (hasPendingOrder && isAudioEnabled) {
      startSiren();
    } else {
      stopSiren();
    }
  }, [orders, isAudioEnabled]);

  // Teardown
  useEffect(() => {
    return () => {
      stopSiren();
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    isAudioEnabled,
    enableAudio: enableAudioAndGoOnline,
    isWakeLocked,
    hasPendingAlarm,
    stopAlarmManual: stopSiren,
  };
};
