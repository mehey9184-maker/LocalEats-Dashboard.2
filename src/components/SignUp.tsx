import React, { useState } from 'react';
import { supabase, DASHBOARD_URL } from '../lib/supabase';
import { ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

interface SignUpProps {
  onSignInClick: () => void;
  onSuccess: (email: string) => void;
}

export const SignUp: React.FC<SignUpProps> = ({ onSignInClick, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate password strength score (0 to 4)
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[0-9]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];

  const formatSignUpError = (err: unknown): string => {
    if (!err) return 'Unable to create account. Please try again.';
    const raw = typeof err === 'string' ? err : (err as Error)?.message || JSON.stringify(err);
    const lower = raw.toLowerCase();

    if (
      lower.includes('user_already_exists') ||
      lower.includes('user already registered') ||
      lower.includes('already registered') ||
      lower.includes('email address is already in use')
    ) {
      return 'An account with this email address already exists. Please sign in instead.';
    }

    if (
      lower.includes('password should be at least') ||
      lower.includes('password is too short') ||
      lower.includes('weak_password') ||
      lower.includes('password must be')
    ) {
      return 'Password must be at least 6 characters long. Please enter a stronger password.';
    }

    if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
      return 'Please enter a valid email address.';
    }

    if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) {
      return 'Network request failed. Please check your connection and try again.';
    }

    if (!raw || raw === '{}' || raw === 'null') {
      return 'Unable to create account. Please check your details and try again.';
    }

    return raw;
  };

  const handleQuickCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email: 'mehey9184@gmail.com',
        password: '123456',
        options: {
          data: {
            full_name: 'Mehey',
          },
          emailRedirectTo: window.location.origin.includes('localhost') 
            ? window.location.origin 
            : DASHBOARD_URL
        },
      });
      if (error) setError(formatSignUpError(error));
      else onSuccess('mehey9184@gmail.com');
    } catch (err: unknown) {
      setError(formatSignUpError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: window.location.origin.includes('localhost') 
            ? window.location.origin 
            : DASHBOARD_URL
        },
      });

      if (error) {
        setError(formatSignUpError(error));
      } else {
        onSuccess(email);
      }
    } catch (err: unknown) {
      console.error('Sign up error:', err);
      setError(formatSignUpError(err));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased">
      <header className="fixed top-0 w-full z-50 bg-[#faf9f8]/70 backdrop-blur-xl flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
        <div className="text-2xl font-black text-[#a73400] tracking-tight font-headline">LocalEats</div>
        <button 
          onClick={onSignInClick}
          className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={20} />
          <span className="font-medium text-body-md">Back</span>
        </button>
      </header>

      <main 
        className="min-h-screen pt-16 flex items-center justify-center bg-cover bg-center" 
        style={{ 
          backgroundImage: 'linear-gradient(to bottom, rgba(250, 249, 248, 0.8), rgba(250, 249, 248, 0.95)), url(https://lh3.googleusercontent.com/aida-public/AB6AXuCvgT1Oubj-1M5ZU020_EDBN1r5UCYeFjzfSALHntK_-Kc_agV08X9isgYSUXfXH__TeBdWwfGSvo8FFzysykr7vuIIlBnQMf3jB059FYCAzNwuFQjJQDuunIRAt9ZECJF4nG8EKZb7IHLwYmQR-8nyakr8RE51dBbGuVjA39MHXLntU4AP0tFQANCYga9glhnxOK5zAZHgLE--SqHfsxmpgZn8fBbWZEaChlERGZXIMmQW-dR3a27mfT0Kl8YGlSW9RfQX0n-_kHvq)' 
        }}
      >
        <div className="w-full max-w-lg px-6 py-12">
          <div className="bg-surface-container-lowest/80 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_24px_-4_rgba(167,52,0,0.12)]">
            <div className="mb-10 text-center md:text-left">
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-3">Create Account</h1>
              <p className="text-on-surface-variant font-medium">Join the community celebrating authentic local flavors.</p>
            </div>

            <form className="space-y-6" onSubmit={handleSignUp}>
              {error && (
                <div className="p-4 bg-error-container/80 text-error text-sm rounded-2xl font-medium border border-error/20 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  {error.includes('already exists') && (
                    <button
                      type="button"
                      onClick={onSignInClick}
                      className="text-xs font-bold underline text-left hover:opacity-80 mt-1"
                    >
                      Click here to Sign In now →
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 mb-4">
                <button 
                  type="button"
                  onClick={handleQuickCreate}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-primary/10 text-primary text-sm font-bold rounded-xl border border-primary/20 hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? 'Processing...' : 'Quick Create: mehey9184@gmail.com'}
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="name">Full Name</label>
                <input 
                  className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50 font-medium" 
                  id="name" 
                  placeholder="John Doe" 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="email">Email Address</label>
                <input 
                  className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50 font-medium" 
                  id="email" 
                  placeholder="name@example.com" 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="password">Password</label>
                <div className="relative">
                  <input 
                    className="w-full h-14 pl-6 pr-14 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50 font-medium" 
                    id="password" 
                    placeholder="At least 6 characters" 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1.5 px-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant font-medium">Password strength:</span>
                      <span className="font-bold text-on-surface">{strengthLabels[strength]}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-full rounded-full transition-all duration-300 ${
                            strength >= level ? strengthColors[strength] : 'bg-surface-container-high'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      {password.length >= 6 ? (
                        <span className="text-emerald-600 flex items-center gap-1 font-medium">
                          <CheckCircle2 size={12} /> Minimum 6 characters met
                        </span>
                      ) : (
                        <span>Password must be at least 6 characters</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <button 
                className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-lg rounded-full shadow-[0_8px_24px_-4px_rgba(167,52,0,0.25)] hover:scale-[0.98] active:scale-95 transition-all duration-200 mt-4 disabled:opacity-50" 
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-10">
              <div className="relative flex items-center justify-center mb-8">
                <div className="flex-grow border-t border-outline-variant/30"></div>
                <span className="mx-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Or continue with</span>
                <div className="flex-grow border-t border-outline-variant/30"></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <button className="flex items-center justify-center h-14 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-2xl">brand_family</span>
                </button>
                <button className="flex items-center justify-center h-14 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-2xl">google</span>
                </button>
                <button className="flex items-center justify-center h-14 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-2xl">social_leaderboard</span>
                </button>
              </div>
            </div>

            <div className="mt-10 text-center">
              <p className="text-on-surface-variant font-medium">
                Already have an account? 
                <button 
                  onClick={onSignInClick}
                  className="text-primary font-bold ml-1 hover:underline transition-all"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center px-4">
            <p className="text-xs text-on-surface-variant/60 leading-relaxed max-w-xs mx-auto">
              By joining, you agree to our Terms of Service and Privacy Policy. Experience the soul of the community through every bite.
            </p>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 w-full py-6 flex justify-center pointer-events-none">
        <div className="bg-surface-container-lowest/40 backdrop-blur-md px-6 py-2 rounded-full border border-outline-variant/10 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
          Savor Foundry • The Art of Local
        </div>
      </footer>
    </div>
  );
};
