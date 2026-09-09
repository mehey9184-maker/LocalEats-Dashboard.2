import React, { useState, useEffect } from "react";
import { ArrowLeft, AlertCircle, CheckCircle2, Rocket, Utensils } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface VerificationPendingProps {
  email: string;
  onBack: () => void;
  onVerified: () => void;
  onSupport: () => void;
}

export const VerificationPending: React.FC<VerificationPendingProps> = ({
  email,
  onBack,
  onVerified,
  onSupport,
}) => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(59);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).split("");
    const newOtp = [...otp];
    pastedData.forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    const lastIndex = Math.min(pastedData.length, 5);
    document.getElementById(`otp-${lastIndex}`)?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    setLoading(true);
    setError(null);

    // Master Code Bypass for testing
    if (code === "200201") {
      toast.success("Master code accepted!");
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onVerified();
      }, 1500);
      setLoading(false);
      return;
    }

    try {
      // Ignore OTP if mocked, Supabase doesn't support it directly without a type casting.
      // We will cast to any since we are relying on firebase anyway.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.auth as any).verifyOtp({
        email,
        token: code,
        type: "signup",
      });

      if (error) {
        if (error.message.toLowerCase().includes("rate limit")) {
          setError(
            "Email limit reached (3 per hour). Please wait an hour or contact support.",
          );
        } else {
          setError(error.message);
        }
      } else {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onVerified();
        }, 2000);
      }
    } catch (err: unknown) {
      console.error("Verification error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;

    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.auth as any).resend({
        type: "signup",
        email,
      });

      if (error) {
        if (error.message.toLowerCase().includes("rate limit")) {
          setError(
            "Email limit reached (3 per hour). Please wait an hour or contact support.",
          );
        } else {
          setError(error.message);
        }
      } else {
        setTimer(59);
        setOtp(["", "", "", "", "", ""]);
        const firstInput = document.getElementById("otp-0");
        firstInput?.focus();
        toast.success("New verification code sent!");
      }
    } catch (err: unknown) {
      console.error("Resend error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased">
      <header className="fixed top-0 w-full z-50 bg-[#faf9f8]/70 backdrop-blur-xl shadow-[0_8px_24px_-4px_rgba(167,52,0,0.12)]">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-7xl mx-auto">
          <button
            onClick={onBack}
            className="p-2 text-primary hover:bg-surface-container-low rounded-full transition-colors active:scale-95 duration-200"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-headline text-2xl font-black text-primary tracking-tighter">
            LocalEats
          </h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="min-h-screen pt-24 pb-12 px-6 flex flex-col items-center justify-center overflow-x-hidden">
        <div className="max-w-md w-full space-y-8">
          <section className="relative">
            <div className="text-center mb-10">
              <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight leading-tight">
                Verify Your Account
              </h2>
              <p className="text-on-surface-variant mt-3 font-body text-sm px-4 opacity-80">
                We've sent a 6-digit security code to{" "}
                <span className="text-primary font-bold">{email}</span>. Enter
                it below to access your vendor dashboard.
              </p>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_8px_32px_rgba(167,52,0,0.08)] border border-outline-variant/10">
              <form className="space-y-8" onSubmit={handleSubmit}>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-error-container text-error text-sm rounded-xl font-medium">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2 sm:gap-4">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      className="w-12 h-16 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-primary"
                      maxLength={1}
                      placeholder="•"
                      type="text"
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      disabled={loading}
                    />
                  ))}
                </div>
                <button
                  className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-semibold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Submit Code"}
                </button>
              </form>
              <div className="mt-6 text-center space-y-4">
                <button
                  onClick={handleResend}
                  className="text-primary font-semibold text-sm hover:underline underline-offset-4 decoration-primary/30 disabled:opacity-50"
                  disabled={timer > 0 || loading}
                >
                  {timer > 0
                    ? `Resend code in 00:${timer.toString().padStart(2, "0")}`
                    : "Resend code"}
                </button>

                <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">
                  Don't see it? Check your Spam or Promotions folder.
                </p>
              </div>
            </div>
          </section>

          <section className="relative bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/20 overflow-hidden">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Utensils className="text-primary" size={28} />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-headline text-2xl font-bold text-on-surface">
                  Approval Status
                </h3>
                <p className="text-on-surface-variant font-body text-sm leading-relaxed max-w-[280px] mx-auto">
                  We verify all food merchants to maintain high customer satisfaction.
                </p>
              </div>

              <div className="w-full space-y-4 pt-4">
                <div className="flex items-center gap-4 bg-surface-container-lowest/60 p-4 rounded-2xl">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <CheckCircle2 className="text-primary" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">
                      Account Registered
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Credentials validated
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-primary/5">
                  <div className="bg-primary p-2 rounded-lg text-white">
                    <Rocket size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">
                      Live Dashboard Access
                    </p>
                    <p className="text-xs text-primary font-medium">
                      Ready immediately upon verification
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={onSupport}
                className="flex items-center gap-2 text-primary font-bold text-sm hover:translate-x-1 transition-transform"
              >
                <span>Need help? Contact Merchant Support</span>
                <ArrowLeft className="rotate-180" size={16} />
              </button>
            </div>
          </section>
        </div>
      </main>

      <div
        className={cn(
          "fixed bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-300 z-50",
          showSuccess
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none",
        )}
      >
        <CheckCircle2 className="text-emerald-400" size={20} />
        <span className="text-sm font-medium">
          Code verified successfully. Loading dashboard...
        </span>
      </div>
    </div>
  );
};
