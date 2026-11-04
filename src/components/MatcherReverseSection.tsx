import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, Info } from 'lucide-react';
import { CTCLMatrixData } from '../types/pecvd';
import { interpolateCTCL } from '../utils/ctclParser';
import {
  MatcherSolvedSpec,
  SolverOptions,
  STANDARD_VVC_PROFILES,
  VvcTable,
  getInstantaneousMatcherState,
  getUnsolvedSpec,
} from '../utils/matcherSolver';
import { MatcherSchematicPanel } from './MatcherSchematicPanel';
import { PrecisionOptions } from '../utils/matcherPrecisionFit';
import { TuneCurveChart } from './TuneCurveChart';

/**
 * CTCL Matrix → L-Type 매처 회로 역추적 섹션 (CTCL 탭 상단)
 *
 * CTCL만으로는 "VVC 용량 곡선 형상"과 "인덕터 값"이 서로 맞바뀔 수 있어(식별 불가),
 * 장착된 VVC 정격(BOM/모델명으로 알 수 있는 값)을 힌트로 주면
 * 인덕터와 고정 VFC(+기생 용량)만 피팅하여 신뢰할 수 있는 값을 얻는다.
 */

const AUTO = 'auto';

/** 사내 기본 L-Type 매처 구성 (NSM-30AXR-XXD, 현장변경 24/4/22) */
const REFERENCE_CIRCUIT = {
  name: 'NSM-30AXR-XXD',
  loadVvcLabel: '100~1000pF × 1EA',
  tuneVvcLabel: '50~500pF × 2EA',
  shuntNh: 70,
  seriesNh: 180,
  loadVfcPf: 420, // 210pF × 2EA
  loadVfcDesc: '210pF × 2EA',
  tuneVfcPf: 0,
};

function profileToTable(label: string): VvcTable | undefined {
  const p = STANDARD_VVC_PROFILES.find((v) => v.label === label);
  if (!p) return undefined;
  return {
    points: [
      { pct: 0, pf: p.min },
      { pct: 100, pf: p.max },
    ],
    count: p.count,
    label: p.label,
  };
}

interface Props {
  ctclMatrix: CTCLMatrixData;
  testLoad: number;
  testTune: number;
}

export const MatcherReverseSection: React.FC<Props> = ({ ctclMatrix, testLoad, testTune }) => {
  const [loadHint, setLoadHint] = useState<string>(REFERENCE_CIRCUIT.loadVvcLabel);
  const [tuneHint, setTuneHint] = useState<string>(REFERENCE_CIRCUIT.tuneVvcLabel);
  const [spec, setSpec] = useState<MatcherSolvedSpec>(() => getUnsolvedSpec('역산 대기 중'));
  const [isSolving, setIsSolving] = useState(false);
  const [runNonce, setRunNonce] = useState(0);
  const [precisionOn, setPrecisionOn] = useState(true);
  const [loadVfcInput, setLoadVfcInput] = useState<string>('');
  const workerRef = useRef<Worker | null>(null);

  const options: SolverOptions = useMemo(() => {
    const o: SolverOptions = { vvcCurve: 'linear' };
    const lt = loadHint === AUTO ? undefined : profileToTable(loadHint);
    const tt = tuneHint === AUTO ? undefined : profileToTable(tuneHint);
    if (lt) o.loadVvcTable = lt;
    if (tt) o.tuneVvcTable = tt;
    return o;
  }, [loadHint, tuneHint]);

  const precision: PrecisionOptions | undefined = useMemo(() => {
    if (!precisionOn || loadHint === AUTO || tuneHint === AUTO) return undefined;
    const lp = STANDARD_VVC_PROFILES.find((p) => p.label === loadHint);
    const tp = STANDARD_VVC_PROFILES.find((p) => p.label === tuneHint);
    if (!lp || !tp) return undefined;
    const vfc = parseFloat(loadVfcInput);
    return { loadProfile: lp, tuneProfile: tp, knownLoadVfcPf: Number.isFinite(vfc) && vfc >= 0 ? vfc : undefined };
  }, [precisionOn, loadHint, tuneHint, loadVfcInput]);

  useEffect(() => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL('../workers/matcherSolverWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setIsSolving(true);
    worker.onmessage = (e: MessageEvent<{ success: boolean; spec?: MatcherSolvedSpec; error?: string }>) => {
      setSpec(e.data.success && e.data.spec ? e.data.spec : getUnsolvedSpec(`역산 오류: ${e.data.error ?? '알 수 없음'}`));
      setIsSolving(false);
      worker.terminate();
    };
    worker.onerror = (err) => {
      setSpec(getUnsolvedSpec(`역산 오류: ${err.message}`));
      setIsSolving(false);
      worker.terminate();
    };
    worker.postMessage({ matrix: ctclMatrix, options, precision });
    return () => worker.terminate();
  }, [ctclMatrix, options, precision, runNonce]);

  const state = useMemo(() => getInstantaneousMatcherState(spec, testLoad, testTune), [spec, testLoad, testTune]);
  const interpolatedZ = useMemo(() => interpolateCTCL(ctclMatrix, testLoad, testTune), [ctclMatrix, testLoad, testTune]);

  const compareRows = spec.solved
    ? [
        { name: 'Shunt Inductor', ref: `${REFERENCE_CIRCUIT.shuntNh} nH`, refV: REFERENCE_CIRCUIT.shuntNh, fit: spec.shuntInductorNh, unit: 'nH' },
        { name: 'Series Inductor', ref: `${REFERENCE_CIRCUIT.seriesNh} nH`, refV: REFERENCE_CIRCUIT.seriesNh, fit: spec.seriesInductorNh, unit: 'nH' },
        ...(spec.precision ? [{ name: '출력 기생 C', ref: '- (도면 없음)', refV: NaN, fit: spec.precision.cOutPf, unit: 'pF' }] : []),
        {
          name: 'Load VFC 합계',
          ref: `${REFERENCE_CIRCUIT.loadVfcPf} pF (${REFERENCE_CIRCUIT.loadVfcDesc})`,
          refV: REFERENCE_CIRCUIT.loadVfcPf,
          fit: spec.loadVfcPf,
          unit: 'pF',
        },
        ...(spec.precision
          ? []
          : [{ name: 'Tune VFC 합계', ref: '0 pF (미장착)', refV: REFERENCE_CIRCUIT.tuneVfcPf, fit: spec.tuneVfcPf, unit: 'pF' }]),
      ]
    : [];

  const hintless = loadHint === AUTO || tuneHint === AUTO;

  return (
    <div className="space-y-2">
      {/* 힌트 설정 바 */}
      <div className="bg-white border border-slate-300 rounded-xl p-2.5 shadow-xs flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="flex items-center gap-1.5 shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-900">회로 역추적 조건 (장착 VVC 정격)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <label className="flex items-center gap-1">
            <span className="text-slate-600 font-semibold">Load VVC</span>
            <select
              value={loadHint}
              onChange={(e) => setLoadHint(e.target.value)}
              className="border border-slate-300 rounded px-1.5 py-0.5 bg-white"
            >
              <option value={AUTO}>자동 추정 (힌트 없음)</option>
              {STANDARD_VVC_PROFILES.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-slate-600 font-semibold">Tune VVC</span>
            <select
              value={tuneHint}
              onChange={(e) => setTuneHint(e.target.value)}
              className="border border-slate-300 rounded px-1.5 py-0.5 bg-white"
            >
              <option value={AUTO}>자동 추정 (힌트 없음)</option>
              {STANDARD_VVC_PROFILES.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setLoadHint(REFERENCE_CIRCUIT.loadVvcLabel);
              setTuneHint(REFERENCE_CIRCUIT.tuneVvcLabel);
            }}
            className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700"
          >
            기본 L-Type({REFERENCE_CIRCUIT.name}) 값으로
          </button>
          <label className="flex items-center gap-1 cursor-pointer" title="출력단 기생 용량과 Tune VVC 실측 곡선을 함께 학습합니다 (정격을 둘 다 골라야 사용 가능)">
            <input
              type="checkbox"
              checked={precisionOn}
              disabled={hintless}
              onChange={(e) => setPrecisionOn(e.target.checked)}
            />
            <span className="font-semibold text-slate-700">정밀 보정</span>
          </label>
          <label className="flex items-center gap-1" title="BOM 등으로 Load VFC 합계를 알고 있으면 입력하세요. 비워 두면 Load VVC 정격으로부터 VFC를 추정합니다.">
            <span className="text-slate-600 font-semibold">Load VFC 합계</span>
            <input
              type="number"
              min={0}
              placeholder="모름"
              value={loadVfcInput}
              disabled={!precision && !(precisionOn && !hintless)}
              onChange={(e) => setLoadVfcInput(e.target.value)}
              className="w-20 border border-slate-300 rounded px-1.5 py-0.5 bg-white font-mono"
            />
            <span className="text-slate-500">pF</span>
          </label>
        </div>
        <p className="text-[10px] text-slate-500 flex items-start gap-1 lg:ml-auto lg:max-w-[360px]">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          {hintless
            ? '힌트 없이 추정하면 VVC 정격 조합과 인덕터 값이 서로 맞바뀔 수 있어 결과가 불안정합니다. 정격을 알면 선택하세요.'
            : precision
              ? precision.knownLoadVfcPf !== undefined
                ? '입력한 Load VFC를 기준으로 Shunt L과 Load VVC 최소 용량을 구합니다. Tune VVC는 100%=정격 최대로 두고 곡선을 학습합니다.'
                : 'Load는 VVC 정격 그대로, Tune은 100%=정격 최대로 두고 실측 곡선·출력 기생 C를 학습합니다. Load VFC를 알면 입력하세요(Shunt L이 함께 바뀝니다).'
              : 'VVC 정격을 직선으로 고정하고 Shunt/Series 인덕터와 고정 VFC(+기생 용량)를 피팅합니다.'}
        </p>
      </div>

      {/* 정밀 보정 효과 */}
      {spec.solved && spec.precision && (
        <div className="bg-white border border-slate-300 rounded-xl p-2.5 shadow-xs grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <div className="space-y-2 text-[11px]">
            <div className="text-xs font-bold text-slate-900">정밀 보정 결과 (같은 VVC 정격 기준)</div>
            <table className="w-full">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-semibold py-0.5">방식</th>
                  <th className="text-right font-semibold py-0.5">R²</th>
                  <th className="text-right font-semibold py-0.5">RMSE</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-t border-slate-200">
                  <td className="py-1 font-sans text-slate-600">기존 (정격 직선, 기생 C 없음)</td>
                  <td className="py-1 text-right">{spec.precision.baseline.r2}%</td>
                  <td className="py-1 text-right">{spec.precision.baseline.rmse} Ω</td>
                </tr>
                <tr className="border-t border-slate-200 font-bold text-slate-900">
                  <td className="py-1 font-sans">정밀 보정</td>
                  <td className="py-1 text-right">{spec.fitConfidence}%</td>
                  <td className="py-1 text-right">{spec.rmse} Ω</td>
                </tr>
              </tbody>
            </table>
            <ul className="text-slate-600 space-y-0.5 list-disc pl-4">
              <li>
                출력단 기생 용량: <strong className="font-mono text-slate-900">{spec.precision.cOutPf} pF</strong>
                {spec.precision.cOutSd !== undefined ? ` (±${spec.precision.cOutSd})` : ''}
              </li>
              <li>
                최대 오차: <strong className="font-mono text-slate-900">{spec.maxAbsError} Ω</strong> · 기준 {spec.convention.toUpperCase()}
              </li>
              <li>
                Tune VVC 총 용량: 0%에서{' '}
                <strong className="font-mono text-slate-900">{spec.precision.tuneCurve[0].totalPf} pF</strong> (정격 직선{' '}
                {spec.precision.tuneCurve[0].ratedPf} pF)
              </li>
            </ul>
            <p className="text-[10px] text-slate-500">
              Load 쪽은 CTCL만으로 VFC와 Shunt L을 구분할 수 없습니다. Load VFC 합계를 입력하면 그 값에 맞는 Shunt L이 다시
              계산됩니다.
            </p>
          </div>
          <TuneCurveChart curve={spec.precision.tuneCurve} count={spec.tuneVvcCount} />
        </div>
      )}

      {/* 회로도 + 소자값 */}
      <MatcherSchematicPanel
        spec={spec}
        state={state}
        interpolatedZ={interpolatedZ}
        isSolving={isSolving}
        onReRunSolver={() => setRunNonce((n) => n + 1)}
      />

      {/* 기준 회로 대비 비교 */}
      {compareRows.length > 0 && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-xs font-bold text-slate-900">
            기준 회로({REFERENCE_CIRCUIT.name}) 대비 역추적 결과
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-3 py-1 font-semibold">소자</th>
                  <th className="text-right px-3 py-1 font-semibold">기준 회로</th>
                  <th className="text-right px-3 py-1 font-semibold">CTCL 역추적</th>
                  <th className="text-right px-3 py-1 font-semibold">차이</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {compareRows.map((r) => {
                  const diff = r.fit - r.refV;
                  const pct = r.refV ? (diff / r.refV) * 100 : null;
                  const big = pct !== null ? Math.abs(pct) > 15 : Math.abs(diff) > 50;
                  return (
                    <tr key={r.name} className="border-t border-slate-200">
                      <td className="px-3 py-1 font-sans font-semibold text-slate-700">{r.name}</td>
                      <td className="px-3 py-1 text-right text-slate-600">{r.ref}</td>
                      <td className="px-3 py-1 text-right text-slate-900 font-bold">
                        {Number.isFinite(r.fit) ? `${r.fit} ${r.unit}` : '-'}
                      </td>
                      <td className={`px-3 py-1 text-right ${big ? 'text-rose-600 font-bold' : 'text-emerald-700'}`}>
                        {Number.isFinite(diff)
                          ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} ${r.unit}${pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}`
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-1.5 text-[10px] text-slate-500 border-t border-slate-200">
            Series L 역추적값에는 출력 스트랩/배선의 기생 인덕턴스가, VFC 합계에는 기생 용량이 함께 포함됩니다. 차이가 15%를
            넘으면 빨간색으로 표시합니다.
          </p>
        </div>
      )}
    </div>
  );
};
