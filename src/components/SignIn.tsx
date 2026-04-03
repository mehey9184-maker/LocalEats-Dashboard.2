import React, { useState } from 'react';
import { supabase, DASHBOARD_URL } from '../lib/supabase';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface SignInProps {
  onSignUpClick: () => void;
  onSuccess: () => void;
}

export const SignIn: React.FC<SignInProps> = ({ onSignUpClick, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'mehey9184@gmail.com',
        password: '123456',
      });
      if (error) setError(error.message);
      else onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        onSuccess();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('Forbidden use of secret API key')) {
        setError('CRITICAL: You are using a Supabase SECRET key in the browser. Please update your project secrets with the public "anon" key.');
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin.includes('localhost') 
          ? window.location.origin 
          : DASHBOARD_URL
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Map Background Container */}
      <div 
        className="fixed inset-0 z-0 opacity-40 bg-cover bg-center" 
        style={{ 
          backgroundImage: 'linear-gradient(to bottom, rgba(250, 249, 248, 0.85), rgba(250, 249, 248, 0.95)), url(https://lh3.googleusercontent.com/aida-public/AB6AXuDpo3ytRjCCVyGfOx8vGTzvtfy3b1GeTJEPyP4vpYshrklT0O-zBSqSa4qcb3TGtt8Hjxa3bJXDVUX5Ui4L_tEC8GT3nUrF1jewKoPsmbXm1CaOayRI4_yvfqe2q4j439_UzgMZkr5ZhE7S1uZMS8NzP0mM3k0lYyw7rrf3R4TdIqSwnc3MiHMpgANMfXcJ1J4Qk3j3edvEoOIRvjQIWi68REV2D4w0HPEqYW80JMrnkxRmvBGCEmL0VNK_8VsSj6FfGt2EH4LC4f-q)' 
        }}
      ></div>

      <main className="relative z-10 w-full max-w-md">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <span className="text-4xl font-headline font-black text-primary tracking-tighter">LocalEats</span>
          </div>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-2">Welcome Back</h1>
          <p className="text-on-surface-variant font-medium">Taste the finest flavors from your neighborhood</p>
        </header>

        <div className="bg-surface-container-lowest/70 backdrop-blur-2xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_8px_32px_-4px_rgba(167,52,0,0.08)]">
          <form className="space-y-6" onSubmit={handleSignIn}>
            {error && (
              <div className="p-3 bg-error-container text-error text-sm rounded-xl font-medium">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 mb-4">
              <button 
                type="button"
                onClick={handleQuickSignIn}
                disabled={loading}
                className="w-full py-3 px-4 bg-primary/10 text-primary text-sm font-bold rounded-xl border border-primary/20 hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Processing...' : 'Quick Sign In: mehey9184@gmail.com'}
              </button>
              <button 
                type="button"
                onClick={() => onSuccess()}
                className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 hover:text-primary transition-colors"
              >
                Dev: Bypass Login
              </button>
            </div>
            
            <div className="relative group">
              <input 
                className="peer w-full h-14 px-4 pt-4 bg-surface-container-low border-0 rounded-xl font-medium focus:ring-2 focus:ring-primary/40 transition-all outline-none" 
                id="email" 
                placeholder=" " 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label 
                className={cn(
                  "absolute left-4 top-4 text-on-surface-variant transition-all pointer-events-none origin-left font-medium",
                  "peer-focus:-translate-y-3 peer-focus:scale-85 peer-focus:text-primary",
                  email && "-translate-y-3 scale-85 text-primary"
                )} 
                htmlFor="email"
              >
                Email
              </label>
            </div>

            <div className="space-y-2">
              <div className="relative group">
                <input 
                  className="peer w-full h-14 px-4 pt-4 bg-surface-container-low border-0 rounded-xl font-medium focus:ring-2 focus:ring-primary/40 transition-all outline-none" 
                  id="password" 
                  placeholder=" " 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label 
                  className={cn(
                    "absolute left-4 top-4 text-on-surface-variant transition-all pointer-events-none origin-left font-medium",
                    "peer-focus:-translate-y-3 peer-focus:scale-85 peer-focus:text-primary",
                    password && "-translate-y-3 scale-85 text-primary"
                  )} 
                  htmlFor="password"
                >
                  Password
                </label>
                <button 
                  className="absolute right-4 top-4 text-on-surface-variant hover:text-primary transition-colors" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="flex justify-end">
                <a className="text-sm font-semibold text-primary hover:text-primary-container transition-colors" href="#">Forgot Password?</a>
              </div>
            </div>

            <button 
              className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold text-lg rounded-full shadow-[0_8px_24px_-4px_rgba(167,52,0,0.24)] hover:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50" 
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="relative my-8 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/30"></div>
            </div>
            <span className="relative bg-surface-container-lowest px-4 text-sm font-medium text-on-surface-variant">Or sign in with</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">
              <img alt="Apple" className="w-6 h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0SuyKRe4g5isYxOciXyelHnKHREY12F52qsok5Sqyk9RIDv2KdXpZz2IXb6fYyQtjwZLZitzEYevD_mSOeFcXiDWwwgh7F_1X5jhAO4EY3ReicQ8O9O4lsRytYJkM7BJaWen4PkcjEtlAiOlxF1pNS3IrJRKq8uDVhFkRMT7nd2O02TIIH1-ohQLQsdMliomomyXj6-PJ-dcsePyoGfSBzkj1GEJenyqbYl2goCjjmnaRzZY2npV5XKqh9ZqpXbR2qIukfNxGS5g4" />
            </button>
            <button 
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors"
            >
              <img alt="Google" className="w-6 h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDh8F_fAUj4zQCD3cvudifgOu8FSnMSr5914O4ZdQ0syvl1em_nBuD0YKMjSUWEd1D3aLZWWYOzYWD0zkAGclyaQVHrnbBXCDinc7tFcHsfgYRR3-6y-i9UKlh4MoRNpu1C5Cm7cReNcKC_trJPSCSR3ZFPrdZjMDio1T7ZM_MbVcN23ueFSKOO-KXPzS8xjTGRrzSuopIkeYHEs1th9kNxgORHRLRszNCu5NPKQ9wScZrEXo3D7qkE6E6lSiRqoClX8beS5sWojYBq" />
            </button>
            <button className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">
              <img alt="Facebook" className="w-6 h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHZvHeeZJgxe25J1yB4m--QlTkIeHQObpRVAvdAZWJYCKHjdEiual7NCsnmBKqqI5Wjv5PE4_ZBtQz6vUcoK5XsrlegrtBBfYxBkjOFNX5QDjfOkkzA-vlnFMqmFEUvM_5G0sb-_u80OrmWmebzyK8Bio-EiLqb0VAfZHatmPV0ARAznWK1S_BAzwn0Duk8Lat093f6uJncggwDWDw0ZPgHSoV-uCrI9UvkPDlri75SHVtdawTz0E7J1t1Jz2ju0qxUD3ULxgztz6N" />
            </button>
          </div>
        </div>

        <footer className="mt-8 text-center">
          <p className="text-on-surface-variant font-medium">
            Don't have an account? 
            <button 
              onClick={onSignUpClick}
              className="text-primary font-bold ml-1 hover:underline decoration-2 underline-offset-4 transition-all"
            >
              Sign Up
            </button>
          </p>
        </footer>
      </main>

      <div className="fixed bottom-0 right-0 p-8 hidden lg:block">
        <div className="flex flex-col items-end opacity-20">
          <span className="text-6xl font-headline font-black text-primary -mb-2 tracking-tighter">LE</span>
          <div className="w-12 h-1.5 bg-primary rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
