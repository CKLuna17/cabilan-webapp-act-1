import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, UserCheck, Sparkles, FolderLock, CheckCircle2, ShieldCheck } from 'lucide-react';

const Silver3DShield = () => (
  <div className="relative mb-3 flex items-center justify-center">
    {/* Soft subtle silver specular glow under the shield */}
    <div className="absolute inset-0 bg-white/40 rounded-full blur-xl pointer-events-none scale-125" />
    <svg
      viewBox="0 0 64 72"
      className="w-16 h-18 drop-shadow-[0_12px_22px_rgba(15,23,42,0.45)] transition-transform hover:scale-105 duration-300 relative z-10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Outer 3D Silver Rim Gradient */}
        <linearGradient id="silverRimGrad" x1="4" y1="2" x2="60" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="20%" stopColor="#E2E8F0" />
          <stop offset="45%" stopColor="#94A3B8" />
          <stop offset="70%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Outer Silver Bevel Border */}
        <linearGradient id="silverBevelGrad" x1="10" y1="4" x2="54" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="30%" stopColor="#CBD5E1" />
          <stop offset="70%" stopColor="#64748B" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Left 3D Metallic Facet (High Specular Reflection) */}
        <linearGradient id="silverLeftFacet" x1="10" y1="8" x2="32" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#F1F5F9" />
          <stop offset="65%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>

        {/* Right 3D Metallic Facet (Shaded Depth) */}
        <linearGradient id="silverRightFacet" x1="54" y1="8" x2="32" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="35%" stopColor="#94A3B8" />
          <stop offset="75%" stopColor="#64748B" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* Keyhole / Emblem Polished Silver Gradient */}
        <linearGradient id="silverEmblemGrad" x1="32" y1="20" x2="32" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
      </defs>

      {/* 3D Silver Outer Rim Border */}
      <path
        d="M32 2L58 11.5C58 37 47 58 32 70C17 58 6 37 6 11.5L32 2Z"
        fill="url(#silverRimGrad)"
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />

      {/* 3D Silver Beveled Inset */}
      <path
        d="M32 6L53.5 13.8C53.5 35.5 44 54 32 64.5C20 54 10.5 35.5 10.5 13.8L32 6Z"
        fill="url(#silverBevelGrad)"
      />

      {/* Left 3D Facet (Light Crest) */}
      <path
        d="M32 7L12 14.5C12 34.5 20.5 52 32 62.5V7Z"
        fill="url(#silverLeftFacet)"
      />

      {/* Right 3D Facet (Shadowed Crest) */}
      <path
        d="M32 7L52 14.5C52 34.5 43.5 52 32 62.5V7Z"
        fill="url(#silverRightFacet)"
      />

      {/* Specular Center Ridge Highlight */}
      <line x1="32" y1="7" x2="32" y2="62.5" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.9" />

      {/* Top Rim Specular Glint */}
      <path
        d="M20 7L32 2.5L44 7"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.95"
      />

      {/* Polished Silver Center Shield Emblem / Vault Core */}
      <circle cx="32" cy="28" r="6" fill="url(#silverEmblemGrad)" stroke="#FFFFFF" strokeWidth="0.8" />
      <path
        d="M29.5 29L28 41H36L34.5 29H29.5Z"
        fill="url(#silverEmblemGrad)"
        stroke="#CBD5E1"
        strokeWidth="0.6"
      />
      {/* 3D Inset Keyhole */}
      <circle cx="32" cy="28" r="2.4" fill="#1E293B" />
      <polygon points="30.8,28 33.2,28 32.6,35 31.4,35" fill="#1E293B" />
    </svg>
  </div>
);

export const AuthPage: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInDemoAccount, authError, clearAuthError, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'freelancer' | 'client'>('freelancer');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name, role);
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async (demoRole: 'freelancer' | 'client') => {
    setSubmitting(true);
    try {
      await signInDemoAccount(demoRole);
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ backgroundImage: `url('/assets/aistudio/image_2e397125.png')` }}
    >
      {/* Subtle overlay for visual harmony and contrast */}
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] pointer-events-none" />

      {/* Logo & Brand Header */}
      <div className="flex flex-col items-center text-center mb-6 relative z-10">
        <Silver3DShield />
        <div className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-md">
          ClientVault
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/25 text-white px-2 py-0.5 rounded-full border border-white/40 backdrop-blur-xs shadow-xs">Portal</span>
        </div>
        <p className="text-xs text-white/95 mt-1 font-medium drop-shadow-sm">Secure Client File Management</p>
      </div>

      {/* Frosted Glass Sign In Box */}
      <div className="w-full max-w-md relative z-10">
        {/* Soft light gray ambient backlight glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-slate-100/50 via-white/60 to-slate-200/50 rounded-[32px] blur-lg opacity-30 pointer-events-none" />

        {/* Frosted glass container with luminous border */}
        <div className="relative p-[1.5px] rounded-[28px] bg-gradient-to-b from-white/90 via-white/50 to-slate-200/40 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.35),0_0_35px_rgba(255,255,255,0.35)]">
          <div className="bg-white/45 backdrop-blur-3xl rounded-[26px] p-8 md:p-10 shadow-sm border border-white/60">
            {/* Header Switcher */}
            <div className="flex items-center justify-between border-b border-white/40 pb-5 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight drop-shadow-2xs">
                  {isSignUp ? 'Create an Account' : 'Sign In'}
                </h2>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {isSignUp ? 'Get started with your free ClientVault portal' : 'Access your files and client portals'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  clearAuthError();
                }}
                className="text-xs font-bold text-slate-800 hover:text-slate-900 bg-white/60 hover:bg-white/80 border border-white/70 px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer backdrop-blur-xs"
              >
                {isSignUp ? 'Sign In instead' : 'Create Account'}
              </button>
            </div>

            {/* Quick Demo Access Buttons for instant evaluation */}
            <div className="mb-6 p-3.5 bg-white/35 backdrop-blur-md rounded-2xl border border-white/50">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Quick Demo Access (Instant preview)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('freelancer')}
                  disabled={submitting || loading}
                  className="px-3 py-2 text-xs font-semibold bg-white/70 hover:bg-white/90 text-slate-800 rounded-xl border border-white/80 transition flex items-center justify-center gap-1.5 shadow-xs backdrop-blur-xs cursor-pointer"
                >
                  <FolderLock className="w-3.5 h-3.5 text-blue-600" />
                  Freelancer View
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('client')}
                  disabled={submitting || loading}
                  className="px-3 py-2 text-xs font-semibold bg-white/70 hover:bg-white/90 text-slate-800 rounded-xl border border-white/80 transition flex items-center justify-center gap-1.5 shadow-xs backdrop-blur-xs cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Client View
                </button>
              </div>
            </div>

            <div className="relative flex items-center justify-center mb-6">
              <div className="border-t border-white/50 w-full"></div>
              <span className="bg-white/60 backdrop-blur-md px-3 text-xs font-medium text-slate-700 absolute rounded-full border border-white/50 shadow-2xs">or continue with email</span>
            </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <span className="font-bold">Notice:</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name or Studio
                </label>
                <input
                  type="text"
                  required={isSignUp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera Design"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  I am using ClientVault as a:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('freelancer')}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition ${
                      role === 'freelancer'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Freelancer / Designer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('client')}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition ${
                      role === 'client'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Client
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white/60 focus:bg-white/90 backdrop-blur-md border border-white/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white transition text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                {!isSignUp && (
                  <span className="text-[11px] text-blue-600 hover:underline cursor-pointer">
                    Forgot password?
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white/60 focus:bg-white/90 backdrop-blur-md border border-white/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-white transition text-slate-800 placeholder-slate-400"
                />
              </div>
              {isSignUp && (
                <p className="text-[11px] text-slate-400 mt-1">Must be at least 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Create an Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Google Sign In option */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              disabled={submitting || loading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-200 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:border-slate-300"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
