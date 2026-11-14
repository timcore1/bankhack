import React, { useState } from 'react';
import {
  Shield,
  LogOut,
  Send,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Crown,
  CheckCircle2,
  Cpu,
  Terminal,
} from 'lucide-react';
import BalanceChart from './BalanceChart.jsx';
import TransactionsTable from './TransactionsTable.jsx';
import TransferModal from './TransferModal.jsx';
import { isAdminToken } from '../api/client.js';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const ROLE_BADGE = {
  admin: { label: 'ADMIN', cls: 'bg-rose-500/15 text-rose-300 border-rose-400/30' },
  vip: { label: 'VIP PRIVATE', cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  user: { label: 'STANDARD', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
};

export default function DashboardPage({
  dashboard,
  onLogout,
  onRefresh,
  onTransfer,
  onOpenAdmin,
  refreshing,
}) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [toast, setToast] = useState('');

  const { user, transactions, recipients, balance_history } = dashboard;
  const roleMeta = ROLE_BADGE[user.role] || ROLE_BADGE.user;
  const adminUnlocked = isAdminToken();

  const incomingSum = transactions
    .filter((t) => t.direction === 'incoming')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const outgoingSum = transactions
    .filter((t) => t.direction === 'outgoing')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const handleTransferSubmit = async (payload) => {
    await onTransfer(payload);
    setToast(`Перевод ${formatMoney(payload.amount)} ₽ для @${payload.to_username} выполнен`);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div className="min-h-screen neon-grid">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#060913]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center shadow-glow">
              <Shield className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                Bank<span className="text-cyan-400">Hack</span>
              </span>
              <span className="hidden sm:inline-block ml-2.5 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                NeoBank Lab
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-slate-200">@{user.username}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${roleMeta.cls}`}>
                {roleMeta.label}
              </span>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition"
              title="Обновить данные"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {adminUnlocked && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-400/30 text-xs font-medium text-rose-300 hover:bg-rose-500/20 hover:border-rose-400/60 transition"
                title="Консоль администратора"
              >
                <Terminal className="w-4 h-4" />
                <span className="hidden sm:inline">Админ-панель</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300 hover:text-rose-300 hover:border-rose-500/40 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {toast && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 px-4 py-3 text-sm text-emerald-200 shadow-emeraldGlow">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Карта и баланс */}
          <div className="lg:col-span-5 space-y-6">
            <div className="relative overflow-hidden rounded-3xl p-6 border border-cyan-400/25 bg-gradient-to-br from-[#0f1c38] via-[#0c1428] to-[#130f2b] shadow-glow">
              <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-cyan-400/15 blur-2xl" />
              <div className="absolute -left-10 -bottom-14 w-44 h-44 rounded-full bg-violet-500/15 blur-2xl" />

              <div className="relative flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-300">
                  <Cpu className="w-4 h-4" />
                  <span>BankHack Virtual</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${roleMeta.cls}`}>
                  {roleMeta.label}
                </span>
              </div>

              <div className="relative mb-6">
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Доступный баланс
                </div>
                <div className="text-4xl font-bold font-mono tracking-tight text-white">
                  {formatMoney(user.balance)}{' '}
                  <span className="text-cyan-400 text-2xl">₽</span>
                </div>
              </div>

              <div className="relative flex items-center justify-between pt-4 border-t border-white/10">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Владелец счёта
                  </div>
                  <div className="font-mono text-sm text-slate-100 mt-0.5">
                    @{user.username} · ID #{String(user.id).padStart(4, '0')}
                  </div>
                </div>
                <CreditCard className="w-7 h-7 text-cyan-300/80" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                  <span>Поступления</span>
                </div>
                <div className="font-mono text-lg font-semibold text-emerald-400">
                  +{formatMoney(incomingSum)} ₽
                </div>
              </div>

              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                  <span>Списания</span>
                </div>
                <div className="font-mono text-lg font-semibold text-slate-100">
                  -{formatMoney(outgoingSum)} ₽
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 hover:brightness-110 transition shadow-glow"
            >
              <Send className="w-4 h-4" />
              <span>Выполнить перевод</span>
            </button>

            {user.role === 'vip' && (
              <div className="glass-card rounded-2xl p-4 border border-amber-400/25 flex items-center gap-3">
                <Crown className="w-5 h-5 text-amber-300 shrink-0" />
                <p className="text-xs text-amber-200/90">
                  Статус <span className="font-semibold">VIP Private</span> активен: повышенные лимиты переводов.
                </p>
              </div>
            )}
          </div>

          {/* График баланса */}
          <div className="lg:col-span-7">
            <BalanceChart data={balance_history} />
          </div>
        </div>

        <TransactionsTable transactions={transactions} />
      </main>

      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        recipients={recipients}
        currentBalance={user.balance}
        onSubmitTransfer={handleTransferSubmit}
      />
    </div>
  );
}
