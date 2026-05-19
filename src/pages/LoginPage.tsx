import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Saisissez votre email puis cliquez sur "Mot de passe oublié ?"');
      return;
    }
    setResetLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetSent(true);
      setError('');
    } catch {
      setError('Erreur lors de l\'envoi du lien de réinitialisation');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2147 40%, #0a1a3a 70%, #0d2255 100%)' }}>

      {/* Background cross pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="cross" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <line x1="30" y1="10" x2="30" y2="50" stroke="white" strokeWidth="1.5" />
              <line x1="10" y1="30" x2="50" y2="30" stroke="white" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cross)" />
        </svg>
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)' }} />

      {/* Large background cross */}
      <div className="absolute right-8 bottom-8 w-32 h-32 pointer-events-none select-none" style={{ opacity: 0.05 }}>
        <svg width="100%" height="100%" viewBox="0 0 200 200" fill="none">
          <rect x="80" y="0" width="40" height="200" fill="white" />
          <rect x="0" y="80" width="200" height="40" fill="white" />
        </svg>
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-[420px] mx-4 rounded-2xl p-8"
        style={{
          background: 'rgba(10, 26, 60, 0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
            ✝
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">Église AEF</h1>
          <p className="text-[11px] tracking-[0.2em] uppercase mt-1" style={{ color: 'rgba(148,163,184,0.8)' }}>
            Espace Gestionnaire
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-[10px] tracking-[0.15em] uppercase font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Connexion
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.12em] uppercase mb-1.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Identifiant ou Email
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.5)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => {
                  e.currentTarget.style.border = '1px solid rgba(59,130,246,0.6)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                }}
                onBlur={e => {
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.12em] uppercase mb-1.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.5)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-11 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => {
                  e.currentTarget.style.border = '1px solid rgba(59,130,246,0.6)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                }}
                onBlur={e => {
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'rgba(148,163,184,0.5)' }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setRemember(v => !v)}
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                style={{
                  background: remember ? '#2563eb' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${remember ? '#2563eb' : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                {remember && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span className="text-[11px]" style={{ color: 'rgba(148,163,184,0.7)' }}>Se souvenir de moi</span>
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-[11px] transition-colors hover:text-blue-400 disabled:opacity-50"
              style={{ color: 'rgba(148,163,184,0.6)' }}
            >
              {resetLoading ? 'Envoi...' : 'Mot de passe oublié ?'}
            </button>
          </div>

          {/* Feedback */}
          {error && (
            <p className="text-xs text-red-400 px-1">{error}</p>
          )}
          {resetSent && (
            <p className="text-xs text-emerald-400 px-1">✓ Lien de réinitialisation envoyé à {email}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-1 transition-all disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connexion...
              </span>
            ) : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-[10px] mt-6" style={{ color: 'rgba(148,163,184,0.3)' }}>
          Accès réservé aux gestionnaires du service
        </p>
      </motion.div>
    </div>
  );
}
