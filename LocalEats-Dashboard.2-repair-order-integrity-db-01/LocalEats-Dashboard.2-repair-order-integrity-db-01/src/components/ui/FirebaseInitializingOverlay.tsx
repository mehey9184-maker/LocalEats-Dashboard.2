import React from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, ShieldCheck } from "lucide-react";

interface FirebaseInitializingOverlayProps {
  message?: string;
  subtext?: string;
}

export const FirebaseInitializingOverlay: React.FC<FirebaseInitializingOverlayProps> = ({
  message = "Validating secure merchant session...",
  subtext = "Connecting to Firebase Cloud Infrastructure & Realtime Relay",
}) => {
  return (
    <div 
      id="firebase-global-auth-loader"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-surface/90 dark:bg-zinc-950/95 backdrop-blur-xl transition-all duration-300 select-none"
    >
      {/* Ambient background glow */}
      <div className="absolute w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none -top-10 -left-10" />
      <div className="absolute w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none -bottom-10 -right-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center text-center max-w-sm px-6 py-8 rounded-3xl bg-surface-container-lowest/80 dark:bg-zinc-900/80 border border-outline-variant/15 shadow-2xl"
      >
        {/* Animated Brand Badge */}
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-[#FF7A00] flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white border-2 border-white dark:border-zinc-900 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Text and Titles */}
        <h3 className="font-headline font-black text-xl text-on-surface tracking-tight mb-2">
          LocalEats Merchant
        </h3>
        <p className="text-xs md:text-sm font-semibold text-on-surface-variant leading-relaxed mb-6">
          {message}
        </p>

        {/* Loading Spinner & Progress Line */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-high/60 dark:bg-zinc-800/60 border border-outline-variant/10 text-primary text-xs font-bold mb-3">
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
          <span className="truncate">Firebase Cloud Relay Active</span>
        </div>

        <p className="text-[11px] text-on-surface-variant/70 font-medium tracking-wide">
          {subtext}
        </p>
      </motion.div>
    </div>
  );
};
