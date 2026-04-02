import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';

interface SignUpProps {
  onSignInClick: () => void;
  onSuccess: (email: string) => void;
}

export const SignUp: React.FC<SignUpProps> = ({ onSignInClick, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        },
      });
      if (error) setError(error.message);
      else onSuccess('mehey9184@gmail.com');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        },
      });

      if (error) {
        setError(error.message);
      } else {
        onSuccess(email);
      }
    } catch (err: unknown) {
      console.error('Sign up error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
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
                <div className="p-3 bg-error-container text-error text-sm rounded-xl font-medium">
                  {error}
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
                  className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50" 
                  id="name" 
                  placeholder="John Doe" 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="email">Email</label>
                <input 
                  className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50" 
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
                <input 
                  className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-secondary-container/50" 
                  id="password" 
                  placeholder="••••••••" 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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
