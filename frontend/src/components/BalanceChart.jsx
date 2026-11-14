import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function BalanceChart({ data = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const safeData =
    data.length >= 2
      ? data
      : [
          { label: 'Старт', balance: data[0]?.balance ?? 0 },
          { label: 'Сейчас', balance: data[0]?.balance ?? 0 },
        ];

  const width = 640;
  const height = 220;
  const padX = 28;
  const padY = 26;

  const values = safeData.map((d) => Number(d.balance));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || Math.max(maxVal * 0.2, 100);
  const lowBound = Math.max(0, minVal - range * 0.15);
  const highBound = maxVal + range * 0.15;
  const span = highBound - lowBound || 1;

  const points = safeData.map((item, index) => {
    const x =
      padX + (index / Math.max(safeData.length - 1, 1)) * (width - padX * 2);
    const y =
      height -
      padY -
      ((Number(item.balance) - lowBound) / span) * (height - padY * 2);
    return { x, y, ...item };
  });

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
    height - padY
  ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - padY).toFixed(1)} Z`;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="glass-card rounded-2xl p-6 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-400 font-semibold">
            <TrendingUp className="w-4 h-4" />
            <span>Динамика баланса</span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-1">
            Аналитика счёта в реальном времени
          </h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">{activePoint.label}</div>
          <div className="font-mono text-lg font-bold text-cyan-300">
            {formatMoney(activePoint.balance)} ₽
          </div>
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 overflow-visible"
          role="img"
          aria-label="График баланса"
        >
          <defs>
            <linearGradient id="bankhackArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.38" />
              <stop offset="65%" stopColor="#8b5cf6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#060913" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="bankhackLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = padY + step * (height - padY * 2);
            return (
              <line
                key={step}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="rgba(148,163,184,0.12)"
                strokeDasharray="4 4"
              />
            );
          })}

          <path d={areaPath} fill="url(#bankhackArea)" />
          <path
            d={linePath}
            fill="none"
            stroke="url(#bankhackLine)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={`${pt.label}-${idx}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 7 : 4.5}
                  fill={isHovered ? '#22d3ee' : '#0d1324'}
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>

        <div className="flex justify-between text-[11px] font-mono text-slate-400 px-3 mt-1">
          <span>{points[0]?.label}</span>
          {points.length > 2 && (
            <span>{points[Math.floor(points.length / 2)]?.label}</span>
          )}
          <span className="text-cyan-300">{points[points.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}
