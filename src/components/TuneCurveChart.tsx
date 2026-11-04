import React, { useState } from 'react';

/**
 * Tune VVC 위치(%) → 총 용량(pF): 학습된 실측 곡선 vs 정격 직선
 * - 단일 y축, 2px 선, 범례 + 직접 라벨, 마우스 위치 십자선/툴팁
 */

interface Props {
  curve: { pct: number; totalPf: number; ratedPf: number }[];
  count: number;
}

const C_FIT = '#2563EB';
const C_RATED = '#94A3B8';

export const TuneCurveChart: React.FC<Props> = ({ curve, count }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 460;
  const H = 210;
  const m = { l: 40, r: 14, t: 10, b: 30 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const yMax = Math.ceil(Math.max(...curve.map((p) => Math.max(p.totalPf, p.ratedPf))) / 200) * 200;
  const x = (pct: number) => m.l + (pct / 100) * iw;
  const y = (pf: number) => m.t + ih - (pf / yMax) * ih;
  const path = (k: 'totalPf' | 'ratedPf') => curve.map((p, i) => `${i ? 'L' : 'M'} ${x(p.pct)} ${y(p[k])}`).join(' ');

  // 1% 단위 선형 보간 값 (툴팁용)
  const at = (pct: number, k: 'totalPf' | 'ratedPf') => {
    for (let i = 1; i < curve.length; i++)
      if (pct <= curve[i].pct) {
        const a = curve[i - 1];
        const b = curve[i];
        return a[k] + ((b[k] - a[k]) * (pct - a.pct)) / (b.pct - a.pct || 1);
      }
    return curve[curve.length - 1][k];
  };

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(100, Math.round(((px - m.l) / iw) * 100))));
  };

  const yTicks = Array.from({ length: yMax / 200 + 1 }, (_, i) => i * 200);
  const last = curve[curve.length - 1];
  const hv = hover !== null ? { fit: at(hover, 'totalPf'), rated: at(hover, 'ratedPf') } : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="text-xs font-bold text-slate-900">Tune VVC 위치별 총 용량 (×{count}EA 합계)</div>
        <div className="flex items-center gap-3 text-[10.5px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-[2px]" style={{ background: C_FIT }} /> CTCL 학습 곡선
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: C_RATED }} /> 정격 직선
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label="Tune VVC 위치별 용량 곡선">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth={1} />
            <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#64748B">
              {t}
            </text>
          </g>
        ))}
        {[0, 20, 40, 60, 80, 100].map((t) => (
          <text key={t} x={x(t)} y={H - m.b + 14} textAnchor="middle" fontSize={10} fill="#64748B">
            {t}%
          </text>
        ))}
        <text x={W - m.r} y={H - 2} textAnchor="end" fontSize={9.5} fill="#64748B">
          y: 총 용량 (pF)
        </text>

        <path d={path('ratedPf')} fill="none" stroke={C_RATED} strokeWidth={2} strokeDasharray="5 4" />
        <path d={path('totalPf')} fill="none" stroke={C_FIT} strokeWidth={2} strokeLinejoin="round" />
        {curve.map((p) => (
          <circle key={p.pct} cx={x(p.pct)} cy={y(p.totalPf)} r={2.5} fill={C_FIT} stroke="#FFFFFF" strokeWidth={1} />
        ))}
        <text x={m.l + 8} y={m.t + 14} fontSize={10} fill="#334155">
          100% 지점 = 정격 최대 {last.totalPf} pF로 고정
        </text>

        {hover !== null && hv && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="#94A3B8" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(hv.fit)} r={4} fill={C_FIT} stroke="#FFFFFF" strokeWidth={2} />
            <g transform={`translate(${Math.min(x(hover) + 8, W - m.r - 128)}, ${m.t + 4})`}>
              <rect width={128} height={46} rx={6} fill="#FFFFFF" stroke="#CBD5E1" />
              <text x={8} y={15} fontSize={10.5} fontWeight={700} fill="#0F172A">
                Tune {hover}%
              </text>
              <text x={8} y={29} fontSize={10} fill="#334155">
                학습 {hv.fit.toFixed(0)} pF
              </text>
              <text x={8} y={41} fontSize={10} fill="#64748B">
                정격 {hv.rated.toFixed(0)} pF ({hv.fit - hv.rated >= 0 ? '+' : ''}
                {(hv.fit - hv.rated).toFixed(0)})
              </text>
            </g>
          </g>
        )}
        <rect
          x={m.l}
          y={m.t}
          width={iw}
          height={ih}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
    </div>
  );
};
