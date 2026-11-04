import React from 'react';
import { Cpu, Activity, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { ComplexNumber } from '../types/pecvd';
import { MatcherSolvedSpec, InstantaneousMatcherState } from '../utils/matcherSolver';

interface MatcherSchematicPanelProps {
  spec: MatcherSolvedSpec;
  state: InstantaneousMatcherState;
  interpolatedZ: ComplexNumber | null;
  isSolving?: boolean;
  onReRunSolver?: () => void;
}

export const MatcherSchematicPanel: React.FC<MatcherSchematicPanelProps> = ({
  spec,
  state,
  interpolatedZ,
  isSolving = false,
  onReRunSolver,
}) => {
  const zR = interpolatedZ?.r ?? state.calcZ?.r;
  const zX = interpolatedZ?.x ?? state.calcZ?.x;

  return (
    <div className="h-full flex flex-col justify-between bg-white border border-slate-300 rounded-xl p-2.5 shadow-xs transition-colors space-y-2">
      {/* 1. Header with Model Info, Execution Action & Convergence Badge */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-200">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Cpu className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>L-Type RF Matcher 회로 구조 및 소자 용량 역추적</span>
              <span className="px-1 py-0.2 rounded bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-200">
                13.56 MHz
              </span>
            </h3>
            <p className="text-[9.5px] text-slate-500">
              {spec.matcherModelName} ({spec.samplePointsUsed ? spec.samplePointsUsed.toLocaleString() : 0}개 격자 피팅)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          {onReRunSolver && (
            <button
              type="button"
              onClick={onReRunSolver}
              disabled={isSolving}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 text-[10px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="CTCL Matrix 격자 데이터를 바탕으로 Levenberg-Marquardt 물리 모델 피팅을 재실행합니다 (약 2~4초 소요)"
            >
              <RefreshCw className={`w-3 h-3 ${isSolving ? 'animate-spin text-blue-600' : 'text-blue-600'}`} />
              <span>{isSolving ? '역산 계산 중...' : '역산 실행'}</span>
            </button>
          )}

          {spec.solved ? (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border text-[9.5px] ${
                spec.fitConfidence >= 98
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>R² {spec.fitConfidence}% (RMSE {isNaN(spec.rmse) ? '-' : spec.rmse}Ω)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-300 text-[9.5px]">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>{isSolving ? 'LM 피팅 진행 중...' : '역산 미수행'}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Reliability & Diagnostics Section (message, uncertainty, degeneratePairs) */}
      <div className="bg-[#F8FAFC] border border-slate-300 rounded-lg p-2 text-[10px] space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-slate-200">
          {/* A. message: 수렴 상태 및 경고 진단 */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
            <span className="font-bold text-slate-700">수렴 상태 (message):</span>
            {spec.message === '정상 수렴' ? (
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px] flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                <span>정상 수렴 ({spec.convention?.toUpperCase()} 기준)</span>
              </span>
            ) : (
              <span
                className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[9px] truncate max-w-[350px]"
                title={spec.message}
              >
                ⚠️ {spec.message}
              </span>
            )}
          </div>

          {/* B. degeneratePairs: 식별 불가 강상관 쌍 (|corr| > 0.98) */}
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-700">식별 불가 쌍:</span>
            {spec.degeneratePairs && spec.degeneratePairs.length > 0 ? (
              <span
                className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold text-[9px] border border-rose-200"
                title="CTCL 데이터만으로는 분리가 불가능하므로 회로도/BOM 값으로 하나를 고정해야 합니다."
              >
                ⚠️ {spec.degeneratePairs.join(', ')}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold text-[9px] border border-emerald-200">
                없음 (독립 분리 완료)
              </span>
            )}
          </div>
        </div>

        {/* C. uncertainty: 1σ 파라미터 불확도 요약 */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[9px] text-slate-600 font-mono pt-0.5">
          <span className="font-sans font-bold text-slate-700">1σ 불확도 (자연 단위):</span>
          <span>
            Shunt L: <strong>±{spec.uncertainty?.lShuntNh !== undefined ? spec.uncertainty.lShuntNh.toFixed(1) : '-'} nH</strong>
          </span>
          <span>
            Series L: <strong>±{spec.uncertainty?.lSeriesNh !== undefined ? spec.uncertainty.lSeriesNh.toFixed(1) : '-'} nH</strong>
          </span>
          <span>
            CL 오프셋: <strong>±{spec.uncertainty?.cLoad0Pf !== undefined ? spec.uncertainty.cLoad0Pf.toFixed(0) : '-'} pF</strong>
          </span>
          <span>
            CT 오프셋: <strong>±{spec.uncertainty?.cTune0Pf !== undefined ? spec.uncertainty.cTune0Pf.toFixed(0) : '-'} pF</strong>
          </span>
          <span>
            R_loss: <strong>{spec.params?.rLossOhm !== undefined ? spec.params.rLossOhm.toFixed(3) : '0.000'} ± {spec.uncertainty?.rLossOhm !== undefined ? spec.uncertainty.rLossOhm.toFixed(3) : '-'} Ω</strong>
          </span>
        </div>
      </div>

      {/* 3. SVG Circuit Diagram (Full Width - Expands vertically to match simulator height) */}
      <div className="flex-1 w-full bg-[#F1F5F9] border border-slate-300 rounded-lg p-2.5 flex flex-col justify-between min-h-0">
        <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-700 mb-1">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>RF Matcher 등가 회로도 (실시간 소자값 연동)</span>
          </span>
          <span className="text-[9.5px] font-mono text-slate-500">
            Load: {state.loadPercent.toFixed(1)}% | Tune: {state.tunePercent.toFixed(1)}%
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center w-full overflow-x-auto py-1 min-h-0">
          <svg
            viewBox="0 14 540 186"
            className="w-full min-w-[480px] max-h-[195px] h-full select-none font-sans"
          >
            <defs>
              {/* Arrow markers */}
              <marker
                id="vvc-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#DC2626" />
              </marker>
              <marker
                id="vvc-arrow-blue"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#2563EB" />
              </marker>
            </defs>

            {/* 1. RF Generator Source */}
            <circle cx="36" cy="46" r="16" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.8" />
            <path
              d="M 28 46 Q 32 40 36 46 T 44 46"
              fill="none"
              stroke="#2563EB"
              strokeWidth="1.8"
            />
            <text x="36" y="73" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1E40AF">
              RF Gen (50Ω)
            </text>
            <text x="36" y="83" textAnchor="middle" fontSize="8" fill="#64748B">
              13.56 MHz
            </text>

            {/* RF Gen Ground */}
            <line x1="36" y1="62" x2="36" y2="76" stroke="#94A3B8" strokeWidth="1.2" />
            <line x1="28" y1="76" x2="44" y2="76" stroke="#64748B" strokeWidth="1.5" />
            <line x1="31" y1="79" x2="41" y2="79" stroke="#64748B" strokeWidth="1.2" />
            <line x1="34" y1="82" x2="38" y2="82" stroke="#64748B" strokeWidth="1.0" />

            {/* Main Line from Source to Node A */}
            <line x1="52" y1="46" x2="130" y2="46" stroke="#0F172A" strokeWidth="1.8" />

            {/* Node A: Shunt tap */}
            <circle cx="130" cy="46" r="3" fill="#0F172A" />

            {/* ================= Shunt Branch (Load side) ================= */}
            <line x1="130" y1="46" x2="130" y2="70" stroke="#0F172A" strokeWidth="1.8" />
            <line x1="95" y1="70" x2="165" y2="70" stroke="#0F172A" strokeWidth="1.5" />
            <line x1="95" y1="70" x2="95" y2="80" stroke="#0F172A" strokeWidth="1.5" />
            <line x1="165" y1="70" x2="165" y2="80" stroke="#0F172A" strokeWidth="1.5" />

            {/* Load VVC (Left branch of shunt) */}
            <line x1="83" y1="80" x2="107" y2="80" stroke="#2563EB" strokeWidth="2.0" />
            <line x1="83" y1="86" x2="107" y2="86" stroke="#2563EB" strokeWidth="2.0" />
            {/* Variable Arrow */}
            <line
              x1="79"
              y1="93"
              x2="111"
              y2="73"
              stroke="#DC2626"
              strokeWidth="1.6"
              markerEnd="url(#vvc-arrow)"
            />
            <text x="95" y="103" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#DC2626">
              Load VVC
            </text>
            <text x="95" y="112" textAnchor="middle" fontSize="7.5" fontFamily="monospace" fill="#1E40AF">
              {!isNaN(state.currentLoadVvcPf) ? `${state.currentLoadVvcPf} pF` : '-'}
            </text>
            <line x1="95" y1="86" x2="95" y2="120" stroke="#0F172A" strokeWidth="1.5" />

            {/* Load VFC (Right branch of shunt) */}
            <line x1="150" y1="80" x2="162" y2="80" stroke="#059669" strokeWidth="1.8" />
            <line x1="150" y1="86" x2="162" y2="86" stroke="#059669" strokeWidth="1.8" />
            <line x1="168" y1="80" x2="180" y2="80" stroke="#059669" strokeWidth="1.8" />
            <line x1="168" y1="86" x2="180" y2="86" stroke="#059669" strokeWidth="1.8" />
            <text x="165" y="103" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#059669">
              Load VFC
            </text>
            <text x="165" y="112" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#065F46">
              {spec.loadVfcDesc || '-'}
            </text>
            <line x1="165" y1="86" x2="165" y2="120" stroke="#0F172A" strokeWidth="1.5" />

            {/* Merge shunt branches */}
            <line x1="95" y1="120" x2="165" y2="120" stroke="#0F172A" strokeWidth="1.5" />
            <circle cx="130" cy="120" r="2.5" fill="#0F172A" />
            <line x1="130" y1="120" x2="130" y2="132" stroke="#0F172A" strokeWidth="1.8" />

            {/* Shunt Inductor Coil */}
            <path
              d="M 130 132 
                 C 140 132, 140 139, 130 139 
                 C 140 139, 140 146, 130 146 
                 C 140 146, 140 153, 130 153 
                 C 140 153, 140 160, 130 160"
              fill="none"
              stroke="#D97706"
              strokeWidth="2.2"
            />
            <text x="168" y="142" fontSize="7.5" fontWeight="bold" fill="#D97706">
              Shunt Inductor
            </text>
            <text x="168" y="152" fontSize="7.5" fontFamily="monospace" fill="#92400E">
              {!isNaN(spec.shuntInductorNh) ? `${spec.shuntInductorNh} nH` : '-'}
            </text>

            {/* Shunt Ground */}
            <line x1="130" y1="160" x2="130" y2="167" stroke="#0F172A" strokeWidth="1.8" />
            <line x1="118" y1="167" x2="142" y2="167" stroke="#475569" strokeWidth="2.0" />
            <line x1="122" y1="170" x2="138" y2="170" stroke="#475569" strokeWidth="1.5" />
            <line x1="126" y1="173" x2="134" y2="173" stroke="#475569" strokeWidth="1.2" />

            {/* Shunt Total Label Badge */}
            <rect x="95" y="176" width="70" height="15" rx="4" fill="#E2E8F0" />
            <text x="130" y="187" textAnchor="middle" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#334155">
              합성 CL: {!isNaN(state.currentLoadTotalPf) ? `${state.currentLoadTotalPf} pF` : '-'}
            </text>

            {/* ================= Series Branch (Tune side) ================= */}
            <line x1="130" y1="46" x2="200" y2="46" stroke="#0F172A" strokeWidth="1.8" />
            <circle cx="200" cy="46" r="2.5" fill="#0F172A" />

            {/* Tune Parallel Branch splitting */}
            <line x1="200" y1="46" x2="200" y2="30" stroke="#0F172A" strokeWidth="1.5" />
            <line x1="200" y1="46" x2="200" y2="62" stroke="#0F172A" strokeWidth="1.5" />
            <line x1="200" y1="30" x2="230" y2="30" stroke="#0F172A" strokeWidth="1.5" />
            <line x1="200" y1="62" x2="230" y2="62" stroke="#0F172A" strokeWidth="1.5" />

            {/* Upper Tune Branch: Tune VVC */}
            <line x1="230" y1="23" x2="230" y2="37" stroke="#DC2626" strokeWidth="2.0" />
            <line x1="236" y1="23" x2="236" y2="37" stroke="#DC2626" strokeWidth="2.0" />
            {/* Variable Arrow for Tune VVC */}
            <line
              x1="223"
              y1="40"
              x2="243"
              y2="20"
              stroke="#2563EB"
              strokeWidth="1.6"
              markerEnd="url(#vvc-arrow-blue)"
            />
            <line x1="236" y1="30" x2="266" y2="30" stroke="#0F172A" strokeWidth="1.5" />
            <text x="233" y="19" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#DC2626">
              Tune VVC: {!isNaN(spec.tuneVvcMinPf) ? `${spec.tuneVvcMinPf}~${spec.tuneVvcMaxPf}pF × ${spec.tuneVvcCount}EA` : '50~500pF × 2EA'}
            </text>

            {/* Lower Tune Branch: Fixed Parallel Capacitor / VFC */}
            <line x1="230" y1="55" x2="230" y2="69" stroke="#059669" strokeWidth="2.0" />
            <line x1="236" y1="55" x2="236" y2="69" stroke="#059669" strokeWidth="2.0" />
            <line x1="236" y1="62" x2="266" y2="62" stroke="#0F172A" strokeWidth="1.5" />
            <text x="248" y="74" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#059669">
              Tune VFC
            </text>
            <text x="248" y="83" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#065F46">
              {spec.tuneVfcDesc || '0 pF'}
            </text>

            {/* Rejoin Tune Parallel Branch */}
            <line x1="266" y1="30" x2="266" y2="62" stroke="#0F172A" strokeWidth="1.5" />
            <circle cx="266" cy="46" r="2.5" fill="#0F172A" />
            <line x1="266" y1="46" x2="295" y2="46" stroke="#0F172A" strokeWidth="1.8" />

            {/* Tune Total Tag */}
            <rect x="235" y="87" width="80" height="14" rx="3" fill="#EFF6FF" stroke="#BFDBFE" />
            <text x="275" y="97.5" textAnchor="middle" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#1E40AF">
              합성 CT: {!isNaN(state.currentTuneTotalPf) ? `${state.currentTuneTotalPf} pF` : '-'}
            </text>

            {/* Series Inductor Coil */}
            <line x1="295" y1="46" x2="315" y2="46" stroke="#0F172A" strokeWidth="1.8" />
            <path
              d="M 315 46 
                 C 315 36, 323 36, 323 46 
                 C 323 36, 331 36, 331 46 
                 C 331 36, 339 36, 339 46 
                 C 339 36, 347 36, 347 46 
                 C 347 36, 355 36, 355 46"
              fill="none"
              stroke="#D97706"
              strokeWidth="2.2"
            />
            <line x1="355" y1="46" x2="400" y2="46" stroke="#0F172A" strokeWidth="1.8" />
            <text x="335" y="24" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#D97706">
              Series Inductor
            </text>
            <text x="335" y="34" textAnchor="middle" fontSize="7.5" fill="#92400E">
              {!isNaN(spec.seriesInductorNh) ? `${spec.seriesInductorNh} nH` : '-'}
            </text>

            {/* Output Chamber Terminal >> */}
            <path
              d="M 400 40 L 412 46 L 400 52 M 408 40 L 420 46 L 408 52"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="424" y="28" width="106" height="36" rx="6" fill="#F5F3FF" stroke="#C4B5FD" />
            <text x="477" y="42" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#6D28D9">
              Chamber Load
            </text>
            <text x="477" y="55" textAnchor="middle" fontSize="8" fontFamily="monospace" fontWeight="bold" fill="#4C1D95">
              {!isNaN(zR) && !isNaN(zX) ? `${zR.toFixed(2)} + (${zX.toFixed(2)})i Ω` : '-'}
            </text>
          </svg>
        </div>
      </div>

      {/* 4. Structured Component Specifications Table with 1σ Uncertainty Details */}
      <div className="border border-slate-300 rounded-lg overflow-hidden text-[10.5px]">
        <div className="bg-slate-200/80 px-2.5 py-1 border-b border-slate-300 font-bold text-slate-800 flex items-center justify-between text-[10px]">
          <span>매쳐 정격 구성 소자 역산출 명세표 (LM 물리 모델 역추적)</span>
          <span className="font-normal text-slate-500">
            * 괄호 안(±)은 1σ 피팅 불확도 / 비선형 최소제곱 오차 범위
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-200 bg-slate-50/60">
          {/* Col 1: Load VVC */}
          <div className="p-1.5 px-2 space-y-0.5">
            <div className="text-[9.5px] font-bold text-red-600 flex items-center justify-between">
              <span>Load VVC</span>
              <span className="text-[8.5px] px-1 rounded bg-red-100 text-red-700 font-normal">가변</span>
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-900">
              {!isNaN(spec.loadVvcMinPf) ? `${spec.loadVvcMinPf} ~ ${spec.loadVvcMaxPf} pF` : '-'}
            </div>
            <div className="text-[9.5px] text-slate-500 leading-tight">
              수량: <strong className="text-slate-700">{spec.loadVvcCount || 1} EA</strong>
              <span className="block text-slate-600">
                CL0 불확도: <strong>±{spec.uncertainty?.cLoad0Pf !== undefined ? spec.uncertainty.cLoad0Pf.toFixed(0) : '-'} pF</strong>
              </span>
              <span className="block text-blue-700 font-bold">
                현재: {!isNaN(state.currentLoadVvcPf) ? `${state.currentLoadVvcPf} pF` : '-'}
              </span>
            </div>
          </div>

          {/* Col 2: Load VFC & Shunt L */}
          <div className="p-1.5 px-2 space-y-0.5">
            <div className="text-[9.5px] font-bold text-emerald-600 flex items-center justify-between">
              <span>Load VFC / Shunt L</span>
              <span className="text-[8.5px] px-1 rounded bg-emerald-100 text-emerald-700 font-normal">병렬/직렬</span>
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-900 truncate">
              VFC: {spec.loadVfcDesc || '-'}
            </div>
            <div className="text-[9.5px] text-slate-500 leading-tight">
              Shunt L: <strong className="text-amber-700 font-bold">{!isNaN(spec.shuntInductorNh) ? `${spec.shuntInductorNh} nH` : '-'}</strong>{' '}
              <span className="text-slate-600 text-[9px]">
                (±{spec.uncertainty?.lShuntNh !== undefined ? spec.uncertainty.lShuntNh.toFixed(1) : '-'})
              </span>
              <span className="block text-slate-700">
                합성 CL: {!isNaN(spec.loadTotalMinPf) ? `${spec.loadTotalMinPf} ~ ${spec.loadTotalMaxPf} pF` : '-'}
              </span>
            </div>
          </div>

          {/* Col 3: Tune VVC */}
          <div className="p-1.5 px-2 space-y-0.5">
            <div className="text-[9.5px] font-bold text-red-600 flex items-center justify-between">
              <span>Tune VVC</span>
              <span className="text-[8.5px] px-1 rounded bg-red-100 text-red-700 font-normal">가변</span>
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-900">
              {!isNaN(spec.tuneVvcMinPf) ? `${spec.tuneVvcMinPf} ~ ${spec.tuneVvcMaxPf} pF` : '-'}
            </div>
            <div className="text-[9.5px] text-slate-500 leading-tight">
              수량: <strong className="text-slate-700">{spec.tuneVvcCount || 1} EA ({spec.tuneVvcCount > 1 ? '병렬' : '단품'})</strong>
              <span className="block text-slate-600">
                CT0 불확도: <strong>±{spec.uncertainty?.cTune0Pf !== undefined ? spec.uncertainty.cTune0Pf.toFixed(0) : '-'} pF</strong>
              </span>
              <span className="block text-blue-700 font-bold">
                현재: {!isNaN(state.currentTuneVvcPf) ? `${state.currentTuneVvcPf * (spec.tuneVvcCount || 1)} pF` : '-'}
              </span>
            </div>
          </div>

          {/* Col 4: Series Inductor & Tune VFC */}
          <div className="p-1.5 px-2 space-y-0.5">
            <div className="text-[9.5px] font-bold text-amber-700 flex items-center justify-between">
              <span>Series Inductor</span>
              <span className="text-[8.5px] px-1 rounded bg-amber-100 text-amber-800 font-normal">직렬</span>
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-900">
              L_series: {!isNaN(spec.seriesInductorNh) ? `${spec.seriesInductorNh} nH` : '-'}{' '}
              <span className="text-slate-600 text-[9px] font-normal">
                (±{spec.uncertainty?.lSeriesNh !== undefined ? spec.uncertainty.lSeriesNh.toFixed(1) : '-'})
              </span>
            </div>
            <div className="text-[9.5px] text-slate-500 leading-tight">
              Tune VFC: <span className="text-slate-600">{spec.tuneVfcDesc || '-'}</span>
              <span className="block text-slate-700">
                합성 CT: {!isNaN(spec.tuneTotalMinPf) ? `${spec.tuneTotalMinPf} ~ ${spec.tuneTotalMaxPf} pF` : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
