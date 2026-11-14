import React, { useState, useEffect } from 'react';
import { X, Send, ShieldCheck, AlertCircle } from 'lucide-react';

const PRESET_AMOUNTS = [10, 50, 100, 500];

export default function TransferModal({
  isOpen,
  onClose,
  recipients = [],
  currentBalance = 0,
  onSubmitTransfer,
}) {
  const [toUsername, setToUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setAmount('');
      setComment('');
      if (recipients.length > 0 && !toUsername) {
        setToUsername(recipients[0].username);
      }
    }
  }, [isOpen, recipients]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numericAmount = Number(amount);
    if (!toUsername.trim()) {
      setError('Укажите логин получателя');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Введите корректную положительную сумму');
      return;
    }

    setLoading(true);
    try {
      await onSubmitTransfer({
        to_username: toUsername.trim(),
        amount: numericAmount,
        comment: comment.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Не удалось выполнить перевод');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-cyan-500/30 shadow-glow relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Новый перевод</h2>
            <p className="text-xs text-slate-400">
              Доступно:{' '}
              <span className="font-mono text-emerald-400">
                {Number(currentBalance).toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                ₽
              </span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Получатель
            </label>
            <input
              type="text"
              value={toUsername}
              onChange={(e) => setToUsername(e.target.value)}
              placeholder="Логин получателя (например, vip_client)"
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
            />
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setToUsername(r.username)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition ${
                      toUsername === r.username
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    @{r.username}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Сумма перевода (₽)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 px-4 py-3 text-base font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
            />
            <div className="grid grid-cols-4 gap-2 mt-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200 transition"
                >
                  +{preset} ₽
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Комментарий
            </label>
            <input
              type="text"
              maxLength={255}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Назначение платежа (необязательно)"
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Защищённая транзакция</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 transition"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:brightness-110 disabled:opacity-50 transition shadow-emeraldGlow"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Отправка...' : 'Перевести'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
