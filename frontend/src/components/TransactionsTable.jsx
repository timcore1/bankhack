import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, History } from 'lucide-react';

function formatDate(iso) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(value) {
  return Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TransactionsTable({ transactions = [] }) {
  const [filter, setFilter] = useState('all');

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.direction === filter;
  });

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">История транзакций</h3>
            <p className="text-xs text-slate-400">
              Всего операций: {transactions.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-950/70 p-1 border border-slate-800">
          {[
            { id: 'all', label: 'Все' },
            { id: 'incoming', label: 'Входящие' },
            { id: 'outgoing', label: 'Исходящие' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === tab.id
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-800 rounded-xl">
          Операции по выбранному фильтру отсутствуют
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-3 pr-4 font-medium">Тип / Контрагент</th>
                <th className="py-3 px-4 font-medium">Комментарий</th>
                <th className="py-3 px-4 font-medium">Дата</th>
                <th className="py-3 pl-4 font-medium text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {filtered.map((tx) => {
                const isIncoming = tx.direction === 'incoming';
                const counterparty = isIncoming ? tx.from_username : tx.to_username;
                return (
                  <tr key={tx.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                            isIncoming
                              ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                              : 'bg-rose-500/15 border-rose-400/30 text-rose-300'
                          }`}
                        >
                          {isIncoming ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {isIncoming ? 'Поступление от ' : 'Перевод '}
                            <span className="font-mono text-cyan-300">@{counterparty}</span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            TX #{String(tx.id).padStart(5, '0')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {tx.comment || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs font-mono whitespace-nowrap">
                      {formatDate(tx.created_at)}
                    </td>
                    <td
                      className={`py-3.5 pl-4 text-right font-mono font-semibold whitespace-nowrap ${
                        isIncoming ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {isIncoming ? '+' : '-'}
                      {formatAmount(tx.amount)} ₽
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
