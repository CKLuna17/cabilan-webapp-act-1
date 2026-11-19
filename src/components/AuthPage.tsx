import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  BookOpenCheck,
  GraduationCap,
  Sun,
  Moon,
} from 'lucide-react';
import { AttendlyLogo } from './AttendlyLogo';
import { UserRole } from '../types/attendly';

export const AuthPage: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, authError, clearAuthError, loading } =
    useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('BSIT · College of Computing');
  const [role, setRole] = useState<UserRole>('student');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name, role, department);
      } else {
        await signInWithEmail(email, password, role);
      }
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions: {
    id: UserRole;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
    { id: 'professor', label: 'Professor', icon: BookOpenCheck },
    { id: 'student', label: 'Student', icon: GraduationCap },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#ECE9FC] bg-[radial-gradient(circle_at_14%_8%,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0)_48%),linear-gradient(145deg,rgba(255,255,255,0.72)_0%,rgba(236,233,252,0.92)_52%,rgba(255,255,255,0.48)_100%)] dark:bg-[#110E26] dark:bg-[radial-gradient(circle_at_14%_8%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_46%),linear-gradient(145deg,rgba(255,255,255,0.06)_0%,rgba(17,14,38,0.98)_52%,rgba(255,255,255,0.035)_100%)] text-slate-900 dark:text-white flex flex-col items-center justify-center px-4 pb-8 pt-[max(2.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-10 sm:pb-10 xl:p-6 relative overflow-x-hidden transition-colors duration-200 smooth-resize">
      {/* Subtle Ambient Indigo Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[540px] h-[340px] rounded-full bg-[#6B5BF7]/18 dark:bg-[#7467FF]/18 blur-3xl" />
        <div className="absolute -bottom-32 right-0 w-[380px] h-[300px] rounded-full bg-[#5142E6]/12 dark:bg-[#5646EC]/15 blur-3xl" />
      </div>

      {/* Top-Right Icon-Only Appearance Button */}
      <div className="w-full max-w-md flex items-center justify-end mb-4 relative z-10">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1B1738] border border-[#E7E3FA] dark:border-[#2C2654] shadow-xs flex items-center justify-center text-slate-700 dark:text-white hover:border-[#6B5BF7] transition cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Logo & Brand Header */}
      <div className="flex flex-col items-center text-center mb-5 sm:mb-6 relative z-10">
        <AttendlyLogo size="lg" showGlow />
        <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Attendly
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A6A0CE] mt-1 font-medium">
          Know where to be and when.
        </p>
      </div>

      {/* Sign In Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white dark:bg-[#1B1738] rounded-3xl p-5 sm:p-8 border border-[#E7E3FA] dark:border-[#2C2654] shadow-[0_20px_60px_-15px_rgba(81,66,230,0.16)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)]">
          {/* Centered Card Header */}
          <div className="flex flex-col items-center text-center border-b border-[#EFEBFD] dark:border-[#2C2654] pb-4 sm:pb-5 mb-5 sm:mb-6 space-y-3">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A6A0CE] font-medium">
                {isSignUp
                  ? 'Register your Admin, Professor, or Student portal'
                  : 'Access your student tracker & campus schedule'}
              </p>
            </div>

            <div className="inline-flex p-1 rounded-full bg-[#F4F2FC] dark:bg-[#241F4A] border border-[#E7E3FA] dark:border-[#322B61]">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  clearAuthError();
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  !isSignUp
                    ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332] shadow-xs'
                    : 'text-slate-600 dark:text-[#A6A0CE] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  clearAuthError();
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  isSignUp
                    ? 'bg-[#171332] dark:bg-white text-white dark:text-[#171332] shadow-xs'
                    : 'text-slate-600 dark:text-[#A6A0CE] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-5 p-3 rounded-2xl bg-[#FEE2E2] dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-[#BE123C] dark:text-rose-200 text-xs flex items-start gap-2">
              <span className="font-bold">Notice:</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Portal View Selector (Only available on Sign In page) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1CCEE] mb-1.5">
                Portal View
              </label>
              <div className="grid grid-cols-3 gap-2">
                {roleOptions.map((opt) => {
                  const Icon = opt.icon;
                  const selected = role === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRole(opt.id)}
                      className={`py-2.5 px-2 min-h-[44px] text-xs font-semibold rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'bg-gradient-to-br from-[#6B5BF7] to-[#5142E6] text-white border-[#5142E6] shadow-md shadow-[#5142E6]/25'
                          : 'bg-[#F5F3FE] dark:bg-[#241F4A] text-slate-700 dark:text-[#D1CCEE] border-[#E7E3FA] dark:border-[#322B61] hover:border-[#6B5BF7]/50'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          selected ? 'text-white' : 'text-[#5346E8] dark:text-[#968BFF]'
                        }`}
                      />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isSignUp && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1CCEE] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required={isSignUp}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      role === 'admin'
                        ? 'Admin Office'
                        : role === 'professor'
                        ? 'Prof. Dela Cruz'
                        : 'Maya Cruz'
                    }
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] focus:bg-white dark:focus:bg-[#2B2556] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B5BF7]/35 focus:border-[#6B5BF7] transition text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#7A74A6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1CCEE] mb-1">
                    Department / Program
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="BSIT · 3-A"
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] focus:bg-white dark:focus:bg-[#2B2556] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B5BF7]/35 focus:border-[#6B5BF7] transition text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#7A74A6]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1CCEE] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-[#8E88BE] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] focus:bg-white dark:focus:bg-[#2B2556] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B5BF7]/35 focus:border-[#6B5BF7] transition text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#7A74A6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1CCEE] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-[#8E88BE] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-sm bg-[#F7F6FE] dark:bg-[#241F4A] focus:bg-white dark:focus:bg-[#2B2556] border border-[#E7E3FA] dark:border-[#322B61] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B5BF7]/35 focus:border-[#6B5BF7] transition text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#7A74A6]"
                />
              </div>
              {isSignUp && (
                <p className="text-[11px] text-slate-500 dark:text-[#A6A0CE] mt-1">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full mt-2 py-3 px-4 min-h-[46px] bg-gradient-to-r from-[#6B5BF7] to-[#5142E6] hover:from-[#5E4DF0] hover:to-[#4638D6] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#5142E6]/25 hover:shadow-[#5142E6]/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Google Sign In option */}
          <div className="mt-5 pt-4 border-t border-[#EFEBFD] dark:border-[#2C2654]">
            <button
              type="button"
              onClick={() => signInWithGoogle(role)}
              disabled={submitting || loading}
              className="w-full py-2.5 px-4 min-h-[44px] bg-[#F7F6FE] dark:bg-[#241F4A] hover:bg-[#ECE9FC] dark:hover:bg-[#2E285D] text-slate-800 dark:text-white text-sm font-semibold border border-[#E7E3FA] dark:border-[#322B61] rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In with Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
