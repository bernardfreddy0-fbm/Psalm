import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { request } from '@/lib/apiClient';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const [token, setToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
      setTokenValid(true);
    } else {
      setTokenValid(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await request('POST', '/auth/set-password', { token, password });
      toast.success('Mot de passe mis à jour');
      navigate('/');
    } catch (err: any) {
      let msg = err?.message ?? 'Une erreur inattendue est survenue.';
      try { msg = JSON.parse(msg)?.error ?? msg; } catch {}
      toast.error('Erreur', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2147 40%, #0a1a3a 70%, #0d2255 100%)' }}
    >
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
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)' }}
      />

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
          <div
            className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}
          >
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
            Nouveau mot de passe
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Invalid token state */}
        {tokenValid === false && (
          <div
            className="flex items-start gap-2 px-3 py-3 rounded-xl text-xs mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold">Lien invalide ou expiré</p>
              <p className="text-red-300/70 mt-0.5">
                Ce lien de réinitialisation n'est plus valide. Veuillez faire une nouvelle demande depuis la page de connexion.
              </p>
            </div>
          </div>
        )}

        {/* Form — shown only when token is valid */}
        {tokenValid === true && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label
                className="block text-[10px] font-semibold tracking-[0.12em] uppercase mb-1.5"
                style={{ color: 'rgba(148,163,184,0.7)' }}
              >
                Nouveau mot de passe
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
                  minLength={8}
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

            {/* Confirm password */}
            <div>
              <label
                className="block text-[10px] font-semibold tracking-[0.12em] uppercase mb-1.5"
                style={{ color: 'rgba(148,163,184,0.7)' }}
              >
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
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
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(148,163,184,0.5)' }}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Inline validation error */}
            {error && (
              <p className="text-xs text-red-400 px-1">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mise à jour...
                </span>
              ) : (
                'Définir le nouveau mot de passe'
              )}
            </button>
          </form>
        )}

        {/* Loading state while checking token */}
        {tokenValid === null && (
          <div className="flex items-center justify-center py-6">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        <p className="text-center text-[10px] mt-6" style={{ color: 'rgba(148,163,184,0.3)' }}>
          Accès réservé aux gestionnaires du service
        </p>
      </motion.div>
    </div>
  );
}
