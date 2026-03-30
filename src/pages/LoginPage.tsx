import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Music } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full gold-shimmer mb-5">
            <Music className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Église AEF
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Communauté chrétienne vivante
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-lg p-8 border border-border shadow-sm">
          <h2 className="text-lg font-display font-semibold text-foreground mb-5 text-center">Connexion</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Identifiant ou adresse e-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-gold text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-gold text-sm"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="rounded border-input" />
              <label htmlFor="remember" className="text-sm text-muted-foreground">Se souvenir de moi</label>
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-gold text-gold-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-sm text-gold cursor-pointer hover:underline">← Aller sur Église AEF</p>
          <p className="text-xs text-muted-foreground mt-4">
            Fait avec ❤️ pour la gloire de Dieu
          </p>
        </div>
      </motion.div>
    </div>
  );
}
