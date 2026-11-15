import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldCheck, BookOpenCheck, GraduationCap } from 'lucide-react';
import { AttendlyLogo } from './AttendlyLogo';
import { UserRole } from '../types/attendly';

export const AuthPage: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, authError, clearAuthError, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [role, setRole] = useState<UserRole>('professor');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name, role, department);
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions: { id: UserRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
    { id: 'professor', label: 'Professor', icon: BookOpenCheck },
    { id: 'student', label: 'Student', icon: GraduationCap },
  ];

  return (
    <div
      className="min-h-[100dvh] bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-x-hidden"
      style={{ backgroundImage: `url('/assets/aistudio/image_2e397125.png')` }}
    >
      {/* Subtle overlay for visual harmony and contrast */}
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] pointer-events-none" />

      {/* Logo & Brand Header */}
      <div className="flex flex-col items-center text-center mb-5 sm:mb-6 relative z-10">
        <AttendlyLogo size="lg" />
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-md">
          Attendly
        </h1>
        <p className="text-xs text-white/95 mt-1 font-medium drop-shadow-sm">
          Know where to be and when.
        </p>
      </div>

      {/* Frosted Glass Sign In Box */}
      <div className="w-full max-w-md relative z-10">
        {/* Soft light gray ambient backlight glow (30% opacity) */}
        <div className="absolute -inset-1 bg-gradient-to-r from-slate-100/50 via-white/60 to-slate-200/50 rounded-[32px] blur-lg opacity-30 pointer-events-none" />

        {/* Frosted glass container with luminous border */}
        <div className="relative p-[1.5px] rounded-[24px] sm:rounded-[28px] bg-gradient-to-b from-white/90 via-white/50 to-slate-200/40 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.35),0_0_35px_rgba(255,255,255,0.35)]">
          <div className="bg-white/45 backdrop-blur-3xl rounded-[22px] sm:rounded-[26px] p-5 sm:p-8 md:p-9 shadow-sm border border-white/60">
            {/* Header Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/40 pb-4 sm:pb-5 mb-5 sm:mb-6">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight drop-shadow-2xs">
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </h2>
                <p className="text-xs text-slate-700 mt-1 font-medium">
                  {isSignUp
                    ? 'Register your Admin, Professor, or Student portal'
                    : 'Access your student tracker & campus schedule'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  clearAuthError();
                }}
                className="text-xs font-bold text-slate-800 hover:text-slate-900 bg-white/65 hover:bg-white/85 border border-white/75 px-3.5 py-2 min-h-[40px] rounded-xl transition shadow-xs cursor-pointer backdrop-blur-xs whitespace-nowrap shrink-0"
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </div>

            {/* Error Banner */}
            {authError && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 backdrop-blur-sm">
                <span className="font-bold">Notice:</span>
                <span>{authError}</span>
              </div>
            )}

            {/* Main Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Portal Role
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
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                                : 'bg-white/60 text-slate-800 border-white/75 hover:bg-white/85'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${selected ? 'text-white' : 'text-blue-600'}`} />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required={isSignUp}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={
                          role === 'admin'
                            ? 'Dr. Jordan Vance'
                            : role === 'professor'
                            ? 'Prof. Alex Rivera'
                            : 'Sarah Chen'
                        }
                        className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-white/65 focus:bg-white/95 backdrop-blur-md border border-white/75 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white transition text-slate-900 placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Department
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Computer Science"
                        className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-white/65 focus:bg-white/95 backdrop-blur-md border border-white/75 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white transition text-slate-900 placeholder-slate-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-sm bg-white/65 focus:bg-white/95 backdrop-blur-md border border-white/75 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white transition text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-800">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-sm bg-white/65 focus:bg-white/95 backdrop-blur-md border border-white/75 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white transition text-slate-900 placeholder-slate-400"
                  />
                </div>
                {isSignUp && (
                  <p className="text-[11px] text-slate-700 mt-1">Must be at least 6 characters</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="w-full mt-2 py-3 px-4 min-h-[46px] bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
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
            <div className="mt-5 pt-4 border-t border-white/45 space-y-3">
              {!isSignUp && (
                <div>
                  <span className="block text-[11px] font-semibold text-slate-700 mb-1.5 text-center">
                    First time with Google? Select your dashboard role:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/40 rounded-xl border border-white/60">
                    {roleOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRole(opt.id)}
                        className={`py-2 px-2 min-h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap ${
                          role === opt.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => signInWithGoogle(role)}
                disabled={submitting || loading}
                className="w-full py-2.5 px-4 min-h-[44px] bg-white/85 hover:bg-white text-slate-800 text-sm font-semibold border border-white/80 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
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
    </div>
  );
};
