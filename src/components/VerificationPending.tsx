import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Rocket, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface VerificationPendingProps {
  email: string;
  onBack: () => void;
  onVerified: () => void;
  onSupport: () => void;
}

export const VerificationPending: React.FC<VerificationPendingProps> = ({ email, onBack, onVerified, onSupport }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(59);
  const [showSuccess, setShowSuccess] = useState(false);
  console.log('Show Success:', showSuccess); // Use the variable to satisfy linter
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setError('Email limit reached (3 per hour). Please wait an hour or contact support.');
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
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    
    setError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setError('Email limit reached (3 per hour). Please wait an hour or contact support.');
        } else {
          setError(error.message);
        }
      } else {
        setTimer(59);
        // Clear OTP inputs
        setOtp(['', '', '', '', '', '']);
        const firstInput = document.getElementById('otp-0');
        firstInput?.focus();
      }
    } catch (err: unknown) {
      console.error('Resend error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased">
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-[#faf9f8]/70 backdrop-blur-xl shadow-[0_8px_24px_-4px_rgba(167,52,0,0.12)]">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-7xl mx-auto">
          <button 
            onClick={onBack}
            className="p-2 text-primary hover:bg-surface-container-low rounded-full transition-colors active:scale-95 duration-200"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-headline text-2xl font-black text-primary tracking-tighter">LocalEats</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="min-h-screen pt-24 pb-12 px-6 soft-map-bg flex flex-col items-center justify-center overflow-x-hidden">
        <div className="max-w-md w-full space-y-8">
          {/* Verification Section */}
          <section className="relative">
            <div className="text-center mb-10">
              <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight leading-tight">Verify Your Account</h2>
              <p className="text-on-surface-variant mt-3 font-body text-sm px-4 opacity-80">
                We've sent a 6-digit security code to <span className="text-primary font-bold">{email}</span>. Enter it below to access the foundry.
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
                {/* OTP Inputs */}
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
                      disabled={loading}
                    />
                  ))}
                </div>
                <button 
                  className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-semibold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Submit Code'}
                </button>
              </form>
              <div className="mt-6 text-center space-y-4">
                <button 
                  onClick={handleResend}
                  className="text-primary font-semibold text-sm hover:underline underline-offset-4 decoration-primary/30 disabled:opacity-50"
                  disabled={timer > 0 || loading}
                >
                  {timer > 0 ? `Resend code in 00:${timer.toString().padStart(2, '0')}` : 'Resend code'}
                </button>
                
                <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">
                  Don't see it? Check your <span className="text-primary/60">Spam</span> or <span className="text-primary/60">Promotions</span> folder.
                </p>

                <button 
                  onClick={() => alert("Common reasons for missing emails:\n1. Free tier limit (3 per hour)\n2. SMTP not configured in Supabase\n3. Email provider disabled in Auth settings")}
                  className="text-[10px] text-primary/40 hover:text-primary transition-colors underline underline-offset-2"
                >
                  Still not receiving?
                </button>
              </div>
            </div>
          </section>

          {/* Separator */}
          <div className="flex items-center gap-4 py-4">
            <div className="h-px bg-outline-variant/30 flex-1"></div>
            <span className="text-outline text-xs font-bold uppercase tracking-widest">Or Status</span>
            <div className="h-px bg-outline-variant/30 flex-1"></div>
          </div>

          {/* Approval Pending Section */}
          <section className="relative bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/20 overflow-hidden">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Subtle Loading/Pending Illustration */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>restaurant_menu</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-headline text-2xl font-bold text-on-surface">Approval Pending</h3>
                <p className="text-on-surface-variant font-body text-sm leading-relaxed max-w-[280px] mx-auto">
                  We're reviewing your application. You'll be notified once you're ready to start savoring!
                </p>
              </div>

              {/* Process Steps */}
              <div className="w-full space-y-4 pt-4">
                <div className="flex items-center gap-4 bg-surface-container-lowest/60 p-4 rounded-2xl">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <CheckCircle2 className="text-primary" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">Account Created</p>
                    <p className="text-xs text-on-surface-variant">Completed on Oct 12</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-primary/5">
                  <div className="bg-primary p-2 rounded-lg text-white">
                    <Clock size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">Admin Review</p>
                    <p className="text-xs text-primary font-medium">Currently in progress...</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-container-lowest/40 p-4 rounded-2xl opacity-50">
                  <div className="bg-surface-variant p-2 rounded-lg">
                    <Rocket className="text-on-surface-variant" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">Foundry Access</p>
                    <p className="text-xs text-on-surface-variant">Unlocks after approval</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={onSupport}
                className="flex items-center gap-2 text-primary font-bold text-sm hover:translate-x-1 transition-transform"
              >
                <span>Contact Support</span>
                <ArrowLeft className="rotate-180" size={16} />
              </button>
            </div>

            {/* Decoration Blobs */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-tertiary/5 rounded-full blur-3xl"></div>
          </section>
        </div>
      </main>

      {/* Success Message Pop-up */}
      <div className={cn(
        "fixed bottom-12 left-1/2 -translate-x-1/2 bg-on-background text-background px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-300",
        showSuccess ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <CheckCircle2 className="text-primary-fixed" size={20} />
        <span className="font-label text-sm font-medium">Code verified successfully.</span>
      </div>
    </div>
  );
};
