import { useState } from 'react';
import { Zap, LogIn, Mail, Lock, Loader, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');

    if (mode === 'login') {
      const result = await signInWithEmail(email.trim(), password);
      if (result.error) setError(result.error);
    } else {
      const result = await signUpWithEmail(email.trim(), password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Account created successfully. You can now sign in.');
        setMode('login');
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">FreepikAI</h1>
          <p className="text-slate-400 text-sm mt-2">Transform ideas into stunning visuals</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h2 className="text-white font-semibold text-lg mb-1 text-center">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-slate-400 text-sm text-center mb-6">
            {mode === 'login' ? 'Sign in to start generating' : 'Register a new account'}
          </p>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs mb-4">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 mb-5">
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Mail size={16} />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500">or</span>
            </div>
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold py-3 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <div className="mt-5 text-center">
            {mode === 'login' ? (
              <p className="text-slate-500 text-xs">
                Don't have an account?{' '}
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Register
                </button>
              </p>
            ) : (
              <p className="text-slate-500 text-xs">
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-slate-600 text-xs">
          <LogIn size={12} />
          <span>Secure authentication via Supabase</span>
        </div>
      </div>
    </div>
  );
}
