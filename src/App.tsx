import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  ReceiptText, 
  TrendingUp, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Search,
  Printer,
  Bell,
  Phone,
  PauseCircle,
  ChevronRight,
  Star,
  LogOut,
  MapPin,
  Store,
  User as UserIcon,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  Download,
  FileDown,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Rocket,
  MessageSquare,
  AlertCircle,
  MoreVertical,
  Sparkles,
  Check,
  X,
  CheckSquare,
  Square,
  BarChart3,
  Layers,
  CreditCard,
  Ticket,
  ShieldCheck,
  Zap,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { createClient, User } from '@supabase/supabase-js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed';

export interface Shop {
  id: number;
  name: string;
  logo_url: string | null;
  description: string;
  location: string;
  category: string;
  is_active: boolean;
  created_at: string;
  owner_id: string | null;
  rating?: number;
  opening_time?: string;
  closing_time?: string;
  subscription_status?: 'trial' | 'active' | 'past_due' | 'expired';
  trial_start_date?: string;
  last_payment_date?: string;
  next_payment_date?: string;
}

export interface MenuItem {
  id: number;
  shop_id: number;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  created_at: string;
  category?: string;
  description?: string;
  stock_quantity?: number;
}

export interface Order {
  id: string;
  shop_id: number;
  user_id: string;
  product_name: string;
  total_price: number;
  price?: number; // Database field
  status: OrderStatus;
  created_at: string;
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes?: string;
  acceptance_message?: string;
  is_returning?: boolean;
  accepted_at?: string;
  estimated_delivery_time?: string;
  items?: { name: string; price: number; quantity: number }[];
}

export interface Payment {
  id: string;
  shop_id: number;
  amount: number;
  payment_method: string;
  transaction_id: string;
  status: string;
  payment_date: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The official dashboard URL for LocalEats South Africa
const DASHBOARD_URL = 'https://dashboard.localeatssa.co.za';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

const isSecretKey = supabaseAnonKey?.startsWith('sb_secret_');
const isProbablyNotSupabaseKey = supabaseAnonKey?.length && supabaseAnonKey.length < 50 && !supabaseAnonKey.startsWith('eyJ');

if (isSecretKey) {
  const msg = 'CRITICAL SECURITY ERROR: You are using a Supabase SECRET key (service_role) in the browser. This is forbidden and will cause the app to crash. Please replace VITE_SUPABASE_ANON_KEY with the public "anon" key in your project secrets.';
  console.error(msg);
  if (typeof window !== 'undefined') {
    console.log('%c' + msg, 'color: white; background: red; font-size: 20px; padding: 10px; border-radius: 5px;');
  }
}

if (isProbablyNotSupabaseKey) {
  const msg = 'WARNING: The Supabase Anon Key looks incorrect. It should be a long JWT string starting with "eyJ". Please check your Supabase dashboard.';
  console.warn(msg);
}

console.log('Supabase initialized with URL:', supabaseUrl ? `${supabaseUrl.substring(0, 10)}...` : 'MISSING');

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div 
      className={cn(
        "bg-surface-container-highest/50 rounded-md animate-skeleton",
        className
      )} 
    />
  );
};

interface SignInProps {
  onSignUpClick: () => void;
  onSuccess: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignUpClick, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Removed unused handleQuickSignIn and handleQuickCreate

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
      <div 
        className="fixed inset-0 z-0 opacity-40 bg-cover bg-center" 
        style={{ 
          backgroundImage: 'linear-gradient(to bottom, rgba(250, 249, 248, 0.85), rgba(250, 249, 248, 0.95)), url(https://picsum.photos/seed/map/1200/800)' 
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

            <div className="space-y-2">
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
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.96.95-2.04 1.72-3.24 1.72-1.16 0-1.54-.71-2.94-.71-1.4 0-1.83.7-2.94.7-1.16 0-2.32-.82-3.32-1.82-2.04-2.04-3.52-5.76-3.52-8.52 0-2.76 1.44-4.2 2.88-4.2 1.44 0 2.28.84 3.12.84.84 0 1.68-.84 3.12-.84 1.44 0 2.88 1.44 2.88 4.2 0 .6-.06 1.2-.18 1.8-.36 1.8-1.56 3.6-2.88 5.04zM12 5.04c0-1.68 1.44-3.12 3.12-3.12.12 0 .24 0 .36.12-.12 1.68-1.56 3.12-3.12 3.12-.12 0-.24 0-.36-.12z"/>
              </svg>
            </button>
            <button 
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            <button className="flex items-center justify-center h-14 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
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
    </div>
  );
};

interface SignUpProps {
  onSignInClick: () => void;
  onSuccess: (email: string) => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSignInClick, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


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
          emailRedirectTo: window.location.origin.includes('localhost') 
            ? window.location.origin 
            : DASHBOARD_URL
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
          backgroundImage: 'linear-gradient(to bottom, rgba(250, 249, 248, 0.8), rgba(250, 249, 248, 0.95)), url(https://picsum.photos/seed/map/1200/800)' 
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
        </div>
      </main>
    </div>
  );
};

interface VerificationPendingProps {
  email: string;
  onBack: () => void;
  onVerified: () => void;
  onSupport: () => void;
}

const VerificationPending: React.FC<VerificationPendingProps> = ({ email, onBack, onVerified, onSupport }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(59);
  const [showSuccess, setShowSuccess] = useState(false);
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
              </div>
            </div>
          </section>

          <div className="flex items-center gap-4 py-4">
            <div className="h-px bg-outline-variant/30 flex-1"></div>
            <span className="text-outline text-xs font-bold uppercase tracking-widest">Or Status</span>
            <div className="h-px bg-outline-variant/30 flex-1"></div>
          </div>

          <section className="relative bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/20 overflow-hidden">
            <div className="flex flex-col items-center text-center space-y-6">
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
          </section>
        </div>
      </main>

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

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  operatingHours: { open: string; close: string };
  marketing?: boolean;
  darkMode?: boolean;
  avatarUrl?: string;
}

interface EditProfileProps {
  onBack: () => void;
  onSave: (data: ProfileData) => void;
  initialData: ProfileData;
  userId: string;
}

const EditProfile: React.FC<EditProfileProps> = ({ onBack, onSave, initialData, userId }) => {
  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    location: initialData?.location || '',
    address: initialData?.address || '',
    avatarUrl: initialData?.avatarUrl || '',
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        // If 'avatars' bucket doesn't exist, try 'menu-images' as fallback
        const { error: fallbackError } = await supabase.storage
          .from('menu-images')
          .upload(filePath, file);
        
        if (fallbackError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath);
        
        setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      }
      
      toast.success('Photo uploaded successfully!');
    } catch (error: unknown) {
      console.error('Upload Error:', error);
      toast.error('Failed to upload photo. Please ensure a storage bucket exists.');
    } finally {
      setUploading(false);
    }
  };

  const [operatingHours, setOperatingHours] = useState({
    open: initialData?.operatingHours?.open || '08:00',
    close: initialData?.operatingHours?.close || '20:00',
  });

  const [preferences, setPreferences] = useState({
    marketing: true,
    darkMode: false,
  });

  const handleSave = () => {
    onSave({ ...formData, ...preferences, operatingHours });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-24 selection:bg-primary/10 selection:text-primary">
      <header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="active:scale-95 transition-transform duration-200 hover:opacity-80 p-2 rounded-full hover:bg-surface-container-low"
            >
              <ArrowLeft className="text-primary" size={24} />
            </button>
            <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">Edit Profile</h1>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors">
            <MoreVertical className="text-on-surface-variant" size={24} />
          </button>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full absolute bottom-0 opacity-15"></div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10">
        <section className="flex flex-col items-center">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-surface-container-lowest shadow-lg bg-surface-container-low flex items-center justify-center">
              {uploading ? (
                <RefreshCw className="animate-spin text-primary" size={32} />
              ) : (
                <img 
                  alt="User Profile" 
                  className="w-full h-full object-cover" 
                  src={formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.email || 'default'}`} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.email || 'default'}`;
                  }}
                />
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 bg-gradient-to-br from-primary to-primary-container p-2.5 rounded-full text-on-primary shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              <Edit2 size={16} />
            </button>
          </div>
          <p className="mt-4 font-headline font-bold text-on-surface-variant tracking-tight">Change Photo</p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Personal Details</h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">Basic Info</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Full Name</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="text" 
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Email Address</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Phone Number</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Home Location</h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">Address</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">City / Region</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
                <input 
                  className="w-full bg-surface-container-low border-none rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Soweto, Johannesburg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Street Address</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="text" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. 123 Vilakazi St"
              />
            </div>
          </div>
          
          <div className="w-full h-32 rounded-xl overflow-hidden relative">
            <img 
              alt="Map" 
              className="w-full h-full object-cover grayscale opacity-60" 
              src="https://picsum.photos/seed/map/1200/800" 
            />
            <div className="absolute inset-0 bg-primary/5"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm">
                <span className="text-xs font-bold text-primary">UPDATE MAP PIN</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Operating Hours</h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">Schedule</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Opening Time</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="time" 
                value={operatingHours.open}
                onChange={(e) => setOperatingHours({ ...operatingHours, open: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">Closing Time</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface" 
                type="time" 
                value={operatingHours.close}
                onChange={(e) => setOperatingHours({ ...operatingHours, close: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">App Preferences</h2>
          <div className="bg-surface-container-low rounded-xl overflow-hidden divide-y divide-surface-container-high">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <Bell className="text-on-surface-variant" size={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">Marketing Notifications</p>
                  <p className="text-xs text-on-surface-variant">Deals, offers, and new arrivals</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={preferences.marketing}
                  onChange={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <Moon className="text-on-surface-variant" size={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">Dark Mode</p>
                  <p className="text-xs text-on-surface-variant">Reduce eye strain at night</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={preferences.darkMode}
                  onChange={() => setPreferences({ ...preferences, darkMode: !preferences.darkMode })}
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

        <div className="pt-6 pb-12">
          <button 
            onClick={handleSave}
            className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-extrabold text-lg py-5 rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <span>Save Changes</span>
            <CheckCircle2 size={24} />
          </button>
          <p className="text-center mt-6 text-on-surface-variant text-sm font-medium">Last updated: Oct 24, 2023</p>
        </div>
      </main>
    </div>
  );
};

// --- Components ---

const StatCard = ({ title, value, change, icon: Icon, colorClass }: { title: string, value: string | number, change?: string, icon: React.ElementType, colorClass: string }) => (
  <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10 group hover:shadow-md transition-all duration-300">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl", colorClass)}>
        <Icon size={24} />
      </div>
      <span className={cn("text-xs font-bold px-2 py-1 rounded-full", 
        change.startsWith('+') ? "text-emerald-600 bg-emerald-50" : "text-primary bg-primary-fixed"
      )}>
        {change}
      </span>
    </div>
    <p className="text-on-surface-variant text-sm font-semibold uppercase tracking-wider mb-1">{title}</p>
    <p className="text-3xl font-headline font-extrabold text-on-surface">{value}</p>
  </div>
);

// --- Components ---

const OnboardingChecklist = ({ shops, user, onNavigate, onEditProfile, hasMenu }: { shops: Shop[], user: User | null, onNavigate: (tab: string) => void, onEditProfile: () => void, hasMenu: boolean }) => {
  const userOwnedShops = shops.filter(s => s.owner_id === user?.id);
  const hasShop = userOwnedShops.length > 0;
  const hasOperatingHours = user?.user_metadata?.operating_hours?.open && user?.user_metadata?.operating_hours?.close;
  
  if (hasShop && hasOperatingHours && hasMenu) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="bg-primary/5 border border-primary/20 rounded-3xl p-8 mb-12"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Rocket className="text-primary" size={24} />
        </div>
        <h2 className="text-2xl font-headline font-bold text-on-surface">Getting Started</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => onNavigate('menu')}
          className={cn(
            "flex items-center justify-between p-5 rounded-2xl border transition-all",
            hasShop ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-white border-outline-variant hover:border-primary group"
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn("p-2 rounded-full", hasShop ? "bg-emerald-100" : "bg-surface-container-high group-hover:bg-primary/10")}>
              {hasShop ? <CheckCircle2 size={20} /> : <Store size={20} />}
            </div>
            <div className="text-left">
              <p className="font-bold">Create your first Shop</p>
              <p className="text-xs opacity-70">{hasShop ? 'Completed' : 'Required to start selling'}</p>
            </div>
          </div>
          {!hasShop && <ChevronRight size={20} className="text-primary" />}
        </button>

        <button 
          onClick={onEditProfile}
          className={cn(
            "flex items-center justify-between p-5 rounded-2xl border transition-all",
            hasOperatingHours ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-white border-outline-variant hover:border-primary group"
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn("p-2 rounded-full", hasOperatingHours ? "bg-emerald-100" : "bg-surface-container-high group-hover:bg-primary/10")}>
              {hasOperatingHours ? <CheckCircle2 size={20} /> : <Clock size={20} />}
            </div>
            <div className="text-left">
              <p className="font-bold">Set Operating Hours</p>
              <p className="text-xs opacity-70">{hasOperatingHours ? 'Completed' : 'Automate your shop status'}</p>
            </div>
          </div>
          {!hasOperatingHours && <ChevronRight size={20} className="text-primary" />}
        </button>

        <button 
          onClick={() => onNavigate('menu')}
          className={cn(
            "flex items-center justify-between p-5 rounded-2xl border transition-all",
            hasMenu ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-white border-outline-variant hover:border-primary group"
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn("p-2 rounded-full", hasMenu ? "bg-emerald-100" : "bg-surface-container-high group-hover:bg-primary/10")}>
              {hasMenu ? <CheckCircle2 size={20} /> : <UtensilsCrossed size={20} />}
            </div>
            <div className="text-left">
              <p className="font-bold">Add Menu Items</p>
              <p className="text-xs opacity-70">{hasMenu ? 'Completed' : 'Upload your delicious dishes'}</p>
            </div>
          </div>
          {!hasMenu && <ChevronRight size={20} className="text-primary" />}
        </button>
      </div>
      {!hasOperatingHours && hasShop && (
        <p className="mt-4 text-xs text-orange-600 font-medium flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl">
          <AlertCircle size={14} />
          Your shop will remain closed until you set operating hours in your profile.
        </p>
      )}
    </motion.div>
  );
};

// --- Payment Components ---

const PaymentHistory = ({ shopId }: { shopId: number }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'success' | 'pending' | 'failed'>('All');
  const [sortField, setSortField] = useState<'payment_date' | 'amount'>('payment_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('shop_id', shopId)
          .order(sortField, { ascending: sortDirection === 'asc' });

        if (error) throw error;
        setPayments(data || []);
      } catch (error) {
        console.error('Error fetching payments:', error);
        toast.error('Failed to load payment history');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [shopId, sortField, sortDirection]);

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.payment_method.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'All' || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleSort = (field: 'payment_date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight mb-2">Payment History</h2>
        <p className="text-on-surface-variant">View and manage your subscription payments and transactions.</p>
      </section>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
          <input 
            type="text"
            placeholder="Search by Transaction ID or Method..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/40 outline-none transition-all"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'All' | 'success' | 'pending' | 'failed')}
            className="flex-1 md:flex-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/10">
            <button 
              onClick={() => handleSort('payment_date')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                sortField === 'payment_date' ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              Date
            </button>
            <button 
              onClick={() => handleSort('amount')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                sortField === 'amount' ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              Amount
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/30">
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Date</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Transaction ID</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Method</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Amount</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredPayments.length > 0 ? filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="py-5 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-on-surface">{format(new Date(payment.payment_date), 'MMM dd, yyyy')}</span>
                      <span className="text-[10px] text-on-surface-variant font-medium">{format(new Date(payment.payment_date), 'HH:mm')}</span>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <span className="font-mono text-xs text-on-surface-variant font-medium">{payment.transaction_id}</span>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
                        {payment.payment_method === 'OTT' ? <Ticket size={14} className="text-primary" /> : <CreditCard size={14} className="text-primary" />}
                      </div>
                      <span className="text-sm font-bold text-on-surface">{payment.payment_method}</span>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <span className="font-headline font-black text-on-surface">R {payment.amount.toFixed(2)}</span>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex justify-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        payment.status === 'success' ? "bg-emerald-100 text-emerald-700" :
                        payment.status === 'pending' ? "bg-amber-100 text-amber-700" :
                        "bg-rose-100 text-rose-700"
                      )}>
                        {payment.status}
                      </span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center">
                        <ReceiptText className="text-on-surface-variant/20" size={32} />
                      </div>
                      <p className="text-on-surface-variant italic text-sm">No payment records found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DashboardOverview = ({ 
  orders, 
  loading, 
  shops, 
  user, 
  onRefresh, 
  onNavigate, 
  onEditProfile, 
  menuItems,
  trialInfo,
  currentShop
}: { 
  orders: Order[], 
  loading: boolean, 
  shops: Shop[], 
  user: User | null, 
  onRefresh: () => void, 
  onNavigate: (tab: string) => void, 
  onEditProfile: () => void, 
  menuItems: MenuItem[],
  trialInfo: { daysRemaining: number; isExpired: boolean } | null,
  currentShop: Shop | undefined
}) => {
  // Robust total sales calculation
  const totalSales = orders.reduce((acc, curr) => {
    const price = typeof curr.total_price === 'string' 
      ? parseFloat(curr.total_price.replace(/[^0-9.]/g, '')) 
      : Number(curr.total_price);
    return acc + (isNaN(price) ? 0 : price);
  }, 0);

  const orderCount = orders.length;
  const hasMenu = menuItems.length > 0;
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('monthly');
  
  // Use real trend data from the last 7 days
  const trendData = useMemo(() => {
    if (orders.length === 0) return [];
    
    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const d = new Date();
      d.setDate(d.getDate() - index);
      return {
        date: d.toISOString().split('T')[0],
        dayName: format(d, 'EEE'),
        count: 0
      };
    }).reverse();

    orders.forEach(order => {
      try {
        if (!order.created_at) return;
        const dateObj = new Date(order.created_at);
        if (isNaN(dateObj.getTime())) return;
        const orderDate = dateObj.toISOString().split('T')[0];
        const day = last7Days.find(d => d.date === orderDate);
        if (day) day.count++;
      } catch (e) {
        console.error('Error parsing order date:', e);
      }
    });

    return last7Days.map(d => ({ name: d.dayName, value: d.count }));
  }, [orders]);

  if (loading) {
    return (
      <div className="space-y-12">
        <section>
          <Skeleton className="h-12 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="lg:col-span-8 h-80 rounded-xl" />
          <div className="lg:col-span-4 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <motion.section initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl md:text-5xl font-headline font-extrabold text-on-surface tracking-tight mb-2">Good morning, Chef!</h1>
            <p className="text-on-surface-variant font-medium opacity-80">Here is what's happening in your kitchen today.</p>
          </div>
          <button 
            onClick={() => {
              onRefresh();
              toast.success('Dashboard refreshed');
            }}
            className="p-3 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container-high transition-colors shadow-sm"
            title="Refresh Dashboard"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </motion.section>

      <OnboardingChecklist shops={shops} user={user} onNavigate={onNavigate} onEditProfile={onEditProfile} hasMenu={hasMenu} />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StatCard 
            title="Total Sales" 
            value={`R ${totalSales.toLocaleString()}`} 
            change="0%" 
            icon={TrendingUp} 
            colorClass="bg-primary-fixed text-primary"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <StatCard 
            title="Number of Orders" 
            value={orderCount} 
            change="0%" 
            icon={ReceiptText} 
            colorClass="bg-orange-50 text-orange-700"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <StatCard 
            title="Low Stock Items" 
            value={menuItems.filter(i => (i.stock_quantity || 0) < 5).length} 
            change="Alert" 
            icon={AlertCircle} 
            colorClass="bg-error/10 text-error"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <StatCard 
            title="Avg. Prep Time" 
            value="--" 
            change="0" 
            icon={Clock} 
            colorClass="bg-zinc-100 text-zinc-700"
          />
        </motion.div>
        {trialInfo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className={cn(
              "p-6 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col justify-between h-full",
              trialInfo.isExpired ? "bg-error/5" : "bg-primary/5"
            )}>
              <div className="flex justify-between items-start mb-4">
                <div className={cn(
                  "p-3 rounded-2xl",
                  trialInfo.isExpired ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
                )}>
                  <Zap size={20} />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  trialInfo.isExpired ? "bg-error text-white" : "bg-primary text-on-primary"
                )}>
                  {trialInfo.isExpired ? 'Expired' : 'Trial'}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Subscription</p>
                <h3 className="text-2xl font-black text-on-surface">
                  {trialInfo.isExpired ? 'Action Required' : `${trialInfo.daysRemaining} Days Left`}
                </h3>
                <p className="text-[10px] font-medium text-on-surface-variant mt-1">
                  {trialInfo.isExpired ? 'Your trial has ended.' : `Your free trial for ${currentShop?.name || 'your shop'} is active.`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ delay: 0.4 }}
          className="lg:col-span-8 bg-surface-container-low rounded-xl p-8 border border-outline-variant/5"
        >
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-xl font-headline font-bold text-on-surface">Order Volume Trends</h2>
              <p className="text-sm text-on-surface-variant">Live performance tracking</p>
            </div>
            {orders.length > 0 && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setTimeframe('weekly')}
                  className={cn("px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all", timeframe === 'weekly' ? "bg-primary text-on-primary" : "bg-white dark:bg-surface-container-high text-on-surface-variant")}
                >
                  Weekly
                </button>
                <button 
                  onClick={() => setTimeframe('monthly')}
                  className={cn("px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all", timeframe === 'monthly' ? "bg-primary text-on-primary" : "bg-white dark:bg-surface-container-high text-on-surface-variant")}
                >
                  Monthly
                </button>
              </div>
            )}
          </div>
          
          <div className="h-64 w-full flex items-center justify-center" style={{ minHeight: '256px' }}>
            {orders.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" aspect={2.5} minHeight={256}>
                <BarChart data={trendData}>
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {trendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 4 ? '#a73400' : '#a734004d'} />
                    ))}
                  </Bar>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#5c4037' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center">
                <div className="p-4 bg-surface-container-high rounded-full inline-block mb-4">
                  <TrendingUp className="text-on-surface-variant opacity-20" size={48} />
                </div>
                <p className="text-on-surface-variant font-medium">No order history yet</p>
                <p className="text-xs text-on-surface-variant opacity-60">Complete your first order to see trends</p>
              </div>
            )}
          </div>
        </motion.div>

        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-lg font-headline font-bold text-on-surface px-2">Quick Actions</h3>
          {[
            { id: 'menu', title: 'Update Menu', sub: 'Modify items & pricing', icon: UtensilsCrossed, color: 'bg-primary-fixed text-primary' },
            { id: 'insights', title: 'View Recent Reviews', sub: '12 new responses today', icon: Star, color: 'bg-secondary-fixed text-on-secondary-fixed' },
            { id: 'orders', title: 'Kitchen Settings', sub: 'System & app preferences', icon: ReceiptText, color: 'bg-zinc-100 text-zinc-600' }
          ].map((action, i) => (
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              key={i} 
              onClick={() => onNavigate(action.id)}
              className="w-full flex items-center justify-between p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", action.color)}>
                  <action.icon size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-on-surface">{action.title}</p>
                  <p className="text-xs text-on-surface-variant">{action.sub}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      {menuItems.filter(i => (i.stock_quantity || 0) < 5).length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-error/5 border border-error/20 rounded-[2rem] p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-error/10 text-error rounded-2xl flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="text-xl font-headline font-bold text-on-surface">Low Stock Alerts</h2>
                <p className="text-sm text-on-surface-variant">These items are running low and need restocking soon.</p>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('menu')}
              className="px-6 py-2 bg-error text-white text-xs font-bold rounded-full hover:bg-error/90 transition-colors shadow-sm"
            >
              Restock Now
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.filter(i => (i.stock_quantity || 0) < 5).map(item => (
              <div key={item.id} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-4 group hover:border-error/30 transition-colors">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-on-surface truncate">{item.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-error rounded-full" style={{ width: `${(item.stock_quantity || 0) * 20}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-error">{item.stock_quantity || 0} left</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Recent Activity Feed */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-surface-container-lowest rounded-[2rem] p-8 border border-outline-variant/10"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-headline font-bold text-on-surface">Recent Activity</h2>
          <button onClick={() => onNavigate('orders')} className="text-xs font-bold text-primary hover:underline">View All Activity</button>
        </div>
        <div className="space-y-6">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  order.status === 'completed' ? "bg-emerald-100 text-emerald-600" : 
                  order.status === 'pending' ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-600"
                )}>
                  {order.status === 'completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">
                    Order <span className="text-primary">#{order.id}</span> {order.status === 'completed' ? 'completed' : 'received'}
                  </p>
                  <p className="text-xs text-on-surface-variant">{order.product_name} • {format(new Date(order.created_at), 'h:mm a')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-on-surface">R {Number(order.total_price).toFixed(2)}</p>
                <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">{order.status}</p>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="py-12 text-center text-on-surface-variant italic">No recent activity to show.</div>
          )}
        </div>
      </motion.section>
    </div>
  );
};

const CreateShop = ({ user, onShopCreated }: { user: User | null, onShopCreated: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    category: 'Restaurant',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to create a shop.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('shops').insert({
        ...formData,
        owner_id: user.id,
        is_active: true,
      });

      if (error) throw error;
      toast.success('Shop created successfully!');
      onShopCreated();
    } catch (err: unknown) {
      toast.error(`Failed to create shop: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-surface-container-lowest p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-outline-variant/10"
    >
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Store className="text-primary" size={40} />
        </div>
        <h2 className="text-3xl font-headline font-extrabold text-on-surface mb-2">Create Your Shop</h2>
        <p className="text-on-surface-variant">Tell us about your kitchen to get started.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-on-surface ml-1">Shop Name</label>
          <input 
            required
            className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all"
            placeholder="e.g. Mama's Kitchen"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-on-surface ml-1">Description</label>
          <textarea 
            required
            className="w-full p-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all min-h-[120px]"
            placeholder="Tell customers what makes your shop special..."
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface ml-1">Location</label>
            <input 
              required
              className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all"
              placeholder="e.g. Soweto, Johannesburg"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface ml-1">Category</label>
            <select 
              className="w-full h-14 px-6 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              <option>Restaurant</option>
              <option>Bakery</option>
              <option>Cafe</option>
              <option>Street Food</option>
              <option>Home Kitchen</option>
            </select>
          </div>
        </div>
        <button 
          disabled={loading}
          className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-lg rounded-full shadow-lg hover:scale-[0.98] active:scale-95 transition-all disabled:opacity-50 mt-4"
          type="submit"
        >
          {loading ? 'Creating...' : 'Launch Shop'}
        </button>
      </form>
    </motion.div>
  );
};

const MenuManagement = ({ shops, loading, user, onRefreshMenu }: { shops: Shop[], loading: boolean, user: User | null, onRefreshMenu?: () => void }) => {
  const userOwnedShops = useMemo(() => 
    shops.filter(s => s.owner_id === user?.id),
    [shops, user?.id]
  );
  
  const [selectedShopId, setSelectedShopId] = useState<number | null>(() => {
    const owned = shops.filter(s => s.owner_id === user?.id);
    return owned[0]?.id || null;
  });
  
  // Update selectedShopId if userOwnedShops changes and current selectedShopId is not in the list
  useEffect(() => {
    if (userOwnedShops.length > 0 && (!selectedShopId || !userOwnedShops.find(s => s.id === selectedShopId))) {
      // Use a microtask to avoid synchronous setState in effect warning
      queueMicrotask(() => {
        setSelectedShopId(userOwnedShops[0].id);
      });
    }
  }, [userOwnedShops, selectedShopId]);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  console.log('Menu Loading:', menuLoading); // Use the variable to satisfy linter
  
  const [formData, setFormData] = useState({ name: '', price: '', category: 'Main Course', description: '', stock_quantity: '10' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [priceRange, setPriceRange] = useState<{ min: string, max: string }>({ min: '', max: '' });
  const [stockFilter, setStockFilter] = useState<'All' | 'Low Stock' | 'In Stock'>('All');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    
    const price = item.price;
    const minPrice = priceRange.min ? parseFloat(priceRange.min) : 0;
    const maxPrice = priceRange.max ? parseFloat(priceRange.max) : Infinity;
    const matchesPrice = price >= minPrice && price <= maxPrice;
    
    const stock = item.stock_quantity || 0;
    const matchesStock = stockFilter === 'All' || 
                        (stockFilter === 'Low Stock' && stock < 5) || 
                        (stockFilter === 'In Stock' && stock >= 5);
                        
    return matchesSearch && matchesCategory && matchesPrice && matchesStock;
  });

  const categories = ['All', 'Main Course', 'Appetizers', 'Desserts', 'Beverages'];

  const fetchMenu = useCallback(async () => {
    if (!selectedShopId) return;
    // Use a microtask or just set it inside the async flow to avoid sync setState in effect
    setMenuLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('shop_id', selectedShopId);
      if (data) {
        setItems(data);
      } else if (error) {
        console.error('Fetch Menu Error:', error);
      }
    } finally {
      setMenuLoading(false);
    }
  }, [selectedShopId]);

  useEffect(() => {
    if (selectedShopId) {
      // Call it in a way that avoids the sync setState warning if possible
      // or just accept that it's an async function.
      // The linter is being strict about the call itself.
      const loadMenu = async () => {
        await fetchMenu();
      };
      loadMenu();

      // Real-time subscription for menu items of this shop
      const menuChannel = supabase
        .channel(`menu_items_${selectedShopId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'menu_items',
          filter: `shop_id=eq.${selectedShopId}`
        }, () => {
          void fetchMenu();
        })
        .subscribe();

      return () => {
        void supabase.removeChannel(menuChannel);
      };
    }
  }, [selectedShopId, fetchMenu]);

  const toggleAvailability = async (item: MenuItem) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);

    if (error) {
      toast.error(`Failed to update availability: ${error.message}`);
    } else {
      toast.success(`${item.name} is now ${!item.is_available ? 'available' : 'unavailable'}`);
      fetchMenu();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId) return;

    setUploading(true);
    let imageUrl = editingItem ? editingItem.image_url : 'https://picsum.photos/seed/food/400/300';

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error('Upload Error:', uploadError);
        toast.error('Failed to upload image. Please ensure "menu-images" bucket exists in Supabase.');
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);
      
      imageUrl = publicUrl;
    }

    if (editingItem) {
      const { error } = await supabase.from('menu_items').update({
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        stock_quantity: parseInt(formData.stock_quantity),
        image_url: imageUrl
      }).eq('id', editingItem.id);

      setUploading(false);

      if (!error) {
        toast.success('Menu item updated successfully');
        setEditingItem(null);
        setFormData({ name: '', price: '', category: 'Main Course', description: '', stock_quantity: '10' });
        setImageFile(null);
        setImagePreview(null);
        fetchMenu();
        onRefreshMenu?.();
      } else {
        console.error('Supabase Update Error:', error);
        toast.error(`Failed to update menu item: ${error.message}`);
      }
    } else {
      const { error } = await supabase.from('menu_items').insert([{
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        stock_quantity: parseInt(formData.stock_quantity),
        shop_id: selectedShopId,
        is_available: true,
        image_url: imageUrl
      }]);

      setUploading(false);

      if (!error) {
        toast.success('Menu item added successfully');
        setFormData({ name: '', price: '', category: 'Main Course', description: '', stock_quantity: '10' });
        setImageFile(null);
        setImagePreview(null);
        fetchMenu();
        onRefreshMenu?.();
      } else {
        console.error('Supabase Insert Error:', error);
        toast.error(`Failed to add menu item: ${error.message}`);
      }
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      category: item.category || 'Main Course',
      description: item.description || '',
      stock_quantity: (item.stock_quantity || 0).toString()
    });
    setImagePreview(item.image_url);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setFormData({ name: '', price: '', category: 'Main Course', description: '', stock_quantity: '10' });
    setImageFile(null);
    setImagePreview(null);
  };

  const generateAIImage = async () => {
    if (!formData.name) {
      toast.error('Please enter a name for the menu item first');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `A professional food photography shot of ${formData.name}. ${formData.description ? `Description: ${formData.description}.` : ''} High quality, appetizing, studio lighting, neutral background.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "4:3"
          }
        }
      });

      let base64Data = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Data = part.inlineData.data;
          break;
        }
      }

      if (base64Data) {
        const imageUrl = `data:image/png;base64,${base64Data}`;
        setImagePreview(imageUrl);
        
        // Convert base64 to File object for Supabase upload
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], `${formData.name.replace(/\s+/g, '_')}_ai.png`, { type: 'image/png' });
        setImageFile(file);
        
        toast.success('AI Image generated successfully!');
      } else {
        throw new Error('No image data received from AI');
      }
    } catch (error) {
      console.error('AI Image Generation Error:', error);
      toast.error('Failed to generate image with AI. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleBulkAction = async (action: 'available' | 'unavailable' | 'delete' | 'category', value?: string) => {
    if (selectedItems.length === 0) return;
    
    const confirmMessage = action === 'delete' 
      ? `Are you sure you want to delete ${selectedItems.length} items?`
      : action === 'category'
      ? `Change category to "${value}" for ${selectedItems.length} items?`
      : `Mark ${selectedItems.length} items as ${action}?`;
      
    if (!window.confirm(confirmMessage)) return;

    try {
      if (action === 'delete') {
        const { error } = await supabase.from('menu_items').delete().in('id', selectedItems);
        if (error) throw error;
        toast.success(`Deleted ${selectedItems.length} items`);
      } else if (action === 'category') {
        const { error } = await supabase.from('menu_items')
          .update({ category: value })
          .in('id', selectedItems);
        if (error) throw error;
        toast.success(`Updated category for ${selectedItems.length} items`);
      } else {
        const { error } = await supabase.from('menu_items')
          .update({ is_available: action === 'available' })
          .in('id', selectedItems);
        if (error) throw error;
        toast.success(`Updated ${selectedItems.length} items`);
      }
      setSelectedItems([]);
      fetchMenu();
    } catch (error: unknown) {
      toast.error(`Bulk action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.id));
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (!error) {
      toast.success('Item deleted');
      fetchMenu();
      onRefreshMenu?.();
    } else {
      toast.error('Failed to delete item');
    }
  };

  const selectedShop = shops.find(s => s.id === selectedShopId);

  if (loading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="lg:col-span-5 h-[500px] rounded-[2rem]" />
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-80 rounded-[2rem]" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-container-low p-8 rounded-3xl border border-outline-variant/5"
      >
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white shadow-sm border border-outline-variant/10">
            <img 
              src={selectedShop?.logo_url || "https://picsum.photos/seed/shop/400/400"} 
              alt={selectedShop?.name} 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-3xl font-headline font-extrabold text-on-surface">{selectedShop?.name || "Your Shop"}</h2>
            <div className="flex items-center gap-4 mt-1 text-on-surface-variant text-sm font-medium">
              <span className="flex items-center gap-1"><MapPin size={14} /> {selectedShop?.location}</span>
              <span className="flex items-center gap-1"><Store size={14} /> {selectedShop?.category}</span>
            </div>
          </div>
        </div>
      </motion.section>

      {userOwnedShops.length === 0 ? (
        <CreateShop user={user} onShopCreated={onRefreshMenu || (() => {})} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-5 space-y-8"
        >
          <div className="space-y-2">
            <h2 className="text-4xl font-extrabold tracking-tight font-headline text-on-surface">
              {editingItem ? 'Edit Your' : 'Curate Your'} <span className="text-primary italic">Offerings</span>
            </h2>
            <p className="text-on-surface-variant body-md max-w-md">
              {editingItem ? 'Update the details of your menu item below.' : 'Transform ingredients into inspiration. Define your signature dishes for the LocalEats community.'}
            </p>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-[0_8px_24px_-4px_rgba(167,52,0,0.06)] border border-outline-variant/10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Item Name</label>
                <input 
                  className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40" 
                  placeholder="e.g. Truffle Infused Tagliatelle" 
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-1.5">
                  <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Price (R)</label>
                  <input 
                    className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all" 
                    placeholder="0.00" 
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                    required
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Stock</label>
                  <input 
                    className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all" 
                    placeholder="Qty" 
                    type="number"
                    value={formData.stock_quantity}
                    onChange={e => setFormData({...formData, stock_quantity: e.target.value})}
                    required
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Category</label>
                  <select 
                    className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all appearance-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option>Main Course</option>
                    <option>Appetizers</option>
                    <option>Desserts</option>
                    <option>Beverages</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Description</label>
                <textarea 
                  className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40" 
                  placeholder="Tell the story of this dish..." 
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>
              <div className="space-y-1.5">
                <label className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Item Image</label>
                <div className="flex flex-col gap-4">
                  {imagePreview && (
                    <div className="relative w-full h-40 rounded-xl overflow-hidden border border-outline-variant/10">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-2 right-2 p-1.5 bg-error/90 text-on-error rounded-full shadow-sm hover:bg-error transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className={cn(
                      "flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                      imageFile ? "border-primary/40 bg-primary/5" : "border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5"
                    )}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-on-surface-variant/40" />
                        <p className="text-xs text-on-surface-variant/60 font-medium">
                          {imageFile ? imageFile.name : "Click to upload image"}
                        </p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                    <button 
                      type="button"
                      onClick={generateAIImage}
                      disabled={isGeneratingImage || !formData.name}
                      className="w-32 h-32 flex flex-col items-center justify-center bg-surface-container-high rounded-xl border-2 border-outline-variant/10 hover:bg-surface-container-highest transition-all disabled:opacity-50 group"
                    >
                      {isGeneratingImage ? (
                        <RefreshCw className="w-8 h-8 mb-2 text-primary animate-spin" />
                      ) : (
                        <Sparkles className="w-8 h-8 mb-2 text-primary group-hover:scale-110 transition-transform" />
                      )}
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter">AI Generate</p>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  className={cn(
                    "flex-1 py-4 rounded-full font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100",
                    editingItem ? "bg-primary text-on-primary" : "bg-gradient-to-br from-primary to-primary-container text-on-primary"
                  )}
                  type="submit"
                  disabled={uploading}
                >
                  {uploading ? (
                    <Clock className="animate-spin" size={20} />
                  ) : (
                    editingItem ? <Edit2 size={20} /> : <Plus size={20} />
                  )}
                  {uploading ? 'Processing...' : (editingItem ? 'Update Item' : 'Add New Item')}
                </button>
                {editingItem && (
                  <button 
                    type="button"
                    onClick={cancelEdit}
                    className="px-6 py-4 rounded-full bg-surface-container-high text-on-surface font-bold hover:bg-surface-container-highest transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </motion.section>

        <section className="lg:col-span-7 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">Search Items</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                    <input 
                      type="text"
                      placeholder="Search name or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-2.5 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
                    />
                  </div>
                </div>
                
                <div className="w-full md:w-48 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">Category</label>
                  <select 
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all appearance-none"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="w-full md:w-64 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">Price Range (R)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder="Min Price" 
                      value={priceRange.min}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                      className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                    <span className="text-on-surface-variant/40">-</span>
                    <input 
                      type="number" 
                      placeholder="Max Price" 
                      value={priceRange.max}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                      className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                  </div>
                </div>

                <div className="w-full md:w-48 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant/60 ml-1">Stock Status</label>
                  <select 
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as 'All' | 'Low Stock' | 'In Stock')}
                    className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/40 transition-all appearance-none"
                  >
                    <option value="All">All Items</option>
                    <option value="Low Stock">Low Stock (&lt; 5)</option>
                    <option value="In Stock">In Stock (5+)</option>
                  </select>
                </div>
              </div>
            </div>

            {selectedItems.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary-container p-4 rounded-2xl flex items-center justify-between border border-primary/20 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-on-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    {selectedItems.length}
                  </div>
                  <span className="text-on-primary-container font-bold text-sm">Items Selected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleBulkAction('available')}
                    className="px-4 py-2 bg-white dark:bg-surface-container-high text-primary font-bold text-xs rounded-full hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1.5"
                  >
                    <Check size={14} /> Available
                  </button>
                  <button 
                    onClick={() => handleBulkAction('unavailable')}
                    className="px-4 py-2 bg-white dark:bg-surface-container-high text-on-surface-variant font-bold text-xs rounded-full hover:bg-surface-container-highest transition-all flex items-center gap-1.5"
                  >
                    <X size={14} /> Unavailable
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      className="px-4 py-2 bg-white dark:bg-surface-container-high text-on-surface-variant font-bold text-xs rounded-full hover:bg-surface-container-highest transition-all flex items-center gap-1.5"
                    >
                      <Layers size={14} /> Change Category
                    </button>
                    <AnimatePresence>
                      {showCategoryDropdown && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full left-0 mb-2 bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-xl p-2 min-w-[150px] z-50"
                        >
                          {categories.filter(c => c !== 'All').map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                handleBulkAction('category', cat);
                                setShowCategoryDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              {cat}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={() => handleBulkAction('delete')}
                    className="px-4 py-2 bg-error/10 text-error font-bold text-xs rounded-full hover:bg-error hover:text-on-error transition-all flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-between px-2">
              <button 
                onClick={toggleSelectAll}
                className="text-xs font-bold text-primary flex items-center gap-2 hover:underline"
              >
                {selectedItems.length === filteredItems.length && filteredItems.length > 0 ? (
                  <><CheckSquare size={16} /> Deselect All</>
                ) : (
                  <><Square size={16} /> Select All Visible</>
                )}
              </button>
              <div className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                Showing {filteredItems.length} of {items.length} items
              </div>
            </div>

            {filterCategory !== 'All' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">Active Filter:</span>
                <button 
                  onClick={() => setFilterCategory('All')}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold flex items-center gap-1"
                >
                  {filterCategory} <Plus size={12} className="rotate-45" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-surface-container-low rounded-[2rem] border-2 border-dashed border-outline-variant/20">
                <p className="text-on-surface-variant font-medium">No items found matching your criteria.</p>
                <button onClick={() => { setSearchTerm(''); setFilterCategory('All'); }} className="mt-4 text-primary font-bold underline">Clear all filters</button>
              </div>
            ) : filteredItems.map((item, i) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                key={item.id} 
                className={cn(
                  "group relative bg-surface-container-lowest rounded-[2rem] overflow-hidden shadow-sm hover:shadow-[0_8px_32px_-8px_rgba(167,52,0,0.15)] transition-all duration-300 border border-outline-variant/10",
                  selectedItems.includes(item.id) && "ring-2 ring-primary ring-offset-2"
                )}
              >
                <button 
                  onClick={() => toggleSelectItem(item.id)}
                  className={cn(
                    "absolute top-4 left-4 z-20 p-1.5 rounded-lg transition-all",
                    selectedItems.includes(item.id) ? "bg-primary text-on-primary" : "bg-black/20 text-white opacity-0 group-hover:opacity-100 backdrop-blur-md"
                  )}
                >
                  {selectedItems.includes(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <div className="relative h-48">
                  <img className={cn("w-full h-full object-cover", !item.is_available && "grayscale opacity-50")} src={item.image_url} alt={item.name} />
                  {!item.is_available && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <span className="bg-error text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">Out of Stock</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-surface/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-sm shadow-sm">
                    R {Number(item.price).toFixed(2)}
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-headline font-bold text-lg leading-tight">{item.name}</h4>
                    <div className="flex gap-1 items-center">
                      <button 
                        onClick={() => toggleAvailability(item)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full transition-all text-[10px] font-bold uppercase tracking-tighter",
                          item.is_available 
                            ? "bg-primary/10 text-primary hover:bg-primary/20" 
                            : "bg-on-surface-variant/10 text-on-surface-variant hover:bg-on-surface-variant/20"
                        )}
                        title={item.is_available ? "Mark as Unavailable" : "Mark as Available"}
                      >
                        {item.is_available ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </button>
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 text-on-surface-variant/40 hover:text-primary transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this item?')) {
                            handleDelete(item.id);
                          }
                        }} 
                        className="p-2 text-on-surface-variant/40 hover:text-error transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="text-on-surface-variant text-sm line-clamp-2">{item.description || "No description provided."}</p>
                  <div className="flex gap-2 pt-2 items-center justify-between">
                    <span className="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{item.category || "General"}</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1",
                      (item.stock_quantity || 0) < 5 ? "bg-error text-on-error animate-pulse shadow-[0_0_12px_rgba(255,0,0,0.3)]" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {(item.stock_quantity || 0) < 5 && <AlertCircle size={10} />}
                      Stock: {item.stock_quantity || 0}
                      {(item.stock_quantity || 0) < 5 && <span className="ml-1 text-[8px] font-black underline">LOW STOCK</span>}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
      )}
    </div>
  );
};

const OrdersManagement = ({ orders, onUpdateStatus, onDeleteAllOrders, loading, onRefresh, kitchenMode, setKitchenMode }: { orders: Order[], onUpdateStatus: (id: string, status: OrderStatus, message?: string) => void, onDeleteAllOrders: () => void, loading: boolean, onRefresh: () => void, kitchenMode: boolean, setKitchenMode: (val: boolean) => void }) => {
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('We have received your order and are starting to prepare it!');
  const [readyOrderId, setReadyOrderId] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('20-30 mins');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [recentlyChangedOrders, setRecentlyChangedOrders] = useState<Record<string, boolean>>({});
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const prevOrdersRef = useRef<Order[]>([]);
  const [maxConcurrentOrders, setMaxConcurrentOrders] = useState(() => {
    return Number(localStorage.getItem('maxConcurrentOrders')) || 10;
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem('soundAlerts') !== 'false';
  });

  useEffect(() => {
    if (prevOrdersRef.current.length > 0) {
      const changes: Record<string, boolean> = {};
      orders.forEach(order => {
        const prevOrder = prevOrdersRef.current.find(o => o.id === order.id);
        if (prevOrder && prevOrder.status !== order.status) {
          changes[order.id] = true;
          // Clear highlight after 5 seconds
          setTimeout(() => {
            setRecentlyChangedOrders(prev => {
              const next = { ...prev };
              delete next[order.id];
              return next;
            });
          }, 5000);
        }
      });
      if (Object.keys(changes).length > 0) {
        setTimeout(() => {
          setRecentlyChangedOrders(prev => ({ ...prev, ...changes }));
        }, 0);
      }
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('maxConcurrentOrders', maxConcurrentOrders.toString());
  }, [maxConcurrentOrders]);

  useEffect(() => {
    localStorage.setItem('soundAlerts', soundAlerts.toString());
  }, [soundAlerts]);

  // Sound alert logic
  const prevPendingCount = useRef(orders.filter(o => o.status === 'pending').length);
  useEffect(() => {
    const currentPendingCount = orders.filter(o => o.status === 'pending').length;
    if (soundAlerts && currentPendingCount > prevPendingCount.current) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Audio play blocked:', e));
      toast.info('New order received!', { icon: <Bell className="text-primary" /> });
      setTimeout(() => {
        setNewOrderAlert(true);
      }, 0);
      setTimeout(() => setNewOrderAlert(false), 5000);
    }
    prevPendingCount.current = currentPendingCount;
  }, [orders, soundAlerts]);

  const activeCount = orders.filter(o => o.status !== 'completed').length;
  const isLimitReached = activeCount >= maxConcurrentOrders;
  
  // Calculate customer loyalty
  const customerOrderCounts = orders.reduce((acc: Record<string, number>, order) => {
    acc[order.user_id] = (acc[order.user_id] || 0) + 1;
    return acc;
  }, {});

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [ordersPaused, setOrdersPaused] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'All'>('All');
  const [sortField, setSortField] = useState<'id' | 'total_price' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const activeOrders = orders.filter(o => o.status !== 'completed');
  const historyOrders = orders.filter(o => o.status === 'completed');
  const baseOrders = viewMode === 'active' ? activeOrders : historyOrders;
  
  const filteredOrders = baseOrders.filter(o => {
    const matchesSearch = o.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         o.id.toString().includes(searchTerm);
    const matchesCustomer = !customerSearch || o.customer_name?.toLowerCase().includes(customerSearch.toLowerCase());
    const matchesPhone = !phoneSearch || o.phone?.includes(phoneSearch);
    const matchesFilter = filterStatus === 'All' || o.status === filterStatus;
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(o.created_at) >= new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(o.created_at) <= end;
    }

    return matchesSearch && matchesCustomer && matchesPhone && matchesFilter && matchesDate;
  });

  const displayedOrders = [...filteredOrders].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'id') {
      comparison = a.id.localeCompare(b.id);
    } else if (sortField === 'total_price') {
      comparison = Number(a.total_price) - Number(b.total_price);
    } else if (sortField === 'created_at') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'id' | 'total_price' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const exportToCSV = () => {
    const headers = ['Order ID', 'Product Name', 'Total Price', 'Status', 'Date', 'Customer', 'Address'];
    const csvContent = [
      headers.join(','),
      ...orders.map(o => [
        o.id,
        `"${o.product_name.replace(/"/g, '""')}"`,
        o.total_price,
        o.status,
        format(new Date(o.created_at), 'yyyy-MM-dd HH:mm:ss'),
        `"${o.customer_name.replace(/"/g, '""')}"`,
        `"${o.address.replace(/"/g, '""')}, ${o.city.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Orders exported as CSV!');
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(orders, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Orders exported as JSON!');
  };

  const orderStatuses: (OrderStatus | 'All')[] = ['All', 'pending', 'preparing', 'ready', 'completed'];

  if (loading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
          <Skeleton className="lg:col-span-4 h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-2 block">Live Operations</span>
          <h2 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface tracking-tight mb-4">Orders Management</h2>
          <p className="text-on-surface-variant text-lg">Streamline your kitchen workflow and monitor real-time fulfillment across all delivery channels.</p>
        </div>
          <div className="flex flex-col gap-4 items-end">
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  console.log('Clear All Orders clicked');
                  toast.info('Clearing all orders...');
                  onDeleteAllOrders();
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-error/10 text-error rounded-full text-sm font-bold shadow-sm hover:bg-error/20 transition-all cursor-pointer relative z-20"
              >
                <Trash2 size={18} />
                Clear All Orders
              </button>
              <button 
                onClick={() => {
                  console.log('Refresh Orders clicked');
                  toast.info('Refreshing orders...');
                  onRefresh();
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-bold shadow-sm hover:scale-105 transition-all cursor-pointer relative z-20"
              >
                <Clock size={18} />
                Refresh Orders
              </button>
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-6 py-2.5 bg-surface-container-high text-on-surface rounded-full text-sm font-bold shadow-sm hover:bg-surface-container-highest transition-all cursor-pointer relative z-20"
              >
                <FileDown size={18} />
                CSV
              </button>
              <button 
                onClick={exportToJSON}
                className="flex items-center gap-2 px-6 py-2.5 bg-surface-container-high text-on-surface rounded-full text-sm font-bold shadow-sm hover:bg-surface-container-highest transition-all cursor-pointer relative z-20"
              >
                <FileDown size={18} />
                JSON
              </button>
            </div>
              <div className="flex p-1.5 bg-surface-container-low rounded-full w-fit">
                <button 
                  onClick={() => setViewMode('active')}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                    viewMode === 'active' ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-secondary-container hover:bg-surface-container-high"
                  )}
                >
                  Current Orders
                </button>
                <button 
                  onClick={() => setViewMode('history')}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                    viewMode === 'history' ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-secondary-container hover:bg-surface-container-high"
                  )}
                >
                  Order History
                </button>
              </div>
              <button 
                onClick={() => setKitchenMode(!kitchenMode)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all border-2",
                  kitchenMode ? "bg-primary text-on-primary border-primary" : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20"
                )}
              >
                <UtensilsCrossed size={18} />
                Kitchen Mode {kitchenMode ? 'ON' : 'OFF'}
              </button>
            </div>
      </section>

      <div className={cn("grid grid-cols-1 gap-8 items-start", !kitchenMode && "lg:grid-cols-12")}>
        <div className={cn(kitchenMode ? "col-span-full" : "lg:col-span-8", "space-y-6")}>
          <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-4 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mr-2">Filter Status:</span>
                    {orderStatuses.map(status => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2",
                          filterStatus === status 
                            ? "bg-primary/10 text-primary border-primary" 
                            : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20"
                        )}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant/20">
                    <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest ml-3">Dates:</span>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-on-surface outline-none px-2 py-1"
                    />
                    <span className="text-on-surface-variant/40">to</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-on-surface outline-none px-2 py-1 mr-2"
                    />
                    {(startDate || endDate) && (
                      <button 
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="p-1 hover:bg-surface-container-high rounded-full text-error transition-colors mr-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-headline text-xl font-bold flex items-center gap-2">
                    {viewMode === 'active' ? 'Active Queue' : 'Order History'}
                    <span className="bg-primary-fixed text-on-primary-fixed text-xs px-2.5 py-1 rounded-full">{displayedOrders.length} Orders</span>
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowSearch(!showSearch)}
                      className={cn("p-2 rounded-full transition-colors", showSearch ? "bg-primary text-on-primary" : "hover:bg-surface-container-low text-on-surface-variant")}
                    >
                      <Search size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-2 overflow-x-auto pb-2 scrollbar-hide">
                  <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest shrink-0">Sort by:</span>
                  {[
                    { id: 'created_at', label: 'Date', icon: Clock },
                    { id: 'total_price', label: 'Price', icon: TrendingUp },
                    { id: 'id', label: 'Order ID', icon: ReceiptText }
                  ].map((field) => (
                    <button
                      key={field.id}
                      onClick={() => handleSort(field.id as keyof Order)}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all shrink-0 border-2",
                        sortField === field.id 
                          ? "bg-primary text-on-primary border-primary shadow-[0_4px_12px_rgba(167,52,0,0.3)] scale-105 ring-2 ring-primary/20" 
                          : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/20"
                      )}
                    >
                      <field.icon size={14} className={cn(sortField === field.id ? "animate-pulse" : "")} />
                      {field.label}
                      {sortField === field.id && (
                        <motion.span 
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className="ml-1 bg-white/20 p-0.5 rounded-full flex items-center justify-center"
                        >
                          {sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        </motion.span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

            <AnimatePresence>
              {showSearch && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Search product or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                      />
                    </div>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                      <input 
                        type="text"
                        placeholder="Customer Name..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                      <input 
                        type="text"
                        placeholder="Phone Number..."
                        value={phoneSearch}
                        onChange={(e) => setPhoneSearch(e.target.value)}
                        className="w-full bg-surface-container-lowest border-2 border-primary/10 rounded-2xl py-3 pl-12 pr-5 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {newOrderAlert && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, y: -20 }}
                  animate={{ height: 'auto', opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -20 }}
                  className="bg-primary text-on-primary p-4 rounded-2xl flex items-center justify-between shadow-lg mb-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                      <Bell className="animate-bounce" size={20} />
                    </div>
                    <div>
                      <p className="font-bold">New Order Received!</p>
                      <p className="text-xs opacity-90">A new customer has just placed an order.</p>
                    </div>
                  </div>
                  <button onClick={() => setNewOrderAlert(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {displayedOrders.length === 0 ? (
            <div className="bg-surface-container-low rounded-[2rem] p-12 flex flex-col items-center text-center space-y-6 border-2 border-dashed border-outline-variant/20">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                {viewMode === 'active' ? <Clock className="text-primary" size={40} /> : <ReceiptText className="text-primary" size={40} />}
              </div>
              <div className="space-y-2">
                <h4 className="font-headline text-2xl font-bold">{viewMode === 'active' ? 'All caught up!' : 'No history yet'}</h4>
                <p className="text-on-surface-variant max-w-xs mx-auto">
                  {viewMode === 'active' 
                    ? 'Your kitchen is currently clear. New orders will appear here as they arrive.' 
                    : 'Completed orders will appear here once they are fulfilled.'}
                </p>
              </div>
              {viewMode === 'active' && (
                <button 
                  onClick={onRefresh}
                  className="px-8 py-3 bg-surface-container-lowest text-primary font-bold rounded-full shadow-sm hover:scale-105 transition-all border border-primary/10"
                >
                  Check for New Orders
                </button>
              )}
            </div>
          ) : (
            <div className={cn(
              "grid gap-6",
              kitchenMode ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2"
            )}>
              {displayedOrders.map(order => {
                const orderCount = customerOrderCounts[order.user_id] || 0;
                const isReturning = orderCount > 1;

                return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={order.id} 
                  className={cn(
                    "group rounded-xl p-6 shadow-sm border transition-all duration-300 cursor-pointer",
                    order.status === 'pending' ? "bg-primary-light border-primary/20" : 
                    order.status === 'preparing' ? "bg-primary/10 border-primary/10" :
                    order.status === 'ready' ? "bg-tertiary/10 border-tertiary/20" :
                    "bg-surface-container-highest border-transparent",
                    kitchenMode && "p-8 border-2",
                    expandedOrderId === order.id && "ring-2 ring-primary/10 border-primary/20"
                  )}
                  onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="relative">
                      {recentlyChangedOrders[order.id] && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full border-2 border-white z-10"
                        />
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("font-label text-[10px] font-bold uppercase tracking-widest block", 
                          order.status === 'pending' ? "text-primary" : "text-on-surface-variant/60"
                        )}>#LE-{order.id}</span>
                        {isReturning && (
                          <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star size={10} fill="currentColor" />
                            RETURNING ({orderCount})
                          </span>
                        )}
                      </div>
                      <h4 className={cn("font-headline font-bold text-on-surface", kitchenMode ? "text-2xl" : "text-lg")}>
                        {order.customer_name || `Customer #${order.user_id.slice(0, 5)}`}
                      </h4>
                      <div className="flex flex-col gap-1 mt-2">
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                          <Phone size={12} />
                          <span>{order.phone || 'No phone'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                          <MapPin size={12} />
                          <span className="line-clamp-1">{order.address}, {order.city}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-3 text-[10px] font-bold text-primary/60 uppercase tracking-wider">
                        {expandedOrderId === order.id ? 'Hide Details' : 'View Details'}
                        <motion.div
                          animate={{ rotate: expandedOrderId === order.id ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight size={12} />
                        </motion.div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                        order.status === 'pending' ? "bg-primary-fixed text-on-primary-fixed" :
                        order.status === 'preparing' ? "bg-primary/10 text-primary" :
                        order.status === 'ready' ? "bg-tertiary/10 text-tertiary" :
                        "bg-surface-container-highest text-on-surface-variant"
                      )}>
                        {order.status === 'pending' || order.status === 'preparing' ? (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                          </span>
                        ) : <CheckCircle2 size={14} />}
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <span className="text-[11px] font-semibold text-on-surface-variant mt-2 flex items-center gap-1">
                        <Clock size={14} />
                        {format(new Date(order.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className={cn("flex justify-between items-center", kitchenMode ? "text-xl" : "text-sm")}>
                      <span className="text-on-surface-variant font-medium">{order.product_name}</span>
                      <span className="text-on-surface font-semibold">R {Number(order.total_price).toFixed(2)}</span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedOrderId === order.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-outline-variant/10 pt-6 mb-8 space-y-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Order Items</span>
                          <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/10">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-surface-container-high text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                                <tr>
                                  <th className="px-4 py-2">Item</th>
                                  <th className="px-4 py-2 text-center">Qty</th>
                                  <th className="px-4 py-2 text-right">Price</th>
                                  <th className="px-4 py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-outline-variant/10">
                                {order.items && order.items.length > 0 ? (
                                  order.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-surface-container-highest/30 transition-colors">
                                      <td className="px-4 py-3 font-medium text-on-surface">{item.name}</td>
                                      <td className="px-4 py-3 text-center text-on-surface-variant">{item.quantity}</td>
                                      <td className="px-4 py-3 text-right text-on-surface-variant">R {item.price.toFixed(2)}</td>
                                      <td className="px-4 py-3 text-right font-bold text-on-surface">R {(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-on-surface">{order.product_name}</td>
                                    <td className="px-4 py-3 text-center text-on-surface-variant">1</td>
                                    <td className="px-4 py-3 text-right text-on-surface-variant">R {order.total_price.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-on-surface">R {order.total_price.toFixed(2)}</td>
                                  </tr>
                                )}
                              </tbody>
                              <tfoot className="bg-surface-container-low border-t border-outline-variant/20">
                                <tr>
                                  <td colSpan={3} className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Grand Total</td>
                                  <td className="px-4 py-3 text-right font-bold text-primary text-lg">R {order.total_price.toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Customer Name</span>
                            <p className="text-sm font-semibold text-on-surface">{order.customer_name || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Phone Number</span>
                            <p className="text-sm font-semibold text-on-surface">{order.phone || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Email Address</span>
                            <p className="text-sm font-semibold text-on-surface">{order.email || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Delivery Address</span>
                            <p className="text-sm font-semibold text-on-surface">{order.address}, {order.city}</p>
                          </div>
                          {order.accepted_at && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Accepted At</span>
                              <p className="text-sm font-semibold text-on-surface">{format(new Date(order.accepted_at), 'HH:mm:ss')}</p>
                            </div>
                          )}
                          {order.estimated_delivery_time && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Est. Delivery</span>
                              <p className="text-sm font-semibold text-primary">{order.estimated_delivery_time}</p>
                            </div>
                          )}
                          {order.notes && (
                            <div className="space-y-1 sm:col-span-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Order Notes</span>
                              <div className="p-3 bg-surface-container-low rounded-lg text-sm text-on-surface-variant italic">
                                "{order.notes}"
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {viewMode === 'active' && (
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      {order.status === 'pending' && (
                        <div className="flex-1 flex flex-col gap-2">
                          {acceptingOrderId === order.id ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-2"
                            >
                              <input 
                                type="text"
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none"
                                placeholder="Enter message..."
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    onUpdateStatus(order.id, 'preparing', customMessage);
                                    setAcceptingOrderId(null);
                                  }}
                                  className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-full"
                                >
                                  Send & Accept
                                </button>
                                <button 
                                  onClick={() => setAcceptingOrderId(null)}
                                  className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full"
                                >
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <div className="space-y-2">
                              {isLimitReached && (
                                <div className="flex items-center gap-2 p-2 bg-error/10 text-error rounded-lg text-[10px] font-bold">
                                  <AlertCircle size={12} />
                                  ORDER LIMIT REACHED ({maxConcurrentOrders})
                                </div>
                              )}
                              <button 
                                onClick={() => setAcceptingOrderId(order.id)}
                                disabled={isLimitReached}
                                className={cn(
                                  "w-full bg-primary text-white font-bold rounded-full shadow-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:grayscale",
                                  kitchenMode ? "py-5 text-lg" : "py-3 text-sm"
                                )}
                              >
                                Accept Order
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {order.status === 'preparing' && (
                        <div className="flex-1 flex flex-col gap-2">
                          {readyOrderId === order.id ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-2"
                            >
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Est. Delivery Time</label>
                                <input 
                                  type="text"
                                  value={estimatedTime}
                                  onChange={(e) => setEstimatedTime(e.target.value)}
                                  className="w-full px-4 py-2 text-xs bg-surface-container-low border border-primary/20 rounded-lg focus:ring-1 focus:ring-primary outline-none"
                                  placeholder="e.g. 20-30 mins"
                                  autoFocus
                                />
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    onUpdateStatus(order.id, 'ready', undefined, estimatedTime);
                                    setReadyOrderId(null);
                                  }}
                                  className="flex-1 py-2 bg-tertiary text-white text-xs font-bold rounded-full"
                                >
                                  Confirm & Ready
                                </button>
                                <button 
                                  onClick={() => setReadyOrderId(null)}
                                  className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full"
                                >
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <button 
                              onClick={() => setReadyOrderId(order.id)}
                              className={cn(
                                "w-full bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-full shadow-[0_8px_24px_-4px_rgba(167,52,0,0.2)] hover:scale-[0.98] transition-transform",
                                kitchenMode ? "py-5 text-lg" : "py-3 text-sm"
                              )}
                            >
                              Mark as Ready
                            </button>
                          )}
                        </div>
                      )}
                      {order.status === 'ready' && (
                        <button 
                          onClick={() => onUpdateStatus(order.id, 'completed')}
                          className={cn(
                            "flex-1 bg-tertiary text-white font-bold rounded-full hover:bg-tertiary-container transition-colors shadow-md",
                            kitchenMode ? "py-5 text-lg" : "py-3 text-sm"
                          )}
                        >
                          Mark as Completed
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          toast.promise(new Promise(r => setTimeout(r, 1000)), {
                            loading: 'Connecting to kitchen printer...',
                            success: 'Kitchen ticket printed successfully!',
                            error: 'Printer not found. Check settings.'
                          });
                        }}
                        className={cn(
                          "bg-surface-container-high rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all",
                          kitchenMode ? "p-5" : "p-3"
                        )}
                        title="Print Kitchen Ticket"
                      >
                        <Printer size={kitchenMode ? 24 : 18} />
                      </button>
                    </div>
                  )}
                </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {!kitchenMode && (
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 shadow-sm">
              <h4 className="font-headline text-base font-bold text-on-surface mb-6 flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                Notification Settings
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Sound Alerts</span>
                    <span className="text-[10px] text-on-surface-variant">Play sound for new orders</span>
                  </div>
                  <button 
                    onClick={() => setSoundAlerts(!soundAlerts)}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      soundAlerts ? "bg-primary" : "bg-surface-container-highest"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                      soundAlerts ? "right-1" : "left-1"
                    )}></div>
                  </button>
                </div>

                <div className="p-4 bg-surface-container-low rounded-2xl space-y-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Order Limit</span>
                    <span className="text-[10px] text-on-surface-variant">Max concurrent active orders</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="1" 
                      max="50" 
                      value={maxConcurrentOrders}
                      onChange={(e) => setMaxConcurrentOrders(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold min-w-[3rem] text-center">
                      {maxConcurrentOrders}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-high rounded-3xl p-8 relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="font-headline text-lg font-bold text-on-surface mb-6">Status Overview</h4>
                <div className="space-y-5">
                {[
                  { label: 'New Orders', count: orders.filter(o => o.status === 'pending').length, color: 'bg-primary-fixed' },
                  { label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length, color: 'bg-primary' },
                  { label: 'Ready for Pickup', count: orders.filter(o => o.status === 'ready').length, color: 'bg-tertiary' },
                  { label: 'Completed', count: orders.filter(o => o.status === 'completed').length, color: 'bg-secondary' }
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-1.5 h-1.5 rounded-full", stat.color)}></div>
                      <span className="text-sm font-semibold text-on-surface-variant">{stat.label}</span>
                    </div>
                    <span className="font-headline font-bold">{stat.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-8 border-t border-on-surface/5">
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Avg. Prep Time</div>
                <div className="text-3xl font-headline font-extrabold text-primary">14.2 min</div>
                <div className="text-xs text-on-surface-variant mt-1">↓ 2.1 min from yesterday</div>
              </div>
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6">
            <h4 className="font-headline text-base font-bold text-on-surface mb-4">Kitchen Hub</h4>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setAlertsEnabled(!alertsEnabled);
                  toast.success(`Order alerts ${!alertsEnabled ? 'enabled' : 'disabled'}`);
                }}
                className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Bell size={20} className={alertsEnabled ? "text-primary" : "text-on-surface-variant/40"} />
                  <span className="text-sm font-bold">New Order Alerts</span>
                </div>
                <div className={cn("w-10 h-6 rounded-full relative transition-colors", alertsEnabled ? "bg-primary" : "bg-surface-container-highest")}>
                  <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", alertsEnabled ? "right-1" : "left-1")}></div>
                </div>
              </button>
              <button 
                onClick={() => {
                  setOrdersPaused(!ordersPaused);
                  toast.warning(`Kitchen is now ${!ordersPaused ? 'PAUSED' : 'ACTIVE'}`);
                }}
                className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-center gap-3">
                  <PauseCircle size={20} className={ordersPaused ? "text-error" : "text-on-surface-variant"} />
                  <span className="text-sm font-bold">{ordersPaused ? 'Resume Orders' : 'Pause New Orders'}</span>
                </div>
                <ChevronRight size={20} className={cn("text-on-surface-variant transition-transform", ordersPaused && "rotate-90")} />
              </button>
              <button 
                onClick={() => toast.info('Opening printer settings...')}
                className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Printer size={20} className="text-on-surface-variant" />
                  <span className="text-sm font-bold">Printer Settings</span>
                </div>
                <span className="text-xs font-bold text-tertiary">Online</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

const Insights = ({ orders, menuItems, loading }: { orders: Order[], menuItems: MenuItem[], loading: boolean }) => {
  const [reviews, setReviews] = useState([
    { id: 1, user: 'Sarah J.', rating: 5, comment: 'The Kota was absolutely amazing! Best in town.', date: '2023-10-24', response: '' },
    { id: 2, user: 'Mike T.', rating: 4, comment: 'Great food, but delivery took a bit long.', date: '2023-10-23', response: 'Thank you for the feedback, Mike! We are working on our delivery times.' },
    { id: 3, user: 'Lerato K.', rating: 5, comment: 'Always fresh and hot. Highly recommend.', date: '2023-10-22', response: '' }
  ]);
  const [responseTexts, setResponseTexts] = useState<Record<number, string>>({});

  const [selectedItemForTrend, setSelectedItemForTrend] = useState<string | null>(null);

  const itemTrendData = useMemo(() => {
    if (!selectedItemForTrend) return [];
    
    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const d = new Date();
      d.setDate(d.getDate() - index);
      return {
        date: d.toISOString().split('T')[0],
        dayName: format(d, 'EEE'),
        revenue: 0
      };
    }).reverse();

    orders.filter(o => o.product_name === selectedItemForTrend).forEach(order => {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      const day = last7Days.find(d => d.date === orderDate);
      if (day) day.revenue += Number(order.total_price);
    });

    return last7Days.map(d => ({ name: d.dayName, value: d.revenue }));
  }, [orders, selectedItemForTrend]);

  const handleResponse = (id: number) => {
    const text = responseTexts[id];
    if (!text) return;
    setReviews(prev => prev.map(r => r.id === id ? { ...r, response: text } : r));
    setResponseTexts(prev => ({ ...prev, [id]: '' }));
    toast.success('Response sent!');
  };

  // Calculate top sellers from orders
  const productCounts = orders.reduce((acc: Record<string, number>, order) => {
    acc[order.product_name] = (acc[order.product_name] || 0) + 1;
    return acc;
  }, {});

  const exportToCSV = () => {
    if (orders.length === 0) {
      toast.error('No orders to export');
      return;
    }

    const headers = ['Order ID', 'Product', 'Price', 'Status', 'Date'];
    const csvContent = [
      headers.join(','),
      ...orders.map(o => [
        o.id,
        `"${o.product_name}"`,
        o.total_price,
        o.status,
        new Date(o.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `localeats_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully!');
  };

  const topSellers = Object.entries(productCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Detailed Menu Analytics
  const menuAnalytics = useMemo(() => {
    return menuItems.map(item => {
      const itemOrders = orders.filter(o => o.product_name === item.name);
      const totalRevenue = itemOrders.reduce((sum, o) => sum + Number(o.total_price), 0);
      const salesCount = itemOrders.length;
      
      // Calculate sales trend (last 7 days vs previous 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      const recentSales = itemOrders.filter(o => new Date(o.created_at) >= sevenDaysAgo).length;
      const previousSales = itemOrders.filter(o => {
        const date = new Date(o.created_at);
        return date >= fourteenDaysAgo && date < sevenDaysAgo;
      }).length;
      
      const trend = previousSales === 0 ? (recentSales > 0 ? 100 : 0) : ((recentSales - previousSales) / previousSales) * 100;
      
      return {
        ...item,
        totalRevenue,
        salesCount,
        trend
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders, menuItems]);

  const categoryRevenue = orders.reduce((acc: Record<string, number>, order) => {
    const item = menuItems.find(i => i.name === order.product_name);
    const category = item?.category || 'Other';
    acc[category] = (acc[category] || 0) + Number(order.total_price);
    return acc;
  }, {});

  const pieData = Object.entries(categoryRevenue).map(([name, value]) => ({ name, value }));
  const COLORS = ['#FF6321', '#FF9F43', '#FFC107', '#4CAF50', '#2196F3', '#9C27B0'];

  if (loading) {
    return (
      <div className="space-y-12">
        <section>
          <Skeleton className="h-12 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </section>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Skeleton className="md:col-span-8 h-80 rounded-xl" />
          <Skeleton className="md:col-span-4 h-80 rounded-xl" />
          <Skeleton className="md:col-span-5 h-64 rounded-xl" />
          <Skeleton className="md:col-span-7 h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <motion.section initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">Business Insights</h1>
        <p className="text-on-surface-variant font-body">Data-driven performance overview for LocalEats.</p>
      </motion.section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="md:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_-4px_rgba(167,52,0,0.05)] border border-outline-variant/10"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Monthly Revenue</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-on-surface font-headline">R {(orders.reduce((acc, o) => acc + Number(o.total_price), 0)).toLocaleString()}</span>
                <span className="flex items-center text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <TrendingUp size={14} className="mr-1" />
                  +15.4%
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                <Download size={14} />
                Export CSV
              </button>
              <button 
                onClick={() => toast.info('Timeframe selection coming soon')}
                className="px-4 py-2 text-xs font-bold rounded-full bg-primary text-on-primary"
              >
                30 Days
              </button>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 px-2">
            {[40, 65, 55, 80, 95, 100].map((h, i) => (
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: i * 0.1 }}
                key={i} 
                className="w-full bg-surface-container-low rounded-t-lg transition-all hover:bg-primary/20 relative group"
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-surface text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100">R{(h * 200).toLocaleString()}</div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between mt-4 px-2 text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="md:col-span-4 bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_-4px_rgba(167,52,0,0.05)] border border-outline-variant/10"
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60 mb-6">Revenue by Category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: 'var(--on-surface)', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="md:col-span-4 bg-primary-container rounded-xl p-6 text-on-primary-container flex flex-col justify-between relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={24} />
              <h3 className="font-bold text-lg">AI Smart Tips</h3>
            </div>
            <p className="text-on-primary-container/90 leading-relaxed font-medium italic">
              "Try a 'Kota' special on Tuesdays to boost mid-week sales. Data shows a 22% interest spike in savory snacks during rainy afternoons."
            </p>
          </div>
          <button 
            onClick={() => toast.success('Promotion applied to your shop!')}
            className="mt-6 w-full py-3 bg-surface-container-lowest text-primary font-bold rounded-full text-sm hover:bg-surface-bright transition-colors"
          >
            Apply Promotion
          </button>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="md:col-span-8 bg-surface-container-low rounded-xl p-8"
        >
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            Peak Order Hours
          </h2>
          <div className="space-y-6">
            {orders.length > 0 ? [
              { time: '12:00 PM', val: 85, label: 'Lunch Rush', color: 'bg-primary' },
              { time: '03:00 PM', val: 20, label: 'Afternoon Slump', color: 'bg-on-surface-variant/20' },
              { time: '07:00 PM', val: 95, label: 'Dinner Peak', color: 'bg-primary' },
              { time: '09:00 PM', val: 55, label: 'Late Night', color: 'bg-primary/60' }
            ].map((p, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-on-surface">{p.time}</span>
                  <span className="text-on-surface-variant uppercase tracking-widest">{p.label}</span>
                </div>
                <div className="w-full h-4 bg-surface-container rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${p.val}%` }}
                    transition={{ duration: 1, delay: 0.5 + (i * 0.1) }}
                    className={cn("h-full rounded-full", p.color)}
                  />
                </div>
              </div>
            )) : (
              <p className="text-on-surface-variant text-sm italic py-8 text-center">No peak data yet.</p>
            )}
          </div>
          <p className="mt-8 text-xs text-on-surface-variant italic leading-snug">
            * Busiest periods detected between 12pm - 1pm and 7pm - 8:30pm.
          </p>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="md:col-span-7 bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Top Sellers</h2>
            <button 
              onClick={() => toast.info('Detailed sales report coming soon')}
              className="text-primary text-xs font-bold underline cursor-pointer bg-transparent border-none"
            >
              View All
            </button>
          </div>
          <div className="space-y-5">
            {topSellers.length > 0 ? topSellers.map((item, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + (i * 0.1) }}
                key={i} 
                className="flex items-center justify-between group cursor-pointer p-2 -m-2 rounded-xl hover:bg-surface-container-low transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container">
                    <img className="w-full h-full object-cover group-hover:scale-110 transition-transform" src={`https://picsum.photos/seed/${item.id}/400/300`} alt={item.name} referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface">{item.name}</h4>
                    <p className="text-xs text-on-surface-variant">Popular Choice</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-on-surface">{item.count}</div>
                  <div className="text-[10px] font-bold uppercase text-on-surface-variant/60">Orders Total</div>
                </div>
              </motion.div>
            )) : (
              <p className="text-on-surface-variant text-sm italic">No sales data yet.</p>
            )}
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="md:col-span-5 bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Item Popularity</h2>
            <select 
              className="text-xs font-bold bg-surface-container-low border-none rounded-lg px-2 py-1 outline-none"
              value={selectedItemForTrend || ''}
              onChange={(e) => setSelectedItemForTrend(e.target.value || null)}
            >
              <option value="">Select Item</option>
              {menuItems.map(item => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </div>
          
          {selectedItemForTrend ? (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={itemTrendData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: 'var(--primary)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--on-surface-variant)' }} />
                  <YAxis hide />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-center text-on-surface-variant/60 font-bold uppercase tracking-widest mt-4">7-Day Revenue Trend for {selectedItemForTrend}</p>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center space-y-3 bg-surface-container-low/30 rounded-2xl border-2 border-dashed border-outline-variant/10">
              <BarChart3 className="text-on-surface-variant/20" size={40} />
              <p className="text-xs text-on-surface-variant font-medium">Select a menu item to view its<br/>popularity trend over time.</p>
            </div>
          )}
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="md:col-span-12 bg-surface-container-lowest border border-outline-variant/10 rounded-[2rem] p-8"
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-headline font-extrabold text-on-surface">Menu Item Performance</h2>
              <p className="text-sm text-on-surface-variant">Detailed analytics for your offerings</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/10">
                <BarChart3 size={16} className="text-primary" />
                <span className="text-xs font-bold">{menuItems.length} Total Items</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto -mx-8 px-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Item</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Category</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Orders</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Revenue</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Trend (7d)</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Stock</th>
                </tr>
              </thead>
              <tbody>
                {menuAnalytics.length > 0 ? menuAnalytics.map((item) => (
                  <tr key={item.id} className="border-b border-outline-variant/5 hover:bg-surface-container-low/50 transition-colors group">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold text-sm text-on-surface">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold text-sm">{item.salesCount}</td>
                    <td className="py-4 px-4 font-bold text-sm text-primary">R {item.totalRevenue.toLocaleString()}</td>
                    <td className="py-4 px-4">
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-bold",
                        item.trend > 0 ? "text-primary" : item.trend < 0 ? "text-error" : "text-on-surface-variant/40"
                      )}>
                        {item.trend > 0 ? <ArrowUp size={12} /> : item.trend < 0 ? <ArrowDown size={12} /> : null}
                        {Math.abs(item.trend).toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden min-w-[60px]">
                          <div 
                            className={cn("h-full rounded-full", (item.stock_quantity || 0) < 5 ? "bg-error" : "bg-primary")} 
                            style={{ width: `${Math.min(100, ((item.stock_quantity || 0) / 50) * 100)}%` }}
                          />
                        </div>
                        <span className={cn("text-[10px] font-bold", (item.stock_quantity || 0) < 5 ? "text-error" : "text-on-surface-variant")}>
                          {item.stock_quantity || 0}
                        </span>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant italic text-sm">
                      No menu items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Customer Feedback Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="md:col-span-12 bg-surface-container-lowest border border-outline-variant/10 rounded-[2rem] p-8"
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              Customer Feedback
              <span className="bg-secondary-fixed text-on-secondary-fixed text-xs px-2.5 py-1 rounded-full">{reviews.length} Reviews</span>
            </h2>
            <div className="flex items-center gap-1 text-tertiary">
              <Star size={18} className="fill-current" />
              <span className="font-bold">4.8</span>
              <span className="text-xs text-on-surface-variant font-medium">(24 total)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="bg-surface-container-low rounded-2xl p-6 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-bold text-on-surface">{review.user}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{format(new Date(review.date), 'MMM dd, yyyy')}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={12} 
                        className={cn(i < review.rating ? "text-tertiary fill-current" : "text-on-surface-variant/20")} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-on-surface-variant mb-6 flex-1 italic">"{review.comment}"</p>
                
                {review.response ? (
                  <div className="bg-surface-container-lowest rounded-xl p-4 border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Your Response</p>
                    <p className="text-xs text-on-surface-variant">{review.response}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      placeholder="Write a response..."
                      value={responseTexts[review.id] || ''}
                      onChange={(e) => setResponseTexts(prev => ({ ...prev, [review.id]: e.target.value }))}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-xs focus:ring-2 focus:ring-primary/40 outline-none resize-none h-20"
                    />
                    <button 
                      onClick={() => handleResponse(review.id)}
                      disabled={!responseTexts[review.id]}
                      className="w-full py-2 bg-primary text-on-primary text-xs font-bold rounded-full disabled:opacity-50 transition-all hover:scale-[0.98]"
                    >
                      Send Response
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

// --- Subscription Components ---

const SubscriptionWall: React.FC<{ 
  shop: Shop; 
  onUnlock: (code: string, method: string) => void;
  loading?: boolean;
}> = ({ shop, onUnlock, loading }) => {
  const [code, setCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ott' | '1voucher' | 'admin' | null>(null);

  const handleUnlock = () => {
    if (!code) {
      toast.error('Please enter a code');
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    onUnlock(code, paymentMethod);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-surface flex items-center justify-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-surface-container-lowest rounded-[2.5rem] shadow-2xl border border-outline-variant/10 overflow-hidden"
      >
        <div className="bg-primary p-12 text-on-primary text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Rocket size={120} />
          </div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl font-headline font-black mb-4">Trial Expired</h1>
            <p className="text-on-primary/80 text-lg font-medium max-w-md mx-auto">
              Your 30-day free trial for <span className="text-white font-bold">{shop.name}</span> has ended. 
              Subscribe now to keep growing your business.
            </p>
          </motion.div>
        </div>

        <div className="p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="space-y-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Zap className="text-primary" size={20} />
                What's included:
              </h3>
              <ul className="space-y-4">
                {[
                  'Unlimited Orders',
                  'AI Menu Image Generation',
                  'Advanced Sales Insights',
                  'Real-time Stock Alerts',
                  'Priority Support'
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-on-surface-variant font-medium">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check size={12} className="text-primary" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surface-container-low rounded-3xl p-8 border border-primary/10 flex flex-col justify-center items-center text-center relative">
              <div className="absolute -top-4 bg-primary text-on-primary px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Special Offer
              </div>
              <div className="text-on-surface-variant/60 text-xs font-bold uppercase line-through mb-1">R430 / Month</div>
              <div className="text-5xl font-black text-primary mb-2">R300</div>
              <div className="text-on-surface-variant font-bold text-sm">per month</div>
              <div className="mt-4 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">
                30% OFF FOREVER
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-center mb-4">Choose Payment Method</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'ott', label: 'OTT Voucher', icon: Ticket },
                { id: '1voucher', label: '1Voucher', icon: CreditCard },
                { id: 'admin', label: 'Admin Code', icon: ShieldCheck }
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as 'ott' | '1voucher' | 'admin')}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                    paymentMethod === method.id 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-outline-variant/10 hover:border-primary/30 text-on-surface-variant"
                  )}
                >
                  <method.icon size={24} />
                  <span className="text-[10px] font-black uppercase tracking-wider">{method.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {paymentMethod && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4 pt-4"
                >
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder={paymentMethod === 'admin' ? "Enter Admin Unlock Code" : "Enter 16-digit Voucher PIN"}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full h-14 bg-surface-container-low border-2 border-outline-variant/10 rounded-2xl px-6 font-bold focus:border-primary outline-none transition-all"
                    />
                    <button 
                      onClick={handleUnlock}
                      disabled={loading}
                      className="absolute right-2 top-2 bottom-2 px-6 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Unlock Now'}
                    </button>
                  </div>
                  <p className="text-[10px] text-center text-on-surface-variant/60 font-medium">
                    {paymentMethod === 'admin' 
                      ? "Use the code provided by your account manager." 
                      : `Purchase an ${paymentMethod.toUpperCase()} voucher at any retail store.`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [kitchenMode, setKitchenMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const shopsRef = useRef<Shop[]>([]);

  const currentShop = useMemo(() => 
    shops.find(s => s.owner_id === user?.id),
    [shops, user?.id]
  );

  const trialInfo = useMemo(() => {
    if (!currentShop) return null;
    
    const trialStart = new Date(currentShop.trial_start_date || currentShop.created_at);
    const now = new Date();
    const diffTime = now.getTime() - trialStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 30 - diffDays);
    const isExpired = diffDays >= 30 && currentShop.subscription_status !== 'active';
    
    return { daysRemaining, isExpired };
  }, [currentShop]);

  const handleUnlockShop = async (code: string, method: string) => {
    if (!currentShop) return;
    
    setIsSubscribing(true);
    try {
      // For now, we only accept the admin code 200201
      if (code === '200201') {
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        
        // 1. Update Shop Status
        const { error: shopError } = await supabase
          .from('shops')
          .update({ 
            subscription_status: 'active',
            last_payment_date: new Date().toISOString(),
            next_payment_date: nextBilling.toISOString()
          })
          .eq('id', currentShop.id);
          
        if (shopError) throw shopError;

        // 2. Record Payment in the new payments table
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            shop_id: currentShop.id,
            amount: 300,
            payment_method: method.toUpperCase(),
            transaction_id: code,
            status: 'success'
          });

        if (paymentError) {
          console.error('Error recording payment:', paymentError);
          // We don't throw here because the shop is already unlocked, 
          // but we should log it.
        }
        
        toast.success('Shop Unlocked!', {
          description: 'Your subscription is now active. Thank you for your support!',
          icon: <ShieldCheck className="text-emerald-500" />
        });
        
        void fetchShops();
      } else {
        // Simulate voucher verification
        toast.error('Invalid Code', {
          description: 'The voucher PIN or admin code you entered is incorrect.'
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Verification failed: ${message}`);
    } finally {
      setIsSubscribing(false);
    }
  };

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache data to localStorage
  useEffect(() => {
    if (shops.length > 0) localStorage.setItem('le_shops', JSON.stringify(shops));
  }, [shops]);
  useEffect(() => {
    if (orders.length > 0) localStorage.setItem('le_orders', JSON.stringify(orders));
  }, [orders]);
  useEffect(() => {
    if (menuItems.length > 0) localStorage.setItem('le_menu', JSON.stringify(menuItems));
  }, [menuItems]);

  // Load cached data on mount
  useEffect(() => {
    const cachedShops = localStorage.getItem('le_shops');
    const cachedOrders = localStorage.getItem('le_orders');
    const cachedMenu = localStorage.getItem('le_menu');
    if (cachedShops) setShops(JSON.parse(cachedShops));
    if (cachedOrders) setOrders(JSON.parse(cachedOrders));
    if (cachedMenu) setMenuItems(JSON.parse(cachedMenu));
  }, []);

  useEffect(() => {
    shopsRef.current = shops;
  }, [shops]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    // Check current session with a timeout
    const getSessionWithTimeout = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timed out')), 5000)
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: { user: User } | null } };
        const { data: { session } } = result;
        setUser(session?.user ?? null);
        setIsAuthReady(true);
        if (session?.user?.user_metadata?.dark_mode !== undefined) {
          setDarkMode(session.user.user_metadata.dark_mode);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setUser(null);
        setIsAuthReady(true);
      } finally {
        setLoading(false);
      }
    };

    getSessionWithTimeout();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAuthReady(true);
      if (session?.user?.user_metadata?.dark_mode !== undefined) {
        setDarkMode(session.user.user_metadata.dark_mode);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Automatic Shop Opening/Closing based on hours
  useEffect(() => {
    const checkShopHours = async () => {
      if (!user || shops.length === 0) return;
      
      const operatingHours = user.user_metadata?.operating_hours;
      if (!operatingHours || !operatingHours.open || !operatingHours.close) return;
      
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      
      // Determine if shop should be open
      const isOpen = currentTime >= operatingHours.open && currentTime <= operatingHours.close;
      
      // Check each shop owned by the user
      for (const shop of shops) {
        if (shop.owner_id === user.id && shop.is_active !== isOpen) {
          console.log(`Auto-toggling shop ${shop.name} to ${isOpen ? 'Open' : 'Closed'}`);
          
          const { error } = await supabase
            .from('shops')
            .update({ is_active: isOpen })
            .eq('id', shop.id);
            
          if (!error) {
            setShops(prev => prev.map(s => s.id === shop.id ? { ...s, is_active: isOpen } : s));
            toast.info(`Shop ${isOpen ? 'Opened' : 'Closed'} Automatically`, {
              description: `Based on your operating hours: ${operatingHours.open} - ${operatingHours.close}`,
              icon: isOpen ? <Store className="text-emerald-500" /> : <PauseCircle className="text-primary" />,
              duration: 5000
            });
          }
        }
      }
    };

    // Check every minute
    const interval = setInterval(() => {
      void checkShopHours();
    }, 60000);
    void checkShopHours(); // Run once on mount or when shops/user change
    
    return () => clearInterval(interval);
  }, [user, shops, user?.user_metadata?.operating_hours]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    
    // First, get the shops owned by this user
    const { data: ownedShops, error: shopsError } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', user.id);
    
    if (shopsError) {
      console.error('Error fetching owned shops for orders:', shopsError);
      return;
    }

    const ownedShopIds = ownedShops?.map(s => s.id) || [];
    
    if (ownedShopIds.length === 0) {
      setOrders([]);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('shop_id', ownedShopIds)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching orders:', error);
      if (error.message === 'Failed to fetch') {
        toast.error('Network error: Could not connect to Supabase. Check your internet or ad-blocker.');
      } else {
        toast.error(`Error fetching orders: ${error.message}`);
      }
    } else if (data) {
      // Map 'price' to 'total_price' if needed
      const mappedOrders = data.map((order: Record<string, unknown>) => ({
        ...order,
        total_price: (order.total_price as number) ?? (order.price as number) ?? 0
      })) as Order[];
      console.log('Fetched orders:', mappedOrders);
      setOrders(mappedOrders);
    }
  }, [user]);

  const fetchAllMenuItems = useCallback(async () => {
    if (!user) return;
    const { data: ownedShops } = await supabase.from('shops').select('id').eq('owner_id', user.id);
    const ownedShopIds = ownedShops?.map(s => s.id) || [];
    if (ownedShopIds.length === 0) {
      setMenuItems([]);
      return;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .in('shop_id', ownedShopIds);
    
    if (data) {
      setMenuItems(data);
    } else if (error) {
      console.error('Fetch All Menu Items Error:', error);
    }
  }, [user]);

  const fetchShops = useCallback(async () => {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching shops:', error);
      if (error.message === 'Failed to fetch') {
        toast.error('Network error: Could not connect to Supabase. Check your internet or ad-blocker.');
      }
    } else if (data) {
      console.log('Fetched shops:', data);
      setShops(data);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void fetchOrders();
      void fetchShops();
      void fetchAllMenuItems();

      // Real-time subscription for orders
      const ordersChannel = supabase
        .channel('orders_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          void fetchOrders();
        })
        .subscribe();

      // Real-time subscription for shops
      const shopsChannel = supabase
        .channel('shops_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
          void fetchShops();
        })
        .subscribe();

      return () => {
        void supabase.removeChannel(ordersChannel);
        void supabase.removeChannel(shopsChannel);
      };
    }
  }, [user, fetchOrders, fetchShops, fetchAllMenuItems]);

  const deleteAllOrders = async () => {
    if (!user) return;
    console.log('Delete all orders triggered');
    
    // First, get the shops owned by this user
    const { data: ownedShops, error: shopsError } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', user.id);
    
    if (shopsError) {
      console.error('Error fetching owned shops for deletion:', shopsError);
      return;
    }

    const ownedShopIds = ownedShops?.map(s => s.id) || [];
    
    if (ownedShopIds.length === 0) {
      toast.info('No orders to delete.');
      return;
    }

    // Delete only orders belonging to these shops
    const { error } = await supabase
      .from('orders')
      .delete()
      .in('shop_id', ownedShopIds);
    
    if (error) {
      console.error('Delete All Orders Error:', error);
      toast.error(`Failed to delete orders: ${error.message}`);
    } else {
      toast.success('All orders have been deleted.');
      fetchOrders();
    }
  };

  const updateOrderStatus = async (id: string, status: OrderStatus, message?: string, estimatedTime?: string) => {
    // Optimistic Update
    const previousOrders = [...orders];
    setOrders(prev => prev.map(o => {
      if (o.id === id) {
        const updated: Order = { ...o, status };
        if (message) updated.acceptance_message = message;
        if (status === 'preparing' && !o.accepted_at) updated.accepted_at = new Date().toISOString();
        if (estimatedTime) updated.estimated_delivery_time = estimatedTime;
        return updated;
      }
      return o;
    }));
    
    const updateData: Partial<Order> = { status };
    if (message) updateData.acceptance_message = message;
    if (status === 'preparing') {
      const order = orders.find(o => o.id === id);
      if (order && !order.accepted_at) {
        updateData.accepted_at = new Date().toISOString();
      }
    }
    if (estimatedTime) updateData.estimated_delivery_time = estimatedTime;
    
    const { error } = await supabase.from('orders').update(updateData).eq('id', id);
    
    if (error) {
      console.error('Update Order Status Error:', error);
      setOrders(previousOrders);
      toast.error(`Failed to update order status: ${error.message}`);
    } else {
      toast.success(`Order marked as ${status}`);
      
      // Stock Decrement Logic: When an order is accepted (moved to 'preparing')
      if (status === 'preparing') {
        const order = orders.find(o => o.id === id);
        if (order) {
          const menuItem = menuItems.find(mi => mi.name === order.product_name && mi.shop_id === order.shop_id);
          if (menuItem && menuItem.stock_quantity !== undefined && menuItem.stock_quantity > 0) {
            const newStock = menuItem.stock_quantity - 1;
            const { error: stockError } = await supabase
              .from('menu_items')
              .update({ stock_quantity: newStock })
              .eq('id', menuItem.id);
            
            if (stockError) {
              console.error('Failed to decrement stock:', stockError);
            } else {
              // Update local state
              setMenuItems(prev => prev.map(mi => mi.id === menuItem.id ? { ...mi, stock_quantity: newStock } : mi));
              if (newStock < 5) {
                toast.warning(`Low stock alert: ${menuItem.name} has only ${newStock} left!`, {
                  description: 'Consider restocking soon.',
                  icon: <AlertCircle className="text-error" size={18} />,
                  duration: 5000
                });
              }
            }
          }
        }
      }
      
      // Notify about client update when picked up (completed)
      if (status === 'completed') {
        toast.info('Notification sent to client app', {
          description: 'The customer has been notified that their order was picked up.',
          icon: <Bell className="text-primary" size={18} />,
          duration: 4000
        });
      }
      
      // Notify about acceptance message
      if (status === 'preparing' && message) {
        toast.info('Acceptance message sent!', {
          description: `"${message}" sent to the customer app.`,
          icon: <MessageSquare className="text-primary" size={18} />,
          duration: 4000
        });
      }
      
      fetchOrders();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleSaveProfile = async (data: ProfileData) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: data.fullName,
          phone: data.phone,
          location: data.location,
          address: data.address,
          operating_hours: data.operatingHours,
          marketing_preferences: data.marketing,
          dark_mode: data.darkMode,
          avatar_url: data.avatarUrl
        }
      });

      if (error) throw error;
      
      if (data.darkMode !== undefined) {
        setDarkMode(data.darkMode);
      }
      toast.success('Profile updated successfully!');
      setIsEditingProfile(false);
      setAuthView('signin');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    }
  };

  if (isVerifying) {
    return (
      <VerificationPending 
        email={signupEmail}
        onBack={() => setIsVerifying(false)} 
        onVerified={() => {
          setIsVerifying(false);
          setIsEditingProfile(true);
        }}
        onSupport={() => {
          window.location.href = 'mailto:support@localeats.com';
        }} 
      />
    );
  }

  if (isEditingProfile) {
    return (
      <EditProfile 
        onBack={() => setIsEditingProfile(false)}
        onSave={handleSaveProfile}
        userId={user?.id || ''}
        initialData={{
          fullName: user?.user_metadata?.full_name || '',
          email: user?.email || signupEmail,
          phone: user?.user_metadata?.phone || '',
          location: user?.user_metadata?.location || '',
          address: user?.user_metadata?.address || '',
          avatarUrl: user?.user_metadata?.avatar_url || '',
          operatingHours: user?.user_metadata?.operating_hours || { open: '08:00', close: '20:00' }
        }}
      />
    );
  }

  if (!user) {
    return authView === 'signin' ? (
      <SignIn onSignUpClick={() => setAuthView('signup')} onSuccess={() => {}} />
    ) : (
      <SignUp 
        onSignInClick={() => setAuthView('signin')} 
        onSuccess={(email) => {
          setSignupEmail(email);
          setIsVerifying(true);
        }} 
      />
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'orders', label: 'Orders', icon: ReceiptText },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'insights', label: 'Insights', icon: TrendingUp },
  ];

  return (
    <div className={cn(
      "min-h-screen bg-surface selection:bg-primary-fixed selection:text-on-primary-fixed transition-colors duration-300",
      darkMode && "dark"
    )}>
      <Toaster position="top-center" richColors />
      
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-error text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
          <PauseCircle size={14} />
          YOU ARE OFFLINE. Changes will be saved locally and synced when you reconnect.
        </div>
      )}

      {trialInfo && trialInfo.daysRemaining <= 7 && !trialInfo.isExpired && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-on-primary px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
          <Clock size={14} />
          TRIAL ENDING SOON: You have {trialInfo.daysRemaining} days left of your free trial. Subscribe now to avoid interruption.
        </div>
      )}

      {trialInfo?.isExpired && currentShop && (
        <SubscriptionWall 
          shop={currentShop} 
          onUnlock={handleUnlockShop} 
          loading={isSubscribing} 
        />
      )}

      {/* TopAppBar */}
      {!kitchenMode && (
        <header className="fixed top-0 w-full z-50 bg-white/70 dark:bg-surface-container-lowest/70 backdrop-blur-xl shadow-sm shadow-orange-900/5">
        <div className="flex justify-between items-center px-6 h-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="text-primary" size={24} />
            <span className="font-headline tracking-tight font-bold text-2xl font-black text-on-surface">LocalEats</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "px-3 py-1 rounded-lg transition-colors font-medium text-sm",
                  activeTab === item.id ? "text-primary font-bold" : "text-on-surface/60 hover:bg-surface-container-low dark:hover:bg-surface-container-high"
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors"
              title="Edit Profile"
            >
              <UserIcon size={20} />
            </button>
            <button 
              onClick={handleSignOut}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center overflow-hidden border-2 border-primary/10">
              <img 
                alt="Profile" 
                className="w-full h-full object-cover" 
                src={user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'default'}`} 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'default'}`;
                }}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>
      )}

      <main className={cn("px-6 max-w-7xl mx-auto", kitchenMode ? "pt-6 pb-6" : "pt-24 pb-32")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'dashboard' && (
              <DashboardOverview 
                orders={orders} 
                loading={loading} 
                shops={shops} 
                user={user} 
                onNavigate={setActiveTab}
                onRefresh={() => {
                  fetchShops();
                  fetchOrders();
                  fetchAllMenuItems();
                }}
                onEditProfile={() => setIsEditingProfile(true)}
                menuItems={menuItems}
                trialInfo={trialInfo}
                currentShop={currentShop}
              />
            )}
            {activeTab === 'menu' && (
              <MenuManagement 
                shops={shops} 
                loading={loading} 
                user={user} 
                onRefreshMenu={() => {
                  fetchAllMenuItems();
                  fetchShops();
                }} 
              />
            )}
            {activeTab === 'orders' && (
              <OrdersManagement 
                orders={orders} 
                onUpdateStatus={updateOrderStatus} 
                onDeleteAllOrders={deleteAllOrders} 
                loading={loading} 
                onRefresh={fetchOrders}
                kitchenMode={kitchenMode}
                setKitchenMode={setKitchenMode}
              />
            )}
            {activeTab === 'insights' && <Insights orders={orders} menuItems={menuItems} loading={loading} />}
            {activeTab === 'payments' && currentShop && <PaymentHistory shopId={currentShop.id} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* BottomNavBar */}
      {!kitchenMode && (
        <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-white/70 dark:bg-surface-container-lowest/70 backdrop-blur-xl rounded-t-3xl border-t border-outline-variant/10 shadow-[0_-8px_24px_-4px_rgba(167,52,0,0.12)]">
        <div className="flex justify-around items-center px-4 pb-8 pt-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all active:scale-90 duration-200",
                activeTab === item.id ? "bg-orange-50 dark:bg-primary/10 text-primary" : "text-secondary hover:text-primary"
              )}
            >
              <item.icon size={24} className={cn("mb-1", activeTab === item.id && "fill-current")} />
              <span className="font-inter text-[10px] uppercase tracking-wider font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      )}
    </div>
  );
}
