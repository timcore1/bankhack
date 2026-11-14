import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Database,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import { adminExport } from '../api/client.js';

const DEFAULT_TEMPLATE = 'Выписка для клиента: {{ search }}';

const ROLE_CLS = {
  admin: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  vip: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  user: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AdminPage({ onBack, onLogout, notice, isAdmin = true }) {
  const [search, setSearch] = useState('');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rawError, setRawError] = useState(null);

  const runExport = useCallback(async (searchValue, templateValue) => {
    setLoading(true);
    setError('');
    setRawError(null);
    try {
      const data = await adminExport({ search: searchValue, template: templateValue });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.message || 'Ошибка формирования выписки');
      setRawError(err.detail || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    runExport('', DEFAULT_TEMPLATE);
  }, [runExport, isAdmin]);

  const handleSubmit = (event) => {
    event.preventDefault();
    runExport(search, template);
  };

  return (
    <div className="min-h-screen neon-grid">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#060913]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-violet-600 flex items-center justify-center shadow-glow">
              <Terminal className="w-5 h-5 text-slate-950" />
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-lg font-bold tracking-tight text-white">BankHack</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-rose-500/15 text-rose-300 border border-rose-400/30">
                Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">В кабинет</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 hover:text-rose-300 hover:border-rose-500/40 transition"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {notice && (
          <div className="glass-card rounded-2xl p-4 border border-amber-400/25 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90">{notice}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-5 glass-card rounded-3xl p-6">
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-300" />
              Генерация выписки
            </h1>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Поиск клиентов по логину или роли и формирование банковской выписки.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Поисковый запрос
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="vip_client"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-10 pr-4 py-3 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Шаблон комментария к выписке
                </label>
                <textarea
                  rows={3}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 px-4 py-3 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition resize-y"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
                  Доступна переменная {'{{ search }}'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 hover:brightness-110 disabled:opacity-50 transition shadow-glow"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>{loading ? 'Формирование...' : 'Сформировать выписку'}</span>
              </button>
            </form>

            {error && (
              <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                {rawError && typeof rawError === 'object' && rawError.query && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/80 p-2 font-mono text-[10px] text-rose-200/80 whitespace-pre-wrap">
                    {rawError.query}
                  </pre>
                )}
              </div>
            )}
          </section>

          <section className="lg:col-span-7 space-y-6">
            <div className="glass-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm uppercase tracking-wider text-slate-400">
                  Результат выборки
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {result ? `${result.total} записей` : 'нет данных'}
                </span>
              </div>

              {result ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                        <th className="py-2 pr-3">ID</th>
                        <th className="py-2 pr-3">Клиент</th>
                        <th className="py-2 pr-3">Роль</th>
                        <th className="py-2 text-right">Баланс</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {result.rows.map((row, idx) => (
                        <tr
                          key={`${row.id}-${idx}`}
                          className="border-b border-slate-800/60 last:border-0"
                        >
                          <td className="py-2.5 pr-3 text-slate-500">{row.id}</td>
                          <td className="py-2.5 pr-3 text-slate-100">@{row.username}</td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] border ${
                                ROLE_CLS[row.role] || ROLE_CLS.user
                              }`}
                            >
                              {row.role}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-emerald-300">
                            {formatMoney(row.balance)} ₽
                          </td>
                        </tr>
                      ))}
                      {result.rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                            По запросу ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Выполните поиск, чтобы увидеть данные.</p>
              )}
            </div>

            {result && (
              <>
                <div className="glass-card rounded-3xl p-6">
                  <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">
                    Комментарий к выписке
                  </h2>
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 px-4 py-3 text-sm text-slate-200 whitespace-pre-wrap break-words font-mono">
                    {result.rendered_comment}
                  </div>
                </div>

                <div className="glass-card rounded-3xl p-6">
                  <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">
                    Выполненный SQL-запрос
                  </h2>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950/80 border border-slate-800 px-4 py-3 text-[11px] leading-relaxed font-mono text-cyan-200/90 whitespace-pre-wrap break-words">
                    {result.query}
                  </pre>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
