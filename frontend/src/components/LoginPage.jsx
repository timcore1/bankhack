import React, { useState } from 'react';
import { Lock, User, Shield, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { username: 'user1', label: 'user1 (100 ₽)' },
  { username: 'vip_client', label: 'vip_client (50 000 ₽)' },
  { username: 'admin', label: 'admin' },
];

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen neon-grid flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CTF Security Lab · Isolated Environment</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600 flex items-center justify-center shadow-glow">
              <Shield className="w-6 h-6 text-slate-950" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Bank<span className="text-cyan-400">Hack</span>
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Цифровой нео-банк нового поколения
          </p>
        </div>

        <div className="glass-card rounded-3xl p-7 shadow-glow border border-slate-700/60">
          <h2 className="text-xl font-semibold text-white mb-1">Вход в личный кабинет</h2>
          <p className="text-xs text-slate-400 mb-6">
            Используйте учётные данные клиента для доступа к счёту
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Логин
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="user1"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 hover:brightness-110 disabled:opacity-50 transition shadow-glow"
            >
              <span>{loading ? 'Проверка...' : 'Войти в банк'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2.5">
              Быстрое заполнение (лабораторные аккаунты)
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    setUsername(acc.username);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200 transition"
                >
                  @{acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
