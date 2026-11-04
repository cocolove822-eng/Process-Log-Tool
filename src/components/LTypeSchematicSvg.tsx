import React from 'react';
import { MatcherSolvedSpec, InstantaneousMatcherState } from '../utils/matcherSolver';

/**
 * L-Type RF 매처 회로도 (사내 기본 구성 도면과 같은 배치)
 *
 *  RFG ──●──[Tune VVC × n (병렬)]──[Series L]──▶ Chamber
 *        │
 *   [Load VVC ∥ Load VFC]
 *        │
 *    [Shunt L]
 *        │
 *       GND
 */

interface Props {
  spec: MatcherSolvedSpec;
  state: InstantaneousMatcherState;
  zR?: number;
  zX?: number;
}

const C_WIRE = '#334155';
const C_VAR = '#DC2626';
const C_CAP = '#2563EB';
const C_FIX = '#059669';
const C_IND = '#D97706';
const C_TEXT = '#0F172A';
const C_SUB = '#64748B';

const fmt = (v: number, unit: string, d = 0) => (Number.isFinite(v) ? `${v.toFixed(d)} ${unit}` : '-');

const Ground: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g stroke={C_WIRE} strokeWidth={1.8}>
    <line x1={x - 14} y1={y} x2={x + 14} y2={y} />
    <line x1={x - 9} y1={y + 5} x2={x + 9} y2={y + 5} />
    <line x1={x - 4} y1={y + 10} x2={x + 4} y2={y + 10} />
  </g>
);

/** 세로 커패시터 (판이 가로) — 위 단자 y, 아래 단자 y+30 */
const VCap: React.FC<{ x: number; y: number; color: string; variable?: boolean }> = ({ x, y, color, variable }) => (
  <g>
    <line x1={x} y1={y} x2={x} y2={y + 11} stroke={C_WIRE} strokeWidth={1.6} />
    <line x1={x - 13} y1={y + 11} x2={x + 13} y2={y + 11} stroke={color} strokeWidth={2.6} />
    <line x1={x - 13} y1={y + 19} x2={x + 13} y2={y + 19} stroke={color} strokeWidth={2.6} />
    <line x1={x} y1={y + 19} x2={x} y2={y + 30} stroke={C_WIRE} strokeWidth={1.6} />
    {variable && (
      <line x1={x - 16} y1={y + 27} x2={x + 15} y2={y + 2} stroke={C_VAR} strokeWidth={1.6} markerEnd="url(#ltype-arrow)" />
    )}
  </g>
);

/** 가로 커패시터 (판이 세로) — 왼쪽 단자 x, 오른쪽 단자 x+30 */
const HCap: React.FC<{ x: number; y: number; color: string; variable?: boolean }> = ({ x, y, color, variable }) => (
  <g>
    <line x1={x} y1={y} x2={x + 11} y2={y} stroke={C_WIRE} strokeWidth={1.6} />
    <line x1={x + 11} y1={y - 12} x2={x + 11} y2={y + 12} stroke={color} strokeWidth={2.6} />
    <line x1={x + 19} y1={y - 12} x2={x + 19} y2={y + 12} stroke={color} strokeWidth={2.6} />
    <line x1={x + 19} y1={y} x2={x + 30} y2={y} stroke={C_WIRE} strokeWidth={1.6} />
    {variable && (
      <line x1={x + 2} y1={y + 15} x2={x + 28} y2={y - 14} stroke={C_VAR} strokeWidth={1.6} markerEnd="url(#ltype-arrow)" />
    )}
  </g>
);

export const LTypeSchematicSvg: React.FC<Props> = ({ spec, state, zR, zX }) => {
  const tuneCount = Math.max(1, Math.min(3, spec.tuneVvcCount || 1));
  const loadCount = Math.max(1, spec.loadVvcCount || 1);
  const hasTuneVfc = Number.isFinite(spec.tuneVfcPf) && spec.tuneVfcPf > 5;
  const hasLoadVfc = Number.isFinite(spec.loadVfcPf) && spec.loadVfcPf > 5;
  const cOut = spec.precision?.cOutPf ?? spec.params?.cOutPf ?? 0;

  const railY = 80;
  const nodeX = 300;
  const vvcX = hasLoadVfc ? 265 : nodeX; // Load VVC 위치
  const vfcX = hasLoadVfc ? 335 : nodeX; // Load VFC 위치
  const tuneX0 = 510; // Tune 블록 시작
  const tuneX1 = 620; // Tune 블록 끝
  const tuneCx = (tuneX0 + tuneX1) / 2;
  const tuneRows = Array.from({ length: tuneCount }, (_, i) => railY + (i - (tuneCount - 1) / 2) * 46);

  // 수직 코일 (오른쪽으로 볼록)
  const coilV = (x: number, y: number, n: number) =>
    `M ${x} ${y} ` + Array.from({ length: n }, () => 'a 8 6 0 0 1 0 12').join(' ');
  // 수평 코일 (위로 볼록)
  const coilH = (x: number, y: number, n: number) =>
    `M ${x} ${y} ` + Array.from({ length: n }, () => 'a 7 9 0 0 1 16 0').join(' ');

  const vvcRange = (min: number, max: number, n: number) =>
    Number.isFinite(min) && Number.isFinite(max) ? `${min}~${max}pF × ${n}EA` : '정격 미확정';

  return (
    <svg viewBox="0 0 900 275" className="w-full min-w-[640px] h-auto select-none font-sans" role="img" aria-label="L-Type 매처 회로도">
      <defs>
        <marker id="ltype-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill={C_VAR} />
        </marker>
      </defs>

      {/* ── RF Generator ── */}
      <line x1={70} y1={railY} x2={70} y2={142} stroke={C_WIRE} strokeWidth={1.8} />
      <circle cx={70} cy={160} r={18} fill="#EFF6FF" stroke={C_CAP} strokeWidth={2} />
      <path d="M 59 160 q 5.5 -10 11 0 t 11 0" fill="none" stroke={C_CAP} strokeWidth={1.8} />
      <line x1={70} y1={178} x2={70} y2={245} stroke={C_WIRE} strokeWidth={1.8} />
      <Ground x={70} y={245} />
      <text x={96} y={158} fontSize={12} fontWeight={700} fill={C_TEXT}>RFG</text>
      <text x={96} y={173} fontSize={11} fill={C_SUB}>13.56 MHz</text>

      {/* ── 메인 레일 ── */}
      <line x1={70} y1={railY} x2={tuneX0} y2={railY} stroke={C_WIRE} strokeWidth={1.8} />
      <circle cx={nodeX} cy={railY} r={3.5} fill={C_TEXT} />

      {/* ── Shunt 브랜치: Load VVC ∥ Load VFC → Shunt L → GND ── */}
      <line x1={nodeX} y1={railY} x2={nodeX} y2={105} stroke={C_WIRE} strokeWidth={1.6} />
      <line x1={vvcX} y1={105} x2={vfcX} y2={105} stroke={C_WIRE} strokeWidth={1.6} />
      <VCap x={vvcX} y={105} color={C_CAP} variable />
      {hasLoadVfc && <VCap x={vfcX} y={105} color={C_FIX} />}
      <line x1={vvcX} y1={135} x2={vfcX} y2={135} stroke={C_WIRE} strokeWidth={1.6} />
      <line x1={nodeX} y1={135} x2={nodeX} y2={165} stroke={C_WIRE} strokeWidth={1.6} />
      <path d={coilV(nodeX, 165, 4)} fill="none" stroke={C_IND} strokeWidth={2.2} />
      <line x1={nodeX} y1={213} x2={nodeX} y2={245} stroke={C_WIRE} strokeWidth={1.6} />
      <Ground x={nodeX} y={245} />

      {/* Load VVC 라벨 (왼쪽) */}
      <text x={vvcX - 24} y={110} textAnchor="end" fontSize={12} fontWeight={700} fill={C_VAR}>Load VVC</text>
      <text x={vvcX - 24} y={125} textAnchor="end" fontSize={11} fill={C_TEXT}>{vvcRange(spec.loadVvcMinPf, spec.loadVvcMaxPf, loadCount)}</text>
      <text x={vvcX - 24} y={140} textAnchor="end" fontSize={11} fill={C_CAP} fontFamily="monospace">
        현재 {fmt(state.currentLoadVvcPf, 'pF')}
      </text>

      {/* Load VFC 라벨 (오른쪽) */}
      {hasLoadVfc && (
        <>
          <text x={vfcX + 22} y={110} fontSize={12} fontWeight={700} fill={C_FIX}>Load VFC 합계</text>
          <text x={vfcX + 22} y={125} fontSize={11} fill={C_TEXT} fontFamily="monospace">≈ {fmt(spec.loadVfcPf, 'pF')}</text>
          <text x={vfcX + 22} y={140} fontSize={10} fill={C_SUB}>VFC + 기생 용량</text>
        </>
      )}

      {/* Shunt L 라벨 */}
      <text x={nodeX + 22} y={185} fontSize={12} fontWeight={700} fill={C_IND}>Shunt Inductor</text>
      <text x={nodeX + 22} y={200} fontSize={11} fill={C_TEXT} fontFamily="monospace">
        {fmt(spec.shuntInductorNh, 'nH', 1)}
        {spec.uncertainty?.lShuntNh !== undefined ? ` ±${spec.uncertainty.lShuntNh.toFixed(1)}` : ''}
      </text>
      <text x={nodeX + 22} y={215} fontSize={10} fill={C_SUB} fontFamily="monospace">
        합성 CL {fmt(state.currentLoadTotalPf, 'pF')}
      </text>

      {/* ── Series 브랜치: Tune VVC × n (병렬) ── */}
      {tuneCount > 1 && (
        <>
          <line x1={tuneX0} y1={tuneRows[0]} x2={tuneX0} y2={tuneRows[tuneCount - 1]} stroke={C_WIRE} strokeWidth={1.6} />
          <line x1={tuneX1} y1={tuneRows[0]} x2={tuneX1} y2={tuneRows[tuneCount - 1]} stroke={C_WIRE} strokeWidth={1.6} />
          <circle cx={tuneX0} cy={railY} r={3} fill={C_TEXT} />
          <circle cx={tuneX1} cy={railY} r={3} fill={C_TEXT} />
        </>
      )}
      {tuneRows.map((y) => (
        <g key={y}>
          <line x1={tuneX0} y1={y} x2={tuneCx - 15} y2={y} stroke={C_WIRE} strokeWidth={1.6} />
          <HCap x={tuneCx - 15} y={y} color={C_CAP} variable />
          <line x1={tuneCx + 15} y1={y} x2={tuneX1} y2={y} stroke={C_WIRE} strokeWidth={1.6} />
        </g>
      ))}
      <text x={tuneCx} y={tuneRows[0] - 34} textAnchor="middle" fontSize={12} fontWeight={700} fill={C_VAR}>Tune VVC</text>
      <text x={tuneCx} y={tuneRows[0] - 20} textAnchor="middle" fontSize={11} fill={C_TEXT}>
        {vvcRange(spec.tuneVvcMinPf, spec.tuneVvcMaxPf, tuneCount)}
      </text>
      <text x={tuneCx} y={tuneRows[tuneCount - 1] + 32} textAnchor="middle" fontSize={11} fill={C_CAP} fontFamily="monospace">
        현재 {Number.isFinite(state.currentTuneVvcPf) ? `${state.currentTuneVvcPf}pF × ${tuneCount}` : '-'} = {fmt(state.currentTuneTotalPf, 'pF')}
      </text>
      {hasTuneVfc && (
        <text x={tuneCx} y={tuneRows[tuneCount - 1] + 47} textAnchor="middle" fontSize={10} fill={C_FIX} fontFamily="monospace">
          + Tune VFC ≈ {fmt(spec.tuneVfcPf, 'pF')}
        </text>
      )}

      {/* ── Series Inductor ── */}
      <line x1={tuneX1} y1={railY} x2={650} y2={railY} stroke={C_WIRE} strokeWidth={1.8} />
      <path d={coilH(650, railY, 4)} fill="none" stroke={C_IND} strokeWidth={2.2} />
      <line x1={714} y1={railY} x2={750} y2={railY} stroke={C_WIRE} strokeWidth={1.8} />
      <text x={682} y={railY - 26} textAnchor="middle" fontSize={12} fontWeight={700} fill={C_IND}>Series Inductor</text>
      <text x={682} y={railY + 22} textAnchor="middle" fontSize={11} fill={C_TEXT} fontFamily="monospace">
        {fmt(spec.seriesInductorNh, 'nH', 1)}
        {spec.uncertainty?.lSeriesNh !== undefined ? ` ±${spec.uncertainty.lSeriesNh.toFixed(1)}` : ''}
      </text>

      {/* ── 출력단 기생 용량 (정밀 보정 모드) ── */}
      {cOut > 0.05 && (
        <g>
          <circle cx={732} cy={railY} r={3} fill={C_TEXT} />
          <line x1={732} y1={railY} x2={732} y2={105} stroke={C_WIRE} strokeWidth={1.4} strokeDasharray="3 2" />
          <VCap x={732} y={105} color="#7C3AED" />
          <line x1={732} y1={135} x2={732} y2={160} stroke={C_WIRE} strokeWidth={1.4} strokeDasharray="3 2" />
          <Ground x={732} y={160} />
          <text x={752} y={122} fontSize={12} fontWeight={700} fill="#6D28D9">출력 기생 C</text>
          <text x={752} y={137} fontSize={11} fill={C_TEXT} fontFamily="monospace">{cOut.toFixed(1)} pF</text>
        </g>
      )}

      {/* ── Output (Chamber) ── */}
      <path d={`M 750 ${railY - 9} l 9 9 l -9 9 M 760 ${railY - 9} l 9 9 l -9 9`} fill="none" stroke="#7C3AED" strokeWidth={2} />
      <rect x={776} y={railY - 26} width={118} height={52} rx={8} fill="#F5F3FF" stroke="#C4B5FD" strokeWidth={1.4} />
      <text x={835} y={railY - 7} textAnchor="middle" fontSize={12} fontWeight={700} fill="#5B21B6">Chamber</text>
      <text x={835} y={railY + 12} textAnchor="middle" fontSize={11} fill="#4C1D95" fontFamily="monospace">
        {Number.isFinite(zR) && Number.isFinite(zX) ? `${zR!.toFixed(2)} ${zX! >= 0 ? '+' : '−'} j${Math.abs(zX!).toFixed(2)} Ω` : '-'}
      </text>
    </svg>
  );
};
