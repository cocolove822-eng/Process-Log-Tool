import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Eye, EyeOff, SlidersHorizontal, Check, Globe, Layers, ChevronDown, ChevronUp, X, ArrowDown01, ArrowDownWideNarrow } from 'lucide-react';
import { AnalysisFileResult, ParsedLogFile, RawLogRow } from '../types/pecvd';

export interface AlignedStepSegment {
  step: number;
  stepName: string;
  durationSec: number;
  rawStartSec: number;
  rawEndSec: number;
  alignedStart: number;
  alignedEnd: number;
}

export const STEP_PALETTE = [
  { bg: '#E2E8F0', border: '#94A3B8', text: '#1E293B', badgeClass: 'bg-slate-200/95 border-slate-400 text-slate-800' },
  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', badgeClass: 'bg-amber-100/95 border-amber-400 text-amber-900 font-semibold' },
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF', badgeClass: 'bg-blue-100/95 border-blue-500 text-blue-900 font-bold' },
  { bg: '#DCFCE7', border: '#10B981', text: '#065F46', badgeClass: 'bg-emerald-100/95 border-emerald-500 text-emerald-900 font-bold' },
  { bg: '#F3E8FF', border: '#A855F7', text: '#6B21A8', badgeClass: 'bg-purple-100/95 border-purple-400 text-purple-900 font-semibold' },
  { bg: '#FFEDD5', border: '#F97316', text: '#9A3412', badgeClass: 'bg-orange-100/95 border-orange-400 text-orange-900 font-semibold' },
  { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D', badgeClass: 'bg-pink-100/95 border-pink-400 text-pink-900 font-semibold' },
  { bg: '#E0F2FE', border: '#0284C7', text: '#0369A1', badgeClass: 'bg-cyan-100/95 border-cyan-400 text-cyan-900 font-semibold' },
  { bg: '#CCFBF1', border: '#14B8A6', text: '#115E59', badgeClass: 'bg-teal-100/95 border-teal-400 text-teal-900 font-semibold' },
  { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3', badgeClass: 'bg-indigo-100/95 border-indigo-400 text-indigo-900 font-semibold' },
];

interface TrendTabProps {
  files: ParsedLogFile[];
  results: AnalysisFileResult[];
}

const RECIPE_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#7C3AED', // Violet
  '#0891B2', // Cyan
  '#EA580C', // Orange
  '#4F46E5', // Indigo
  '#DB2777', // Pink
  '#0D9488', // Teal
];

interface MetricDefinition {
  id: string;
  name: string;
  unit: string;
  category: 'RF' | 'Reflect' | 'Matcher' | 'Pressure' | 'Gas' | 'Heater' | 'Lift';
  getter: (r: RawLogRow) => number;
}

export const CATEGORY_STYLES: Record<MetricDefinition['category'], {
  name: string;
  dotColor: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  lightTextColor: string;
}> = {
  RF: {
    name: 'RF Power',
    dotColor: '#2563EB',
    badgeBg: '#EFF6FF',
    badgeBorder: '#BFDBFE',
    textColor: '#1D4ED8',
    lightTextColor: '#1D4ED8',
  },
  Reflect: {
    name: 'RF Reflect',
    dotColor: '#E11D48',
    badgeBg: '#FFE4E6',
    badgeBorder: '#FECDD3',
    textColor: '#BE123C',
    lightTextColor: '#BE123C',
  },
  Matcher: {
    name: 'Matcher',
    dotColor: '#059669',
    badgeBg: '#ECFDF5',
    badgeBorder: '#A7F3D0',
    textColor: '#047857',
    lightTextColor: '#047857',
  },
  Pressure: {
    name: 'T/V & Pres.',
    dotColor: '#D97706',
    badgeBg: '#FFFBEB',
    badgeBorder: '#FDE68A',
    textColor: '#B45309',
    lightTextColor: '#B45309',
  },
  Gas: {
    name: 'Gas MFC',
    dotColor: '#EA580C',
    badgeBg: '#FFF7ED',
    badgeBorder: '#FED7AA',
    textColor: '#C2410C',
    lightTextColor: '#C2410C',
  },
  Heater: {
    name: 'Heater',
    dotColor: '#DC2626',
    badgeBg: '#FEF2F2',
    badgeBorder: '#FECACA',
    textColor: '#B91C1C',
    lightTextColor: '#B91C1C',
  },
  Lift: {
    name: 'Lift Spacing',
    dotColor: '#4F46E5',
    badgeBg: '#EEF2FF',
    badgeBorder: '#C7D2FE',
    textColor: '#4338CA',
    lightTextColor: '#4338CA',
  },
};

const STANDARD_METRICS: MetricDefinition[] = [
  { id: 'rfForwardAct', name: 'RF Forward Power(Act)', unit: 'W', category: 'RF', getter: r => r.rfForwardPowerAct },
  { id: 'rfReflect', name: 'RF Reflect Power', unit: 'W', category: 'Reflect', getter: r => r.rfReflectPower },
  { id: 'tvPressure', name: 'T/V Pressure', unit: 'mTorr', category: 'Pressure', getter: r => r.tvPressure },
  { id: 'tvPosition', name: 'T/V Position', unit: '%', category: 'Pressure', getter: r => r.tvPosition },
  { id: 'matcherLoad', name: 'Matcher Load', unit: '%', category: 'Matcher', getter: r => r.matcherLoad },
  { id: 'matcherTune', name: 'Matcher Tune', unit: '%', category: 'Matcher', getter: r => r.matcherTune },
  { id: 'matcherVpp', name: 'Matcher Vpp', unit: 'V', category: 'Matcher', getter: r => r.matcherVpp },
  { id: 'matcherIrms', name: 'Matcher Irms', unit: 'A', category: 'Matcher', getter: r => r.matcherIrms },
  { id: 'matcherDCBias', name: 'Matcher DC Bias', unit: 'V', category: 'Matcher', getter: r => r.matcherDCBias },
  { id: 'pyroSiH4', name: 'Pyro.SiH4', unit: 'sccm', category: 'Gas', getter: r => r.pyroSiH4 },
  { id: 'pyroN2O', name: 'Pyro.N2O', unit: 'sccm', category: 'Gas', getter: r => r.pyroN2O },
  { id: 'pyroNH3', name: 'Pyro.NH3', unit: 'sccm', category: 'Gas', getter: r => r.pyroNH3 },
  { id: 'pyroPN2', name: 'Pyro.PN2', unit: 'sccm', category: 'Gas', getter: r => r.pyroPN2 },
  { id: 'pyroAr', name: 'Pyro.Ar', unit: 'sccm', category: 'Gas', getter: r => r.pyroAr },
  { id: 'pyroH2', name: 'Pyro.H2', unit: 'sccm', category: 'Gas', getter: r => r.pyroH2 },
  { id: 'gateIn1', name: 'Gate In 1 (Temp)', unit: '℃', category: 'Heater', getter: r => r.gateIn1 },
  { id: 'windowIn3', name: 'Window In 3 (Temp)', unit: '℃', category: 'Heater', getter: r => r.windowIn3 },
  { id: 'liftSpacing', name: 'Lift Spacing', unit: 'mils', category: 'Lift', getter: r => r.liftSpacing },
];

export interface ExcelAxisFormat {
  // X-Axis (Time)
  xMin: number | null; // null = auto
  xMax: number | null; // null = auto
  xStep: number | null; // null = default 10s
  xMinorStep: number | null; // null = auto minor step (e.g. 2s)
  showVGrid: boolean;
  showVMinorGrid: boolean;

  // Y-Axis (Value)
  yMin: number | null; // null = auto
  yMax: number | null; // null = auto
  yStep: number | null; // null = auto
  yMinorStep: number | null;
  showHGrid: boolean;
  showHMinorGrid: boolean;

  // Scale & Formatting
  isLogScale: boolean;
  decimalPlaces: 'auto' | 0 | 1 | 2;
  displayUnit: 'auto' | 'k';

  // Lines & Baseline
  showZeroBaseline: boolean;
  targetLine: number | null;
  showTickMarks: boolean;
}

export function getRfOnOffsetSec(file: ParsedLogFile, res?: AnalysisFileResult): number {
  // 1. 해당 res가 가리키는 스텝이 실제로 실질적인 RF 방전(>= 50W)을 포함하는 유효 스텝인 경우 우선 채택
  const depoStep = res?.depoStep ?? file.manualDepoStep;
  const depoRows = depoStep !== undefined && depoStep !== null ? file.rows.filter(r => r.step === depoStep) : [];
  const depoHasRf = depoRows.some(r => r.rfForwardPowerAct >= 50);

  if (depoHasRf && res?.rfOnElapsedSec !== undefined && res?.rfOnElapsedSec !== null && res.rfOnElapsedSec > 0) {
    return res.rfOnElapsedSec;
  }

  // 2. depoRows 내에서 RF가 10W 이상으로 켜진 첫 시점
  const firstOnInDepo = depoRows.find(r => r.rfForwardPowerAct >= 10);
  if (firstOnInDepo) return firstOnInDepo.elapsedSec;

  // 3. 만약 감지/지정된 스텝에 RF가 없거나(예: PUMP/대기 스텝 등),
  // 파일 전체에서 실질적인 주 RF 플라즈마 방전(가장 방전 에너지가 큰 스텝)의 시작 시점을 기준점으로 사용!
  const rfSteps = Array.from(new Set(file.rows.filter(r => r.rfForwardPowerAct >= 50).map(r => r.step)));
  if (rfSteps.length > 0) {
    let bestStep = rfSteps[0];
    let maxRfSum = 0;
    rfSteps.forEach(s => {
      const sRows = file.rows.filter(r => r.step === s);
      const sSum = sRows.reduce((acc, r) => acc + (r.rfForwardPowerAct || 0), 0);
      if (sSum > maxRfSum) {
        maxRfSum = sSum;
        bestStep = s;
      }
    });
    const bestRows = file.rows.filter(r => r.step === bestStep);
    const bestFirstOn = bestRows.find(r => r.rfForwardPowerAct >= 10) || bestRows[0];
    if (bestFirstOn) return bestFirstOn.elapsedSec;
  }

  // 4. 전역 첫 RF On 시점
  const globalFirstOn = file.rows.find(r => r.rfForwardPowerAct >= 10);
  if (globalFirstOn) return globalFirstOn.elapsedSec;

  if (depoRows.length > 0) return depoRows[0].elapsedSec;
  if (file.rows.length > 0) return file.rows[0].elapsedSec;
  return 0;
}

export const TrendTab: React.FC<TrendTabProps> = ({ files, results }) => {
  const [timeAlignment, setTimeAlignment] = useState<'elapsed' | 'rfOn'>('elapsed');
  // Default 4 metrics requested by user
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'rfForwardAct',
    'rfReflect',
    'tvPressure',
    'matcherDCBias',
  ]);
  const [visibleFileIds, setVisibleFileIds] = useState<Record<string, boolean>>({});
  const [resetAllKey, setResetAllKey] = useState<number>(0);
  const [showStepTimeline, setShowStepTimeline] = useState<boolean>(true);
  // 그래프 오른쪽 커서 값 표: 보기 방식(개별/묶어 보기)과 정렬은 모든 그래프 카드에 함께 적용
  const [valueView, setValueView] = useState<ValueView>('list');
  const [valueSort, setValueSort] = useState<ValueSort>('no');
  const [stepRefFileId, setStepRefFileId] = useState<string>(files[0]?.id || '');

  // Visible files list
  const visibleFiles = useMemo(() => {
    return files.filter(f => visibleFileIds[f.id] !== false);
  }, [files, visibleFileIds]);

  // Keep stepRefFileId valid and synchronized with visible files
  useEffect(() => {
    if (visibleFiles.length > 0) {
      // If currently selected stepRefFileId is not among visible files, auto-switch to first visible file!
      if (!visibleFiles.some(f => f.id === stepRefFileId)) {
        setStepRefFileId(visibleFiles[0].id);
      }
    } else if (files.length > 0 && (!stepRefFileId || !files.some(f => f.id === stepRefFileId))) {
      setStepRefFileId(files[0].id);
    }
  }, [visibleFiles, files, stepRefFileId]);

  // Global X axis sync when user requests "Apply X axis to all graphs"
  const [globalXFormat, setGlobalXFormat] = useState<{
    xMin: number | null;
    xMax: number | null;
    xStep: number | null;
    xMinorStep?: number | null;
    showVGrid?: boolean;
    showVMinorGrid?: boolean;
    showTickMarks?: boolean;
    key: number;
  } | null>(null);

  // When alignment mode changes, clear global manual X bounds to let auto bounds recompute
  useEffect(() => {
    setGlobalXFormat(null);
  }, [timeAlignment]);

  // Reset card zoom & custom axis bounds when visible files change so charts automatically fit the newly visible recipe!
  useEffect(() => {
    setGlobalXFormat(null);
    setResetAllKey(k => k + 1);
  }, [visibleFileIds]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    files.forEach(f => {
      initial[f.id] = true;
    });
    setVisibleFileIds(initial);
  }, [files]);

  // Step reference file:
  // 1. If currently selected stepRefFileId is visible, use it.
  // 2. Otherwise use the first visible file.
  // 3. Fallback to stepRefFileId or first file.
  const refFile = useMemo(() => {
    if (visibleFiles.length > 0) {
      const activeSelected = visibleFiles.find(f => f.id === stepRefFileId);
      if (activeSelected) return activeSelected;
      return visibleFiles[0];
    }
    return files.find(f => f.id === stepRefFileId) || files[0];
  }, [files, visibleFiles, stepRefFileId]);

  // Aligned Step timing segments relative to current timeAlignment
  const alignedSteps: AlignedStepSegment[] = useMemo(() => {
    if (!refFile) return [];
    const refRes = results.find(r => r.fileId === refFile.id);
    const tOnOffset = timeAlignment === 'rfOn' ? getRfOnOffsetSec(refFile, refRes) : 0;

    let rawSteps = refFile.stepsSummary;
    if (!rawSteps || rawSteps.length === 0) {
      const map = new Map<number, { step: number; stepName: string; start: number; end: number }>();
      refFile.rows.forEach(r => {
        if (!map.has(r.step)) {
          map.set(r.step, { step: r.step, stepName: r.stepName, start: r.elapsedSec, end: r.elapsedSec });
        } else {
          const cur = map.get(r.step)!;
          cur.end = Math.max(cur.end, r.elapsedSec);
        }
      });
      rawSteps = Array.from(map.values()).map(s => ({
        step: s.step,
        stepName: s.stepName,
        rowCount: 0,
        durationSec: Math.round((s.end - s.start) * 10) / 10,
        startElapsedSec: s.start,
        endElapsedSec: s.end,
      }));
    }

    return rawSteps.map(s => ({
      step: s.step,
      stepName: s.stepName,
      durationSec: s.durationSec,
      rawStartSec: s.startElapsedSec,
      rawEndSec: s.endElapsedSec,
      alignedStart: Math.round((s.startElapsedSec - tOnOffset) * 10) / 10,
      alignedEnd: Math.round((s.endElapsedSec - tOnOffset) * 10) / 10,
    }));
  }, [refFile, results, timeAlignment]);

  const { minGlobalX, maxGlobalX } = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;

    files.forEach((f, idx) => {
      if (visibleFileIds[f.id] === false) return;
      const res = results.find(r => r.fileId === f.id) || results[idx];
      const offset = timeAlignment === 'rfOn' ? getRfOnOffsetSec(f, res) : 0;

      if (f.rows.length > 0) {
        const first = f.rows[0].elapsedSec - offset;
        const last = f.rows[f.rows.length - 1].elapsedSec - offset;
        minX = Math.min(minX, first);
        maxX = Math.max(maxX, last);
      }
    });

    if (minX === Infinity) {
      minX = 0;
      maxX = 100;
    }

    return { minGlobalX: Math.floor(minX), maxGlobalX: Math.ceil(maxX) };
  }, [files, results, timeAlignment, visibleFileIds]);

  const toggleMetric = (id: string) => {
    setSelectedMetrics(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const toggleFileVisibility = (fileId: string) => {
    setVisibleFileIds(prev => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };

  const handleApplyGlobalXFormat = (fmt: {
    xMin: number | null;
    xMax: number | null;
    xStep: number | null;
    xMinorStep?: number | null;
    showVGrid?: boolean;
    showVMinorGrid?: boolean;
    showTickMarks?: boolean;
  }) => {
    setGlobalXFormat({
      ...fmt,
      key: Date.now(),
    });
  };

  if (files.length === 0) {
    return (
      <div className="p-16 text-center text-[#64748B] bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
        등록된 공정 데이터가 없습니다. 상단에서 로그 파일을 추가하세요.
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-start w-full">
      {/* 1. Left Vertical Control Panel (그래프 제어 설정) */}
      <aside className="w-full lg:w-[250px] shrink-0 bg-[#F1F5F9] border border-slate-400 rounded-2xl p-2.5 shadow-xs space-y-3 lg:sticky lg:top-[68px]">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
          <span className="text-xs font-extrabold text-[#0F172A] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
            그래프 제어 설정
          </span>
          {/* 전체 초기화 버튼 */}
          <button
            onClick={() => {
              setGlobalXFormat(null);
              setResetAllKey(k => k + 1);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[#0F172A] hover:bg-slate-200 bg-white border border-slate-300 rounded-lg transition-all cursor-pointer text-[10px] font-semibold"
            title="모든 그래프 줌/이동 전체 초기화"
          >
            <RefreshCw className="w-3 h-3 text-[#475569]" />
            <span>전체 초기화</span>
          </button>
        </div>

        {/* Section 1: 시간 축 기준 */}
        <div className="space-y-1">
          <span className="text-[10.5px] font-bold text-[#334155] block">1. 시간축 기준</span>
          <div className="grid grid-cols-1 gap-1 bg-[#E2E8F0] p-0.5 rounded-xl border border-slate-300">
            <button
              type="button"
              onClick={() => setTimeAlignment('elapsed')}
              className={`px-2 py-1 text-[10.5px] font-semibold rounded-lg text-left transition-all cursor-pointer ${
                timeAlignment === 'elapsed'
                  ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              경과 시간 (0.0s = 파일 시작)
            </button>
            <button
              type="button"
              onClick={() => setTimeAlignment('rfOn')}
              className={`px-2 py-1 text-[10.5px] font-semibold rounded-lg text-left transition-all cursor-pointer ${
                timeAlignment === 'rfOn'
                  ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              RF On 정렬 (0.0s = Depo)
            </button>
          </div>
        </div>

        {/* Section 2: Step 타임라인 표시 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <label htmlFor="step-timeline-toggle" className="font-bold text-[#334155] cursor-pointer select-none">
              2. Step 타임라인 표시
            </label>
            <span className="flex items-center gap-1.5">
              {showStepTimeline && alignedSteps.length > 0 && (
                <span
                  className="text-[9.5px] font-bold text-[#2563EB] tabular-nums"
                  title="기준 Run의 Step 수"
                >
                  {alignedSteps.length} Step
                </span>
              )}
              <input
                id="step-timeline-toggle"
                type="checkbox"
                checked={showStepTimeline}
                onChange={e => setShowStepTimeline(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-400 text-[#2563EB] focus:ring-0 cursor-pointer"
              />
            </span>
          </div>

          {showStepTimeline && files.length > 1 && (
            <select
              aria-label="Step 기준 Run"
              title="Step 기준 Run: 이 Run의 Step 구간으로 위쪽 Step 띠와 구분선을 그립니다"
              value={refFile?.id || stepRefFileId}
              onChange={e => {
                const nextId = e.target.value;
                setStepRefFileId(nextId);
                if (visibleFileIds[nextId] === false) {
                  setVisibleFileIds(prev => ({ ...prev, [nextId]: true }));
                }
              }}
              className="w-full bg-white border border-slate-300 text-[#0F172A] text-[10px] rounded-lg px-1.5 py-1 font-medium focus:outline-none focus:border-[#2563EB]"
            >
              {files.map((f, idx) => {
                const isVis = visibleFileIds[f.id] !== false;
                const rcpName = results.find(r => r.fileId === f.id)?.rcpName || f.meta.recipeName || f.fileName;
                return (
                  <option key={f.id} value={f.id}>
                    기준 #{idx + 1} {rcpName} {!isVis ? '(숨김)' : ''}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Section 3: 레시피 필터 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-bold text-[#334155]">
              3. 레시피 필터 ({files.filter(f => visibleFileIds[f.id] !== false).length}/{files.length})
            </span>
            <button
              type="button"
              onClick={() => {
                const allVisible = files.every(f => visibleFileIds[f.id] !== false);
                const next: Record<string, boolean> = {};
                files.forEach(f => {
                  next[f.id] = !allVisible;
                });
                setVisibleFileIds(next);
              }}
              className="text-[9.5px] text-[#2563EB] font-semibold hover:underline cursor-pointer"
            >
              {files.every(f => visibleFileIds[f.id] !== false) ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <div className="space-y-1 max-h-[170px] overflow-y-auto scrollbar-thin pr-0.5">
            {files.map((file, idx) => {
              const color = RECIPE_COLORS[idx % RECIPE_COLORS.length];
              const isVisible = visibleFileIds[file.id] !== false;
              const rcpName =
                results.find(r => r.fileId === file.id)?.rcpName ||
                file.meta.recipeName ||
                file.fileName;
              const isStepRef = refFile?.id === file.id;

              return (
                <div
                  key={file.id}
                  onClick={() => toggleFileVisibility(file.id)}
                  className={`w-full flex items-center justify-between px-2 py-1 text-[10.5px] rounded-lg border transition-all cursor-pointer ${
                    isVisible
                      ? 'bg-white border-[#2563EB] text-[#1E40AF] shadow-2xs font-semibold'
                      : 'bg-slate-200/60 border-slate-300 text-[#64748B]'
                  }`}
                  title={`${rcpName} (클릭: 표시/숨김 토글)`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isVisible ? color : '#94A3B8' }}
                    />
                    <span className="truncate text-left" title={rcpName}>
                      #{idx + 1} {rcpName}
                    </span>
                    {isStepRef && isVisible && (
                      <span className="text-[8px] bg-blue-100 text-blue-700 font-bold px-1 py-0.2 rounded shrink-0">
                        기준
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        // Solo view: only this file visible!
                        const next: Record<string, boolean> = {};
                        files.forEach(f => {
                          next[f.id] = f.id === file.id;
                        });
                        setVisibleFileIds(next);
                        setStepRefFileId(file.id);
                      }}
                      className="px-1.5 py-0.5 text-[8.5px] font-bold rounded bg-slate-100 hover:bg-[#2563EB] hover:text-white text-[#475569] border border-slate-300 transition-all cursor-pointer"
                      title={`#${idx + 1} ${rcpName}만 단독 보기`}
                    >
                      단독
                    </button>
                    {isVisible ? (
                      <Eye className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: 파라미터 선택 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-bold text-[#334155]">
              4. 파라미터 ({selectedMetrics.length})
            </span>
            <div className="flex items-center gap-1 text-[9.5px]">
              <button
                type="button"
                onClick={() =>
                  setSelectedMetrics([
                    'rfForwardAct',
                    'rfReflect',
                    'tvPressure',
                    'matcherDCBias',
                  ])
                }
                className="text-[#2563EB] hover:underline cursor-pointer font-bold"
              >
                기본 4종
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedMetrics.length === STANDARD_METRICS.length) {
                    setSelectedMetrics([]);
                  } else {
                    setSelectedMetrics(STANDARD_METRICS.map(m => m.id));
                  }
                }}
                className="text-[#2563EB] hover:underline cursor-pointer"
              >
                {selectedMetrics.length === STANDARD_METRICS.length ? '해제' : '전체'}
              </button>
            </div>
          </div>

          <div className="space-y-1 max-h-[380px] overflow-y-auto scrollbar-thin pr-0.5">
            {STANDARD_METRICS.map(m => {
              const isSelected = selectedMetrics.includes(m.id);
              const catStyle = CATEGORY_STYLES[m.category];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMetric(m.id)}
                  className={`w-full flex items-center justify-between px-2 py-1 text-[10px] rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-opacity-100 shadow-2xs font-bold'
                      : 'bg-white border-slate-300 text-[#475569] hover:text-[#0F172A]'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: catStyle.badgeBg,
                          borderColor: catStyle.badgeBorder,
                          color: catStyle.lightTextColor,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? catStyle.dotColor : '#94A3B8' }}
                    />
                    <span className="truncate">{m.name}</span>
                  </div>
                  <span className="text-[9px] font-mono opacity-75 shrink-0 ml-1">
                    [{m.unit}]
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* 2. Right Chart Area (2 Columns Grid: 1행에 2개씩 배치) */}
      <div className="flex-1 min-w-0">
        {selectedMetrics.length === 0 ? (
          <div className="p-12 text-center text-[#64748B] bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
            선택된 파라미터가 없습니다. 좌측 제어 설정에서 그래프를 확인할 파라미터를 선택하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {selectedMetrics.map(metricId => {
              const metric = STANDARD_METRICS.find(m => m.id === metricId);
              if (!metric) return null;
              return (
                <TrendChartCard
                  key={metric.id}
                  metric={metric}
                  files={files}
                  results={results}
                  visibleFileIds={visibleFileIds}
                  timeAlignment={timeAlignment}
                  globalXRange={[minGlobalX, maxGlobalX]}
                  resetKey={resetAllKey}
                  globalXFormat={globalXFormat}
                  onApplyGlobalXFormat={handleApplyGlobalXFormat}
                  showStepTimeline={showStepTimeline}
                  alignedSteps={alignedSteps}
                  refFile={refFile}
                  valueView={valueView}
                  onChangeValueView={setValueView}
                  valueSort={valueSort}
                  onChangeValueSort={setValueSort}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface TrendChartCardProps {
  metric: MetricDefinition;
  files: ParsedLogFile[];
  results: AnalysisFileResult[];
  visibleFileIds: Record<string, boolean>;
  timeAlignment: 'elapsed' | 'rfOn';
  globalXRange: [number, number];
  resetKey: number;
  globalXFormat: {
    xMin: number | null;
    xMax: number | null;
    xStep: number | null;
    xMinorStep?: number | null;
    showVGrid?: boolean;
    showVMinorGrid?: boolean;
    showTickMarks?: boolean;
    key: number;
  } | null;
  onApplyGlobalXFormat: (fmt: {
    xMin: number | null;
    xMax: number | null;
    xStep: number | null;
    xMinorStep?: number | null;
    showVGrid?: boolean;
    showVMinorGrid?: boolean;
    showTickMarks?: boolean;
  }) => void;
  showStepTimeline: boolean;
  alignedSteps: AlignedStepSegment[];
  refFile?: ParsedLogFile;
  valueView: ValueView;
  onChangeValueView: (v: ValueView) => void;
  valueSort: ValueSort;
  onChangeValueSort: (v: ValueSort) => void;
}

type ValueView = 'list' | 'group';
type ValueSort = 'no' | 'value';

interface CursorValue {
  /** 값 표에 보여 줄 짧은 이름 (로그 4번째 행 Recipe Name 기준) */
  shortName: string;
  fileId: string;
  fileIdx: number;
  fileNo: number;
  rcpName: string;
  color: string;
  formatted: string;
  numVal: number;
}

/**
 * 값 표에 보여 줄 Recipe 대표 이름 키워드.
 * 로그 4번째 행 "Recipe Name"에 이 단어가 들어 있으면 그 단어만 표시한다.
 * (긴 단어부터 확인하므로 YILD2_B → YILD2, YILD_B → YILD)
 * 새 키워드가 생기면 이 목록에 추가하면 된다.
 */
export const RECIPE_KEYWORDS = [
  'BBN', 'TBO', 'BGO', 'BLO', 'BLN', 'TLN',
  'YILD', 'YILD2', 'YMTL', 'YCNT',
  'GI_SIN', 'GI_SIO', 'a-Si', '3Layer',
];

/**
 * 우선 키워드: 한 Recipe Name에 여러 키워드가 함께 있으면 이 목록을 먼저 확인한다.
 * 예) A4_a-Si_3layer_sih4 → a-Si (3Layer보다 우선)
 * 나머지 키워드는 긴 단어부터 확인한다 (YILD2_B → YILD2).
 */
export const RECIPE_KEYWORD_PRIORITY = ['a-Si', 'GI_SIN', 'GI_SIO'];

/** 키워드 안의 '-', '.' 같은 문자를 정규식에서 글자 그대로 찾도록 처리 */
const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RECIPE_KEYWORD_RES = [
  ...RECIPE_KEYWORD_PRIORITY,
  ...RECIPE_KEYWORDS.filter(k => !RECIPE_KEYWORD_PRIORITY.includes(k)).sort((x, y) => y.length - x.length),
]
  .map(k => ({ k, re: new RegExp(`(?<![A-Za-z])${escapeRegExp(k)}(?![A-Za-z])`, 'i') }));

/**
 * Recipe 짧은 이름
 * 1) 키워드(BBN, TBO, YILD2 …)가 들어 있으면 그 단어 (영단어 속에 우연히 섞인 경우는 제외: BLOCK ≠ BLO)
 * 2) 없으면 경로를 뗀 Recipe Name 전체
 */
export function shortRecipeName(name: string): string {
  const base = ((name || '').split(/[\\/]/).pop() || name || '').trim();
  for (const { k, re } of RECIPE_KEYWORD_RES) if (re.test(base)) return k;
  return base;
}

/** 커서 위치 값 서식 (상단 상태바와 같은 규칙) */
const formatCursorValue = (v: number): string =>
  Math.abs(v) >= 1000
    ? Math.round(v).toLocaleString()
    : Math.abs(v) >= 10
    ? (Math.round(v * 10) / 10).toLocaleString()
    : (Math.round(v * 100) / 100).toLocaleString();

/**
 * 같은 값 묶기: 값 순서로 정렬한 뒤, 바로 앞 값과의 차이가
 * (보이는 값 중 최대 절댓값의 0.5%) 이하이면 같은 묶음으로 본다.
 * 예) 10,150 · 10,151 → 한 묶음, 10,860 → 다른 묶음
 */
function groupCursorValues(values: CursorValue[]): { lo: number; hi: number; items: CursorValue[] }[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => b.numVal - a.numVal);
  const maxAbs = Math.max(...sorted.map(v => Math.abs(v.numVal)));
  const tol = Math.max(maxAbs * 0.005, 1e-9);
  const groups: { lo: number; hi: number; items: CursorValue[] }[] = [];
  for (const v of sorted) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g.items[g.items.length - 1].numVal - v.numVal) <= tol) {
      g.items.push(v);
      g.lo = Math.min(g.lo, v.numVal);
    } else {
      groups.push({ lo: v.numVal, hi: v.numVal, items: [v] });
    }
  }
  groups.forEach(g => g.items.sort((a, b) => a.fileNo - b.fileNo));
  return groups;
}

// ============================================================================
// 그래프 오른쪽 커서 값 표 (개별 보기 / 같은 값 묶어 보기)
// ============================================================================
interface CursorValuePanelProps {
  files: ParsedLogFile[];
  results: AnalysisFileResult[];
  visibleFileIds: Record<string, boolean>;
  values: CursorValue[] | null; // null = 아직 커서를 올린 적 없음
  timeLabel: string | null; // 예: "61.4 s · Step 2"
  live: boolean; // true = 지금 마우스가 그래프 위에 있음, false = 마지막 위치 값 유지 중
  unit?: string;
  view: ValueView;
  onChangeView: (v: ValueView) => void;
  sort: ValueSort;
  onChangeSort: (v: ValueSort) => void;
  highlightFileId: string | null;
  onHighlight: (id: string | null) => void;
}

const SegBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; title?: string }> = ({
  active,
  onClick,
  children,
  title,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={active}
    className={`flex-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
      active ? 'bg-white text-[#2563EB] shadow-2xs border border-[#BFDBFE]' : 'text-[#475569] hover:text-[#0F172A] border border-transparent'
    }`}
  >
    {children}
  </button>
);

const CursorValuePanel: React.FC<CursorValuePanelProps> = ({
  files,
  results,
  visibleFileIds,
  values,
  timeLabel,
  live,
  unit,
  view,
  onChangeView,
  sort,
  onChangeSort,
  highlightFileId,
  onHighlight,
}) => {
  // 표시 중인 Recipe 목록 (커서 값이 없을 때도 행 자리를 유지)
  const rows: CursorValue[] = useMemo(() => {
    const byId = new Map((values ?? []).map(v => [v.fileId, v]));
    const list: CursorValue[] = [];
    files.forEach((file, idx) => {
      if (visibleFileIds[file.id] === false) return;
      const res = results.find(r => r.fileId === file.id) || results[idx];
      const hit = byId.get(file.id);
      list.push(
        hit ?? {
          shortName: shortRecipeName(file.meta.recipeName || res?.rcpName || file.fileName),
          fileId: file.id,
          fileIdx: idx,
          fileNo: idx + 1,
          rcpName: res?.rcpName || file.meta.recipeName || file.fileName,
          color: RECIPE_COLORS[idx % RECIPE_COLORS.length],
          formatted: '–',
          numVal: NaN,
        }
      );
    });
    if (sort === 'value') {
      list.sort((a, b) => {
        const av = Number.isFinite(a.numVal) ? a.numVal : -Infinity;
        const bv = Number.isFinite(b.numVal) ? b.numVal : -Infinity;
        return bv - av || a.fileNo - b.fileNo;
      });
    }
    return list;
  }, [files, results, visibleFileIds, values, sort]);

  const groups = useMemo(() => groupCursorValues((values ?? []).filter(v => Number.isFinite(v.numVal))), [values]);
  const hasValues = !!values && values.length > 0;

  return (
    <div className="w-[160px] shrink-0 h-[272px] bg-white border border-slate-400 rounded-lg flex flex-col overflow-hidden" title={unit ? `단위: ${unit}` : undefined}>
      {/* 머리글: 시점 / 보기 방식 + 정렬 */}
      <div className="px-1 py-1 bg-[#E2E8F0] border-b border-slate-300 space-y-1">
        <span
          className="flex items-center gap-1 min-w-0 px-0.5 text-[10px] font-bold text-[#0F172A]"
          title={live ? '현재 커서 위치' : '마지막 커서 위치의 값을 유지하고 있습니다'}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${live ? 'bg-[#2563EB]' : 'bg-slate-400'}`} />
          <span className="truncate tabular-nums">{timeLabel ?? '커서 위치 값'}</span>
        </span>
        <div className="flex items-center gap-0.5">
          <div className="flex-1 flex gap-0.5 bg-[#CBD5E1]/60 p-0.5 rounded-lg">
            <SegBtn active={view === 'list'} onClick={() => onChangeView('list')} title="Recipe별로 한 줄씩 표시">
              개별
            </SegBtn>
            <SegBtn active={view === 'group'} onClick={() => onChangeView('group')} title="값이 거의 같은 Recipe끼리 묶어서 표시">
              묶음
            </SegBtn>
          </div>
          {view === 'list' && (
            <button
              type="button"
              onClick={() => onChangeSort(sort === 'no' ? 'value' : 'no')}
              title={sort === 'no' ? '현재: 번호순 (누르면 값 큰 순)' : '현재: 값 큰 순 (누르면 번호순)'}
              aria-label="정렬 바꾸기"
              className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-md bg-white border border-slate-300 text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
            >
              {sort === 'no' ? <ArrowDown01 className="w-3.5 h-3.5" /> : <ArrowDownWideNarrow className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin" onMouseLeave={() => onHighlight(null)}>
        {view === 'list' ? (
          <table className="w-full border-collapse table-fixed text-[10.5px]">
            <tbody>
              {rows.map((v, i) => {
                const hi = highlightFileId === v.fileId;
                return (
                  <tr
                    key={v.fileId}
                    onMouseEnter={() => onHighlight(v.fileId)}
                    className={`cursor-default ${hi ? 'bg-[#DBEAFE]' : i % 2 ? 'bg-[#F1F5F9]' : 'bg-white'}`}
                    title={`#${v.fileNo} ${v.rcpName}`}
                  >
                    <td className="pl-1 py-[2px] border-b border-slate-200 whitespace-nowrap overflow-hidden">
                      <span className="flex items-center gap-1 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                        <span className="font-bold text-[#334155] tabular-nums shrink-0">#{v.fileNo}</span>
                        <span className="font-semibold text-[#475569] truncate">{v.shortName}</span>
                      </span>
                    </td>
                    <td className="w-[68px] pr-1 py-[2px] border-b border-slate-200 text-right font-bold text-[#0F172A] tabular-nums whitespace-nowrap">
                      {v.formatted}
                      {unit && Number.isFinite(v.numVal) && (
                        <span className="ml-0.5 text-[9px] font-semibold text-[#64748B]">{unit}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : hasValues ? (
          <div className="divide-y divide-slate-200">
            {groups.map((g, gi) => {
              const lo = formatCursorValue(g.lo);
              const hiV = formatCursorValue(g.hi);
              return (
                <div key={gi} className="px-1 py-1 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[12px] font-bold text-[#0F172A] tabular-nums whitespace-nowrap">
                      {lo === hiV ? hiV : `${lo} ~ ${hiV}`}
                      {unit && <span className="ml-0.5 text-[10px] font-semibold text-[#64748B]">{unit}</span>}
                    </span>
                    <span className="text-[10px] font-semibold text-[#475569] whitespace-nowrap">{g.items.length}개</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map(v => (
                      <span
                        key={v.fileId}
                        onMouseEnter={() => onHighlight(v.fileId)}
                        title={`${v.rcpName}: ${v.formatted}${unit ? ' ' + unit : ''}`}
                        className={`inline-flex items-center gap-0.5 px-1 py-[1px] max-w-full min-w-0 rounded border text-[10px] font-bold tabular-nums cursor-default ${
                          highlightFileId === v.fileId ? 'bg-[#DBEAFE] border-[#2563EB] text-[#1E3A8A]' : 'bg-[#F8FAFC] border-slate-300 text-[#334155]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                        <span className="shrink-0">#{v.fileNo}</span>
                        <span className="font-semibold text-[#475569] truncate">{v.shortName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-1.5 py-2 text-[10px] text-[#64748B] leading-relaxed">
            그래프 위에 마우스를 올리면 같은 값끼리 묶어 보여 줍니다.
          </p>
        )}
      </div>

    </div>
  );
};

// ============================================================================
// 축 서식 팝오버용 작은 입력 부품
// ============================================================================
const AXIS_INPUT =
  'w-full min-w-0 bg-white border border-slate-300 rounded px-1.5 py-[3px] text-[11px] font-semibold tabular-nums text-[#0F172A] focus:outline-none focus:border-[#2563EB]';

/** 한 줄: 왼쪽 항목 이름 + 오른쪽 입력들 */
const AxisRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-1.5">
    <span className="text-[10.5px] font-semibold text-[#475569] truncate" title={label}>
      {label}
    </span>
    <div className="flex items-center gap-1 flex-wrap min-w-0 [&>*]:flex-1">{children}</div>
  </div>
);

/** 숫자 칸: 빈칸 = 자동(null). 입력 중인 글자('-', '1.' 등)는 그대로 유지 */
const AxisNum: React.FC<{ value: number | null; placeholder: string; onChange: (v: number | null) => void; accent?: boolean }> = ({
  value,
  placeholder,
  onChange,
  accent,
}) => {
  const [text, setText] = useState<string>(value === null ? '' : String(value));
  useEffect(() => {
    const cur = text.trim() === '' ? null : parseFloat(text);
    if (value !== cur && !(value === null && cur !== null && isNaN(cur))) setText(value === null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={e => {
        const t = e.target.value;
        setText(t);
        if (t.trim() === '') return onChange(null);
        const v = parseFloat(t);
        if (!isNaN(v)) onChange(v);
      }}
      className={`${AXIS_INPUT} ${accent ? 'border-[#FDBA74] text-[#C2410C] focus:border-[#EA580C]' : ''}`}
    />
  );
};

const AxisCheck: React.FC<{ checked: boolean; onChange: (c: boolean) => void; children: React.ReactNode }> = ({
  checked,
  onChange,
  children,
}) => (
  <label className="!flex-none flex items-center gap-1 text-[10.5px] text-[#334155] cursor-pointer whitespace-nowrap">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded accent-[#2563EB]" />
    {children}
  </label>
);

const TrendChartCard: React.FC<TrendChartCardProps> = ({
  metric,
  files,
  results,
  visibleFileIds,
  timeAlignment,
  globalXRange,
  resetKey,
  globalXFormat,
  onApplyGlobalXFormat,
  showStepTimeline,
  alignedSteps,
  refFile,
  valueView,
  onChangeValueView,
  valueSort,
  onChangeValueSort,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Independent Zoom & Pan state for THIS card only
  const [cardXRange, setCardXRange] = useState<[number, number] | null>(null);

  // Track when web fonts (Pretendard) are ready
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false);
  useEffect(() => {
    if (document.fonts) {
      document.fonts.ready.then(() => setFontsLoaded(true));
    }
  }, []);

  // Excel-style Axis Formatting state
  const [isFormatOpen, setIsFormatOpen] = useState<boolean>(false);
  const [formatTab, setFormatTab] = useState<'x' | 'y'>('x');

  const [axisConfig, setAxisConfig] = useState<ExcelAxisFormat>({
    xMin: null,
    xMax: null,
    xStep: 10.0, // Default 10.0s interval as requested
    xMinorStep: null,
    showVGrid: true,
    showVMinorGrid: false,
    yMin: null,
    yMax: null,
    yStep: null,
    yMinorStep: null,
    showHGrid: true,
    showHMinorGrid: false,
    isLogScale: false,
    decimalPlaces: 'auto',
    displayUnit: 'auto',
    showZeroBaseline: true,
    targetLine: null,
    showTickMarks: true,
  });

  // Track if applied to all banner confirmation
  const [justAppliedToAll, setJustAppliedToAll] = useState<boolean>(false);

  // Legend dropdown popover state & click-outside handling
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const legendRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLegendOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setIsLegendOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLegendOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLegendOpen]);

  // Drag & Pan state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartRangeRef = useRef<[number, number]>(globalXRange);

  // Hover crosshair state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  // 값 표의 행에 마우스를 올리면 그 Recipe 선을 그래프에서 강조
  const [highlightFileId, setHighlightFileId] = useState<string | null>(null);
  // Step 띠를 그래프 실제 영역(padLeft ~ padRight)에 정확히 맞추기 위한 측정값
  const bandRowRef = useRef<HTMLDivElement>(null);
  const plotWrapRef = useRef<HTMLDivElement>(null);
  const [trackPos, setTrackPos] = useState<{ left: number; right: number } | null>(null);
  const [sizeTick, setSizeTick] = useState(0);
  useEffect(() => {
    const el = plotWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== last) {
        last = el.clientWidth;
        setSizeTick(t => t + 1); // 폭이 바뀌면 그래프를 다시 그림
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 마지막으로 마우스가 있던 시점 (값 표 유지용)
  const [lastHoverTime, setLastHoverTime] = useState<number | null>(null);

  // Filter visible files list with computed colors and recipe names
  const visibleFiles = useMemo(() => {
    return files
      .map((file, idx) => {
        const isVisible = visibleFileIds[file.id] !== false;
        const color = RECIPE_COLORS[idx % RECIPE_COLORS.length];
        const res = results.find(r => r.fileId === file.id);
        const rcpName = res?.rcpName || file.meta.recipeName || file.fileName;
        return { file, idx, isVisible, color, rcpName };
      })
      .filter(item => item.isVisible);
  }, [files, visibleFileIds, results]);

  // Sync when globalXFormat propagates from another card
  useEffect(() => {
    if (globalXFormat) {
      setAxisConfig(prev => ({
        ...prev,
        xMin: globalXFormat.xMin,
        xMax: globalXFormat.xMax,
        xStep: globalXFormat.xStep !== null ? globalXFormat.xStep : prev.xStep,
        xMinorStep: globalXFormat.xMinorStep !== undefined ? globalXFormat.xMinorStep : prev.xMinorStep,
        showVGrid: globalXFormat.showVGrid !== undefined ? globalXFormat.showVGrid : prev.showVGrid,
        showVMinorGrid: globalXFormat.showVMinorGrid !== undefined ? globalXFormat.showVMinorGrid : prev.showVMinorGrid,
        showTickMarks: globalXFormat.showTickMarks !== undefined ? globalXFormat.showTickMarks : prev.showTickMarks,
      }));
      setCardXRange(null);
    }
  }, [globalXFormat]);

  // When timeAlignment or resetKey changes, reset this card's zoom and custom X bounds
  useEffect(() => {
    setCardXRange(null);
    setAxisConfig(prev => ({
      ...prev,
      xMin: null,
      xMax: null,
    }));
  }, [timeAlignment, resetKey]);

  // Determine auto range
  const [autoMinX, autoMaxX] = globalXRange;

  // Compute auto Y range for this metric
  const { autoMinY, autoMaxY } = useMemo(() => {
    let minY = Infinity;
    let maxY = -Infinity;

    files.forEach((f) => {
      if (visibleFileIds[f.id] === false) return;
      f.rows.forEach(r => {
        const v = metric.getter(r);
        if (!isNaN(v)) {
          minY = Math.min(minY, v);
          maxY = Math.max(maxY, v);
        }
      });
    });

    if (minY === Infinity || minY === maxY) {
      return { autoMinY: 0, autoMaxY: 100 };
    }
    const padY = (maxY - minY) * 0.1 || 1;
    return {
      autoMinY: Math.round((minY - padY) * 10) / 10,
      autoMaxY: Math.round((maxY + padY) * 10) / 10,
    };
  }, [files, visibleFileIds, metric]);

  // Effective X Range taking Axis Format inputs or zoom into account
  const effectiveXRange: [number, number] = useMemo(() => {
    if (cardXRange) return cardXRange;
    const min = axisConfig.xMin !== null ? axisConfig.xMin : autoMinX;
    const max = axisConfig.xMax !== null ? axisConfig.xMax : autoMaxX;
    return [min, max > min ? max : min + 10];
  }, [cardXRange, axisConfig.xMin, axisConfig.xMax, autoMinX, autoMaxX]);

  // Effective Y Range taking Axis Format inputs into account
  const effectiveYRange: [number, number] = useMemo(() => {
    const min = axisConfig.yMin !== null ? axisConfig.yMin : autoMinY;
    const max = axisConfig.yMax !== null ? axisConfig.yMax : autoMaxY;
    return [min, max > min ? max : min + 1];
  }, [axisConfig.yMin, axisConfig.yMax, autoMinY, autoMaxY]);

  // Check if zoomed or custom-bound
  const isCustomOrZoomed =
    cardXRange !== null ||
    axisConfig.xMin !== null ||
    axisConfig.xMax !== null ||
    axisConfig.xStep !== 10.0 ||
    axisConfig.xMinorStep !== null ||
    axisConfig.yMin !== null ||
    axisConfig.yMax !== null ||
    axisConfig.yStep !== null ||
    axisConfig.yMinorStep !== null ||
    axisConfig.isLogScale ||
    axisConfig.decimalPlaces !== 'auto' ||
    axisConfig.displayUnit !== 'auto' ||
    axisConfig.targetLine !== null ||
    !axisConfig.showVGrid ||
    axisConfig.showVMinorGrid ||
    !axisConfig.showHGrid ||
    axisConfig.showHMinorGrid ||
    !axisConfig.showZeroBaseline ||
    !axisConfig.showTickMarks;

  const handleResetCard = () => {
    setCardXRange(null);
    setAxisConfig({
      xMin: null,
      xMax: null,
      xStep: 10.0,
      xMinorStep: null,
      showVGrid: true,
      showVMinorGrid: false,
      yMin: null,
      yMax: null,
      yStep: null,
      yMinorStep: null,
      showHGrid: true,
      showHMinorGrid: false,
      isLogScale: false,
      decimalPlaces: 'auto',
      displayUnit: 'auto',
      showZeroBaseline: true,
      targetLine: null,
      showTickMarks: true,
    });
  };

  // 1. Mouse Wheel Zoom Listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const padLeft = 54;
      const padRight = 18;
      const plotW = rect.width - padLeft - padRight;
      if (plotW <= 0) return;

      const [curMin, curMax] = effectiveXRange;
      const [gMin, gMax] = globalXRange;
      const gSpan = Math.max(5, gMax - gMin);
      const curSpan = curMax - curMin;

      const clampedX = Math.max(padLeft, Math.min(padLeft + plotW, mouseX));
      const ratio = (clampedX - padLeft) / plotW;
      const mouseTime = curMin + ratio * curSpan;

      const zoomFactor = e.deltaY < 0 ? 0.75 : 1.33;
      const newSpan = Math.max(2, Math.min(gSpan, curSpan * zoomFactor));

      let newMin = mouseTime - ratio * newSpan;
      let newMax = newMin + newSpan;

      if (newMin < gMin) {
        newMin = gMin;
        newMax = Math.min(gMax, newMin + newSpan);
      }
      if (newMax > gMax) {
        newMax = gMax;
        newMin = Math.max(gMin, newMax - newSpan);
      }

      setCardXRange([Math.round(newMin * 10) / 10, Math.round(newMax * 10) / 10]);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [effectiveXRange, globalXRange]);

  // 2. Mouse Drag Pan Listener
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 54;
    const padRight = 18;
    const plotW = rect.width - padLeft - padRight;
    if (mouseX < padLeft || mouseX > padLeft + plotW) return;

    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartRangeRef.current = [...effectiveXRange];
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const padLeft = 54;
      const padRight = 18;
      const plotW = rect.width - padLeft - padRight;
      if (plotW <= 0) return;

      const dx = e.clientX - dragStartXRef.current;
      const [startMin, startMax] = dragStartRangeRef.current;
      const [gMin, gMax] = globalXRange;
      const span = startMax - startMin;
      const dt = -(dx / plotW) * span;

      let newMin = startMin + dt;
      let newMax = startMax + dt;

      if (newMin < gMin) {
        newMin = gMin;
        newMax = Math.min(gMax, newMin + span);
      }
      if (newMax > gMax) {
        newMax = gMax;
        newMin = Math.max(gMin, newMax - span);
      }

      setCardXRange([Math.round(newMin * 10) / 10, Math.round(newMax * 10) / 10]);
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, globalXRange]);

  // Hover tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 54;
    const padRight = 18;
    const plotW = rect.width - padLeft - padRight;
    if (mouseX < padLeft || mouseX > padLeft + plotW) {
      setHoverTime(null);
      return;
    }
    const ratio = (mouseX - padLeft) / plotW;
    const time = effectiveXRange[0] + ratio * (effectiveXRange[1] - effectiveXRange[0]);
    setHoverTime(Math.round(time * 10) / 10);
    setLastHoverTime(Math.round(time * 10) / 10);
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setHoverTime(null);
    }
  };

  // Docked hover information calculation (방안 A: 상단 고정 도킹형 상태바)
  // 특정 시점(t)의 Step과 Recipe별 값 계산 (상단 상태바 · 오른쪽 값 표 공용)
  const computeCursorInfo = useCallback((t: number | null) => {
    if (t === null || t < effectiveXRange[0] || t > effectiveXRange[1]) {
      return null;
    }

    // 1. Current active Step at hover timestamp: "Step 4(SIN)"
    const curStep = alignedSteps.find(s => t >= s.alignedStart && t <= s.alignedEnd);
    const stepStr = curStep
      ? (curStep.stepName ? `Step ${curStep.step}(${curStep.stepName})` : `Step ${curStep.step}`)
      : '';

    // 2. Y-values across visible files at hover timestamp
    const visibleFiles = files.filter(f => visibleFileIds[f.id] !== false);
    const fileValues: CursorValue[] = [];

    visibleFiles.forEach(file => {
      const fileIdx = files.indexOf(file);
      const color = RECIPE_COLORS[fileIdx % RECIPE_COLORS.length];
      const res = results.find(r => r.fileId === file.id) || results[fileIdx];
      const tOnOffset = timeAlignment === 'rfOn' ? getRfOnOffsetSec(file, res) : 0;
      const targetSec = t + tOnOffset;

      let closestRow: RawLogRow | null = null;
      let minDiff = Infinity;
      for (const r of file.rows) {
        const diff = Math.abs(r.elapsedSec - targetSec);
        if (diff < minDiff) {
          minDiff = diff;
          closestRow = r;
          if (diff < 0.05) break;
        }
      }

      if (closestRow && minDiff <= 3.0) {
        const yVal = metric.getter(closestRow);
        if (!isNaN(yVal)) {
          const formatted = Math.abs(yVal) >= 1000
            ? Math.round(yVal).toLocaleString()
            : Math.abs(yVal) >= 10
            ? (Math.round(yVal * 10) / 10).toLocaleString()
            : (Math.round(yVal * 100) / 100).toLocaleString();

          const rcpName = res?.rcpName || file.meta.recipeName || file.fileName;

          fileValues.push({
            shortName: shortRecipeName(file.meta.recipeName || rcpName),
            fileId: file.id,
            fileIdx,
            fileNo: fileIdx + 1,
            rcpName,
            color,
            formatted,
            numVal: yVal,
          });
        }
      }
    });

    return {
      timeFormatted: `${t.toFixed(1)}`,
      fileValues,
      stepStr,
    };
  }, [effectiveXRange, alignedSteps, files, results, visibleFileIds, timeAlignment, metric]);

  const hoverInfo = useMemo(() => computeCursorInfo(hoverTime), [computeCursorInfo, hoverTime]);
  // 오른쪽 값 표는 마우스가 그래프를 벗어나도 마지막 커서 위치의 값을 유지
  const panelInfo = useMemo(() => computeCursorInfo(hoverTime ?? lastHoverTime), [computeCursorInfo, hoverTime, lastHoverTime]);

  // 3. Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 450;
    const height = 272; // 상단 상태바를 없앤 만큼 키운 높이 (오른쪽 값 표와 같은 높이)
    // Enforce minimum 2x Retina supersampling so text & lines are razor-sharp on all screens
    const dpr = Math.max(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const padLeft = 54;
    const padRight = 18;
    const padTop = 20;
    const padBottom = 38; // Extra room for Axis Title 'Time (sec)'

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Dashboard unified font family: Pretendard
    const DASHBOARD_FONT_FAMILY = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
    const FONT_NUM = `600 11px ${DASHBOARD_FONT_FAMILY}`;
    const FONT_LABEL = `700 11.5px ${DASHBOARD_FONT_FAMILY}`;
    const FONT_TAG = `700 10px ${DASHBOARD_FONT_FAMILY}`;
    const FONT_BADGE = `700 10.5px ${DASHBOARD_FONT_FAMILY}`;

    // Soft tech slate background to reduce glare and make grid lines clearly visible
    ctx.fillStyle = '#F4F6F9';
    ctx.fillRect(0, 0, width, height);

    // Plot inner area background
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(padLeft, padTop, plotW, plotH);

    const [minX, maxX] = effectiveXRange;
    const spanX = Math.max(0.1, maxX - minX);

    const [minY, maxY] = effectiveYRange;
    const spanY = Math.max(0.001, maxY - minY);

    // Number format helper for Y axis labels (supporting decimalPlaces & displayUnit 'k')
    const formatYValue = (val: number): string => {
      let v = val;
      let suffix = '';
      if (axisConfig.displayUnit === 'k') {
        v = val / 1000;
        suffix = 'k';
      }
      if (axisConfig.decimalPlaces === 0) {
        return `${Math.round(v).toLocaleString()}${suffix}`;
      } else if (axisConfig.decimalPlaces === 1) {
        return `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix}`;
      } else if (axisConfig.decimalPlaces === 2) {
        return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
      }
      // auto
      if (Math.abs(v) >= 1000) {
        return `${Math.round(v).toLocaleString()}${suffix}`;
      } else if (Math.abs(v) >= 10) {
        return `${(Math.round(v * 10) / 10).toLocaleString()}${suffix}`;
      } else {
        return `${(Math.round(v * 100) / 100).toLocaleString()}${suffix}`;
      }
    };

    const isLog = axisConfig.isLogScale && maxY > 0;
    const safeLogMin = Math.max(0.001, minY > 0 ? minY : 0.1);
    const safeLogMax = Math.max(safeLogMin * 10, maxY > safeLogMin ? maxY : safeLogMin * 10);
    const logSpan = Math.log10(safeLogMax) - Math.log10(safeLogMin);

    const mapX = (x: number) => padLeft + ((x - minX) / spanX) * plotW;
    const mapY = (y: number) => {
      if (isLog) {
        const clampedY = Math.max(safeLogMin, y);
        return padTop + plotH - ((Math.log10(clampedY) - Math.log10(safeLogMin)) / logSpan) * plotH;
      }
      return padTop + plotH - ((y - minY) / spanY) * plotH;
    };

    // 0. Top-left Y-axis Unit Label on Canvas
    ctx.save();
    ctx.font = FONT_LABEL;
    ctx.fillStyle = '#1E3A8A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const unitText = `단위: [${metric.unit}${axisConfig.displayUnit === 'k' ? ' · k' : ''}${isLog ? ' · Log₁₀' : ''}]`;
    ctx.fillText(unitText, padLeft, padTop - 5);
    ctx.restore();

    // 1. Horizontal Y-Axis Grid Lines & Ticks
    ctx.fillStyle = '#0F172A';
    ctx.font = FONT_NUM;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    if (isLog) {
      // Logarithmic Decades: 10^floor ~ 10^ceil
      const startDecade = Math.floor(Math.log10(safeLogMin));
      const endDecade = Math.ceil(Math.log10(safeLogMax));

      // Minor Log Gridlines (2, 3, 4, 5, 6, 7, 8, 9 * 10^d)
      if (axisConfig.showHMinorGrid) {
        ctx.save();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);
        for (let d = startDecade; d <= endDecade; d++) {
          for (let m = 2; m <= 9; m++) {
            const minorVal = m * Math.pow(10, d);
            if (minorVal >= safeLogMin && minorVal <= safeLogMax) {
              const yPos = Math.round(mapY(minorVal)) + 0.5;
              ctx.beginPath();
              ctx.moveTo(padLeft, yPos);
              ctx.lineTo(padLeft + plotW, yPos);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // Major Log Decades (10^d)
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      for (let d = startDecade; d <= endDecade; d++) {
        const majorVal = Math.pow(10, d);
        if (majorVal >= safeLogMin * 0.99 && majorVal <= safeLogMax * 1.01) {
          const yPos = mapY(majorVal);
          const snappedY = Math.round(yPos) + 0.5;
          if (axisConfig.showHGrid) {
            ctx.beginPath();
            ctx.moveTo(padLeft, snappedY);
            ctx.lineTo(padLeft + plotW, snappedY);
            ctx.stroke();
          }
          if (axisConfig.showTickMarks) {
            ctx.beginPath();
            ctx.moveTo(padLeft - 3, snappedY);
            ctx.lineTo(padLeft, snappedY);
            ctx.stroke();
          }
          ctx.fillText(formatYValue(majorVal), padLeft - 7, Math.round(yPos));
        }
      }
    } else {
      // Linear Y-Axis
      const yStep = axisConfig.yStep !== null && axisConfig.yStep > 0 ? axisConfig.yStep : spanY / 4;
      const minorYStep = axisConfig.yMinorStep !== null && axisConfig.yMinorStep > 0 ? axisConfig.yMinorStep : yStep / 2;

      // 1-1. Minor Y Gridlines (dotted lines)
      if (axisConfig.showHMinorGrid && minorYStep > 0 && spanY / minorYStep <= 40) {
        ctx.save();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);
        const firstMinorY = Math.ceil(minY / minorYStep) * minorYStep;
        for (let yVal = firstMinorY; yVal <= maxY + 0.0001; yVal += minorYStep) {
          // Skip if close to a major tick
          const remainder = Math.abs((yVal - Math.round(yVal / yStep) * yStep));
          if (remainder > minorYStep * 0.15) {
            const yPos = Math.round(mapY(yVal)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(padLeft, yPos);
            ctx.lineTo(padLeft + plotW, yPos);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 1-2. Major Y Gridlines & Ticks
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      const firstY = Math.ceil(minY / yStep) * yStep;
      for (let yVal = firstY; yVal <= maxY + 0.0001; yVal += yStep) {
        const yPos = mapY(yVal);
        const snappedY = Math.round(yPos) + 0.5;
        if (axisConfig.showHGrid) {
          ctx.beginPath();
          ctx.moveTo(padLeft, snappedY);
          ctx.lineTo(padLeft + plotW, snappedY);
          ctx.stroke();
        }
        if (axisConfig.showTickMarks) {
          ctx.beginPath();
          ctx.moveTo(padLeft - 3, snappedY);
          ctx.lineTo(padLeft, snappedY);
          ctx.stroke();
        }
        ctx.fillText(formatYValue(yVal), padLeft - 7, Math.round(yPos));
      }

      // 1-3. 0.0 Baseline Highlight
      if (axisConfig.showZeroBaseline && minY <= 0 && maxY >= 0) {
        const zeroY = Math.round(mapY(0)) + 0.5;
        ctx.save();
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padLeft, zeroY);
        ctx.lineTo(padLeft + plotW, zeroY);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Vertical X-Axis Time Ticks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xStep = axisConfig.xStep !== null && axisConfig.xStep > 0 ? axisConfig.xStep : 10.0;
    const tickCount = spanX / xStep;
    // 눈금 숫자 사이가 최소 40px은 떨어지도록 그래프 폭에 맞춰 건너뛰기 (값 표 때문에 그래프가 좁아져도 겹치지 않게)
    const pxPerTick = tickCount > 0 ? plotW / tickCount : plotW;
    const stepMultiplier = Math.max(tickCount > 30 ? Math.ceil(tickCount / 20) : 1, Math.ceil(40 / Math.max(pxPerTick, 1)));
    const actualStep = xStep * stepMultiplier;
    const actualMinorStep = axisConfig.xMinorStep !== null && axisConfig.xMinorStep > 0
      ? axisConfig.xMinorStep
      : actualStep / 2;

    // 2-1. Minor Vertical X Gridlines
    if (axisConfig.showVMinorGrid && actualMinorStep > 0 && spanX / actualMinorStep <= 80) {
      ctx.save();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);
      const firstMinorX = Math.ceil(minX / actualMinorStep) * actualMinorStep;
      for (let xVal = firstMinorX; xVal <= maxX + 0.0001; xVal += actualMinorStep) {
        const rem = Math.abs(xVal - Math.round(xVal / actualStep) * actualStep);
        if (rem > actualMinorStep * 0.15) {
          const xPos = Math.round(mapX(xVal)) + 0.5;
          ctx.beginPath();
          ctx.moveTo(xPos, padTop);
          ctx.lineTo(xPos, padTop + plotH);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 2-2. Major Vertical X Gridlines & Ticks
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    const firstX = Math.ceil(minX / actualStep) * actualStep;
    for (let xVal = firstX; xVal <= maxX + 0.0001; xVal += actualStep) {
      const xPos = mapX(xVal);
      const snappedX = Math.round(xPos) + 0.5;
      if (axisConfig.showVGrid) {
        ctx.beginPath();
        ctx.moveTo(snappedX, padTop);
        ctx.lineTo(snappedX, padTop + plotH);
        ctx.stroke();
      }
      if (axisConfig.showTickMarks) {
        ctx.beginPath();
        ctx.moveTo(snappedX, padTop + plotH);
        ctx.lineTo(snappedX, padTop + plotH + 4);
        ctx.stroke();
      }
      const roundedX = Math.abs(Math.round(xVal)) < 0.001 ? 0 : Math.round(xVal);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`${roundedX}`, Math.round(xPos), padTop + plotH + 6);
    }

    // 3. X-Axis Title: 'Time (sec)'
    ctx.save();
    ctx.font = FONT_LABEL;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const axisLabel = 'Time (sec)';
    ctx.fillText(axisLabel, Math.round(padLeft + plotW / 2), height - 4);
    ctx.restore();

    // =========================================================================
    // 4. Plot Area Clipping:
    // Strictly clip drawing to (padLeft, padTop, plotW, plotH) so zoomed/panned curves,
    // step dividers, and indicators NEVER leak outside the chart boundaries!
    // =========================================================================
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    // Plot series for each visible file (강조된 Recipe는 맨 나중에 그려 위로 올림)
    const drawOrder = files.map((file, idx) => ({ file, idx }));
    if (highlightFileId) drawOrder.sort((a, b) => Number(a.file.id === highlightFileId) - Number(b.file.id === highlightFileId));
    drawOrder.forEach(({ file, idx }) => {
      if (visibleFileIds[file.id] === false) return;
      const color = RECIPE_COLORS[idx % RECIPE_COLORS.length];
      const res = results.find(r => r.fileId === file.id) || results[idx];
      const tOnOffset = timeAlignment === 'rfOn' ? getRfOnOffsetSec(file, res) : 0;
      const isHi = highlightFileId === file.id;
      const isDim = highlightFileId !== null && !isHi;

      ctx.globalAlpha = isDim ? 0.22 : 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = isHi ? 3.2 : 2.0;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      let started = false;
      const marginX = Math.max(1.0, spanX * 0.05);
      file.rows.forEach(r => {
        const xVal = r.elapsedSec - tOnOffset;
        if (xVal < minX - marginX || xVal > maxX + marginX) {
          started = false;
          return;
        }

        const yVal = metric.getter(r);
        if (isNaN(yVal) || yVal === null) {
          started = false;
          return;
        }

        const px = mapX(xVal);
        const py = mapY(yVal);

        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      });

      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // 4-0. If Step Timeline is enabled, draw linked vertical dashed divider lines & top step tags
    if (showStepTimeline && alignedSteps.length > 0) {
      alignedSteps.forEach(step => {
        // Vertical dashed divider line at step transition
        if (step.alignedStart > minX && step.alignedStart < maxX) {
          const xPos = mapX(step.alignedStart);
          const snappedX = Math.round(xPos) + 0.5;
          ctx.save();
          ctx.strokeStyle = '#94A3B8'; // distinct slate-400
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(snappedX, padTop);
          ctx.lineTo(snappedX, padTop + plotH);
          ctx.stroke();
          ctx.restore();
        }

        // (그래프 안 S1·S2 등 Step 글자는 표시하지 않음: 위쪽 Step 띠와 점선 구분선으로 충분)
      });
    }

    // 4-1. If RF On alignment mode, draw a vertical reference dashed line at 0.0s (RF Ignition point)
    if (timeAlignment === 'rfOn' && minX <= 0 && maxX >= 0) {
      const zeroX = mapX(0);
      const snappedZero = Math.round(zeroX) + 0.5;
      ctx.save();
      ctx.strokeStyle = '#DC2626'; // Distinct Red accent line for RF On (0.0s)
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(snappedZero, padTop);
      ctx.lineTo(snappedZero, padTop + plotH);
      ctx.stroke();

      // Top badge label: "0.0s RF On"
      ctx.setLineDash([]);
      ctx.font = FONT_BADGE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = '0.0 RF On';
      const lw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(254, 242, 242, 0.98)';
      ctx.fillRect(Math.round(zeroX - lw / 2 - 5), padTop + 3, Math.round(lw + 10), 16);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(zeroX - lw / 2 - 5) + 0.5, padTop + 3.5, Math.round(lw + 10), 16);
      ctx.fillStyle = '#DC2626';
      ctx.fillText(label, Math.round(zeroX), padTop + 11);
      ctx.restore();
    }

    // 5. Hover vertical crosshair & dynamic tooltip pill
    if (hoverTime !== null && hoverTime >= minX && hoverTime <= maxX) {
      const hoverPx = mapX(hoverTime);
      const snappedHover = Math.round(hoverPx) + 0.5;
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(snappedHover, padTop);
      ctx.lineTo(snappedHover, padTop + plotH);
      ctx.stroke();

      // Find current active Step at hover timestamp
      const curStep = alignedSteps.find(s => hoverTime >= s.alignedStart && hoverTime <= s.alignedEnd);
      const stepStr = curStep
        ? (curStep.stepName ? `Step ${curStep.step}(${curStep.stepName})` : `Step ${curStep.step}`)
        : '';

      // Compute Y-value(s) at hoverTime across visible files
      const visibleFiles = files.filter(f => visibleFileIds[f.id] !== false);
      const yValPoints: { label: string; px: number; py: number; color: string }[] = [];

      visibleFiles.forEach(file => {
        const fileIdx = files.indexOf(file);
        const color = RECIPE_COLORS[fileIdx % RECIPE_COLORS.length];
        const res = results.find(r => r.fileId === file.id) || results[fileIdx];
        const tOnOffset = timeAlignment === 'rfOn' ? getRfOnOffsetSec(file, res) : 0;
        const targetSec = hoverTime + tOnOffset;

        let closestRow: RawLogRow | null = null;
        let minDiff = Infinity;
        for (const r of file.rows) {
          const diff = Math.abs(r.elapsedSec - targetSec);
          if (diff < minDiff) {
            minDiff = diff;
            closestRow = r;
            if (diff < 0.05) break;
          }
        }

        if (closestRow && minDiff <= 3.0) {
          const yVal = metric.getter(closestRow);
          if (!isNaN(yVal)) {
            const formatted = Math.abs(yVal) >= 1000
              ? Math.round(yVal).toLocaleString()
              : Math.abs(yVal) >= 10
              ? (Math.round(yVal * 10) / 10).toLocaleString()
              : (Math.round(yVal * 100) / 100).toLocaleString();

            const fileNo = fileIdx + 1;
            const labelStr = visibleFiles.length > 1 ? `#${fileNo}: ${formatted}` : formatted;

            yValPoints.push({
              label: labelStr,
              px: mapX(hoverTime),
              py: mapY(yVal),
              color,
            });
          }
        }
      });

      // Format Y-value string with unit
      let yValStr = '';
      if (yValPoints.length > 0) {
        const valCombined = yValPoints.map(p => p.label).join(' | ');
        yValStr = metric.unit ? `${valCombined} ${metric.unit}` : valCombined;
      }

      // Draw indicator circle on curve at hover position
      ctx.setLineDash([]);
      yValPoints.forEach(pt => {
        if (pt.py >= padTop && pt.py <= padTop + plotH) {
          ctx.beginPath();
          ctx.arc(Math.round(pt.px), Math.round(pt.py), 3.5, 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
      ctx.restore();
    }

    // 4-2. 공정 목표/스펙 기준선 (Target / Spec Line)
    if (axisConfig.targetLine !== null && !isNaN(axisConfig.targetLine)) {
      const targetY = mapY(axisConfig.targetLine);
      if (targetY >= padTop && targetY <= padTop + plotH) {
        ctx.save();
        ctx.strokeStyle = '#EA580C';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(padLeft, Math.round(targetY) + 0.5);
        ctx.lineTo(padLeft + plotW, Math.round(targetY) + 0.5);
        ctx.stroke();

        // Target badge
        ctx.setLineDash([]);
        ctx.font = FONT_BADGE;
        const formattedTarget = formatYValue(axisConfig.targetLine);
        const badgeLabel = `Target: ${formattedTarget}`;
        const bw = ctx.measureText(badgeLabel).width;
        const bx = padLeft + plotW - bw - 12;
        const by = Math.max(padTop + 3, Math.min(padTop + plotH - 18, targetY - 14));

        ctx.fillStyle = '#FFF7ED';
        ctx.fillRect(bx, by, bw + 8, 14);
        ctx.strokeStyle = '#EA580C';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw + 8, 14);
        ctx.fillStyle = '#C2410C';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeLabel, bx + 4, by + 7);
        ctx.restore();
      }
    }

    // End of clipped plot area
    ctx.restore();

    // Outer Border (drawn on top of clipped plot area for crisp borders)
    ctx.strokeStyle = isDragging ? '#2563EB' : '#94A3B8';
    ctx.lineWidth = isDragging ? 1.5 : 1.2;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // 위쪽 Step 띠가 그래프 영역과 같은 위치·폭을 갖도록 실제 위치를 측정
    const row = bandRowRef.current;
    if (row) {
      const rr = row.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      const next = {
        left: Math.round(cr.left - rr.left + padLeft),
        right: Math.round(rr.right - cr.right + padRight),
      };
      setTrackPos(p => (p && p.left === next.left && p.right === next.right ? p : next));
    }
  }, [
    sizeTick,
    files,
    results,
    metric,
    visibleFileIds,
    timeAlignment,
    effectiveXRange,
    effectiveYRange,
    axisConfig,
    hoverTime,
    isDragging,
    showStepTimeline,
    alignedSteps,
    fontsLoaded,
    highlightFileId,
  ]);

  const catStyle = CATEGORY_STYLES[metric.category];

  return (
    <div
      ref={containerRef}
      className="bg-[#F8FAFC] border border-slate-400 rounded-2xl overflow-hidden shadow-xs border-t-2 flex flex-col select-none relative"
      style={{ borderTopColor: catStyle.dotColor }}
    >
      {/* 1. Card Header */}
      <div className="px-3 py-2 bg-[#E2E8F0] border-b border-slate-300 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[9.5px] font-bold px-1.5 py-0.2 rounded border shrink-0"
            style={{
              backgroundColor: catStyle.badgeBg,
              borderColor: catStyle.badgeBorder,
              color: catStyle.lightTextColor,
            }}
          >
            {catStyle.name}
          </span>
          <span className="text-xs font-bold text-[#0F172A] truncate" title={metric.name}>
            {metric.name}
          </span>
          <span className="text-[10px] text-[#475569] font-mono shrink-0">
            [{metric.unit}]
          </span>
        </div>

        {/* Action Buttons: 줌 리셋 + 축 서식 */}
        <div className="flex items-center gap-1 shrink-0">
          {isCustomOrZoomed && (
            <button
              onClick={handleResetCard}
              className="px-1.5 py-0.5 text-[9.5px] font-bold text-[#2563EB] hover:bg-blue-50 bg-white border border-[#BFDBFE] rounded shadow-2xs transition-all cursor-pointer"
              title="이 그래프 범위/축 설정 초기화"
            >
              초기화
            </button>
          )}

          {/* 엑셀 스타일 [축 서식] 설정 토글 버튼 */}
          <button
            onClick={() => setIsFormatOpen(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer ${
              isFormatOpen
                ? 'bg-[#2563EB] text-white border border-[#2563EB]'
                : 'text-[#0F172A] hover:bg-slate-200 bg-white border border-slate-300'
            }`}
            title="Excel과 동일한 축 서식 설정 (경계 최소/최대값, 눈금 간격 10초 설정)"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>축 서식</span>
          </button>
        </div>
      </div>

      {/* 2. Chart Legend (한 줄 고정 + 클릭 시 드롭다운 팝오버) */}
      <div className="px-2.5 py-1 bg-[#F1F5F9] border-b border-slate-300 flex items-center justify-between gap-2 text-[9.5px] relative min-h-[30px] select-none">
        {/* Left: Legend Dropdown Toggle Button + Inline representative chips */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden flex-1">
          {/* Dropdown Toggle Button */}
          <button
            type="button"
            onClick={() => setIsLegendOpen(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold transition-all shadow-2xs shrink-0 cursor-pointer ${
              isLegendOpen
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-white hover:bg-slate-100 text-[#0F172A] border-slate-300'
            }`}
            title="클릭하여 전체 범례 드롭다운 열기/닫기"
          >
            <span>범례 ({visibleFiles.length})</span>
            {isLegendOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Inline Preview Chips (최대 2개 노출 후 +N개 더보기 버튼 표시) */}
          <div className="flex items-center gap-1 overflow-hidden min-w-0">
            {visibleFiles.slice(0, 2).map(item => (
              <div
                key={item.file.id}
                onClick={() => setIsLegendOpen(prev => !prev)}
                className="flex items-center gap-1 font-mono text-[9px] text-[#0F172A] bg-white hover:bg-blue-50/50 px-1.5 py-0.2 rounded border border-slate-300 hover:border-blue-400 shrink-0 cursor-pointer transition-colors"
                title={`${item.rcpName} (클릭 시 전체 범례 드롭다운 열기)`}
              >
                <span className="w-2 h-1.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-semibold truncate max-w-[120px]">
                  #{item.idx + 1} {item.rcpName}
                </span>
              </div>
            ))}

            {visibleFiles.length > 2 && (
              <button
                type="button"
                onClick={() => setIsLegendOpen(true)}
                className="px-1.5 py-0.2 rounded bg-white hover:bg-blue-50 border border-slate-300 hover:border-[#2563EB] text-[#2563EB] text-[8.5px] font-bold shrink-0 cursor-pointer transition-all shadow-2xs"
                title="모든 범례 목록 드롭다운 보기"
              >
                +{visibleFiles.length - 2}개 더보기 ▾
              </button>
            )}
          </div>
        </div>

        {/* Right: Axis Helper Text */}
        <span className="text-[8.5px] text-[#475569] font-mono shrink-0 hidden sm:inline whitespace-nowrap">
          간격: {axisConfig.xStep || 10}s · 휠: 줌 · 드래그: 이동
        </span>

        {/* Dropdown Floating Popover */}
        {isLegendOpen && (
          <div
            ref={legendRef}
            className="absolute top-[31px] left-2 right-2 sm:right-auto sm:w-[580px] max-w-[calc(100%-16px)] bg-white/98 backdrop-blur-md border border-slate-400 rounded-xl shadow-xl z-40 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100"
            style={{ maxHeight: '310px' }}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <span className="text-[11px] font-bold text-[#0F172A]">
                  공정 범례 목록 (표시 {visibleFiles.length}개 / 전체 {files.length}개)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLegendOpen(false)}
                className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-all cursor-pointer"
                title="닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Popover Items Grid (Responsive columns with scrollbar) */}
            <div className="max-h-[220px] overflow-y-auto scrollbar-thin pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {visibleFiles.map(item => (
                <div
                  key={item.file.id}
                  className="flex items-center gap-1.5 font-mono text-[9px] text-[#0F172A] bg-[#F8FAFC] hover:bg-blue-50/60 px-2 py-1 rounded-lg border border-slate-300 transition-colors"
                  title={item.rcpName}
                >
                  <span
                    className="w-2.5 h-2 rounded-xs shrink-0 shadow-2xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-bold text-[#2563EB] shrink-0">
                    #{item.idx + 1}
                  </span>
                  <span className="font-medium truncate text-[#1E293B]" title={item.rcpName}>
                    {item.rcpName}
                  </span>
                </div>
              ))}
            </div>

            {/* Popover Footer */}
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[9px] text-[#64748B]">
              <span>좌측 사이드바에서 개별 Run을 ON/OFF하거나 단독 보기할 수 있습니다.</span>
              <button
                type="button"
                onClick={() => setIsLegendOpen(false)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-[#334155] rounded text-[9.5px] font-bold transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2-1. Step Sequence Timeline Band Bar (Top Step Indicator) */}
      {showStepTimeline && alignedSteps.length > 0 && (
        <div ref={bandRowRef} className="bg-[#EAEFF5] border-b border-slate-300 px-2 py-1 flex items-center select-none relative h-[31px]">
          {/* 왼쪽 라벨: 그래프 Y축 숫자 영역 폭에 맞춤 */}
          <div
            className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-[#334155] pr-1"
            style={{ width: trackPos ? Math.max(40, trackPos.left - 8 - 4) : 52 }}
            title={
              refFile
                ? `Step 기준: #${files.findIndex(f => f.id === refFile.id) + 1} ${
                    results.find(r => r.fileId === refFile.id)?.rcpName ||
                    refFile.meta.recipeName ||
                    refFile.fileName
                  } (${alignedSteps.length}개 Step)`
                : 'Step 순서'
            }
          >
            <Layers className="w-3 h-3 text-[#2563EB] shrink-0" />
            <span className="truncate">
              Step{refFile ? ` #${files.findIndex(f => f.id === refFile.id) + 1}` : ''}
            </span>
          </div>

          {/* Step 띠: 측정한 그래프 영역(left/right)에 맞춰 배치 → 그래프 안의 Step 구분선과 정확히 일치 */}
          <div
            className={`h-[21px] rounded overflow-hidden bg-slate-300/60 ${
              trackPos
                ? 'absolute top-1/2 -translate-y-1/2 ring-1 ring-slate-400' /* ring은 폭을 줄이지 않아 Step 위치가 그래프와 1px도 어긋나지 않음 */
                : 'flex-1 relative mr-[10px] border border-slate-400'
            }`}
            style={trackPos ? { left: trackPos.left, right: trackPos.right, boxSizing: 'border-box' } : undefined}
          >
            {alignedSteps.map((step, si) => {
              const [minX, maxX] = effectiveXRange;
              const spanX = Math.max(0.1, maxX - minX);
              const visStart = Math.max(minX, step.alignedStart);
              // 다음 Step 시작 시점까지 이어서 그림 → 샘플 간격 틈 없이 그래프 구분선과 같은 위치에서 바뀜
              const nextStart = alignedSteps[si + 1]?.alignedStart;
              const blockEnd = nextStart !== undefined && nextStart > step.alignedStart ? nextStart : step.alignedEnd;
              const visEnd = Math.min(maxX, blockEnd);
              if (visEnd <= minX || visStart >= maxX) return null;

              const leftPct = ((visStart - minX) / spanX) * 100;
              const widthPct = Math.max(0.4, ((visEnd - visStart) / spanX) * 100);
              // Step 번호가 0·음수·숫자가 아니어도 색 목록 범위를 벗어나지 않도록 보정
              const stepIdx = Number.isFinite(step.step) ? Math.round(step.step) - 1 : 0;
              const palette =
                STEP_PALETTE[((stepIdx % STEP_PALETTE.length) + STEP_PALETTE.length) % STEP_PALETTE.length] ?? STEP_PALETTE[0];

              return (
                <div
                  key={step.step}
                  onClick={() => {
                    const pad = Math.max(1, step.durationSec * 0.05);
                    setCardXRange([
                      Math.round((step.alignedStart - pad) * 10) / 10,
                      Math.round((step.alignedEnd + pad) * 10) / 10,
                    ]);
                  }}
                  title={`Step ${step.step}: ${step.stepName} · ${step.durationSec}s (${step.alignedStart.toFixed(1)}s ~ ${step.alignedEnd.toFixed(1)}s) [클릭 시 Step 구간으로 줌]`}
                  className={`absolute top-0 bottom-0 flex items-center justify-center ${
                    si > 0 && step.alignedStart > minX ? 'border-l' : ''
                  } transition-all cursor-pointer hover:brightness-95 active:scale-[0.99] ${palette.badgeClass}`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                >
                  <span className="truncate px-0.5 text-[8.5px] font-semibold leading-none pointer-events-none">
                    {widthPct > 15
                      ? `Step ${step.step} (${step.stepName})`
                      : widthPct > 6
                      ? `Step ${step.step}`
                      : `S${step.step}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Canvas Area + 오른쪽 커서 값 표 */}
      <div className="p-2 bg-[#EEF2F6] flex-1 flex items-stretch gap-1.5 relative min-h-[272px]">
        <div ref={plotWrapRef} className="flex-1 min-w-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleResetCard}
          style={{ imageRendering: 'auto' }}
          className={`w-full block ${
            isDragging
              ? 'cursor-grabbing'
              : isCustomOrZoomed
              ? 'cursor-grab'
              : 'cursor-crosshair'
          }`}
          title="마우스 휠: 개별 확대/축소 | 좌클릭 드래그: 개별 좌우 이동 | 더블클릭: 줌 초기화"
        />
        </div>

        <CursorValuePanel
          files={files}
          results={results}
          visibleFileIds={visibleFileIds}
          values={panelInfo?.fileValues ?? null}
          timeLabel={
            panelInfo
              ? `${panelInfo.timeFormatted} s${panelInfo.stepStr ? ' · ' + panelInfo.stepStr.replace(/\(.*\)$/, '') : ''}`
              : null
          }
          live={hoverInfo !== null}
          unit={metric.unit}
          view={valueView}
          onChangeView={onChangeValueView}
          sort={valueSort}
          onChangeSort={onChangeValueSort}
          highlightFileId={highlightFileId}
          onHighlight={setHighlightFileId}
        />

        {/* 4. [축 서식] 컴팩트 팝오버 (그래프 오른쪽 위, 그래프를 가리지 않는 작은 창) */}
        {isFormatOpen && (
          <div
            className="absolute right-2 top-2 z-30 w-[300px] max-w-[calc(100%-16px)] bg-white rounded-lg shadow-lg border border-slate-400 text-[11px] text-[#0F172A] animate-in fade-in zoom-in-95 duration-100"
            onMouseDown={e => e.stopPropagation()}
          >
            {/* 머리: 탭 + 닫기 */}
            <div className="flex items-center gap-1 px-1.5 py-1 bg-[#E2E8F0] border-b border-slate-300 rounded-t-lg">
              <SlidersHorizontal className="w-3 h-3 text-[#2563EB] shrink-0" />
              <div className="flex-1 flex gap-0.5 bg-[#CBD5E1]/60 p-0.5 rounded-md">
                <SegBtn active={formatTab === 'x'} onClick={() => setFormatTab('x')}>
                  가로축 (시간)
                </SegBtn>
                <SegBtn active={formatTab === 'y'} onClick={() => setFormatTab('y')}>
                  세로축 (값)
                </SegBtn>
              </div>
              <button
                type="button"
                onClick={() => setIsFormatOpen(false)}
                aria-label="축 서식 닫기"
                className="p-0.5 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-slate-300/60 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2 space-y-1.5">
              {formatTab === 'x' ? (
                <>
                  <AxisRow label="경계 (s)">
                    <AxisNum value={axisConfig.xMin} placeholder="최소 자동" onChange={v => setAxisConfig(p => ({ ...p, xMin: v }))} />
                    <AxisNum value={axisConfig.xMax} placeholder="최대 자동" onChange={v => setAxisConfig(p => ({ ...p, xMax: v }))} />
                  </AxisRow>
                  <AxisRow label="눈금 간격 (s)">
                    <AxisNum
                      value={axisConfig.xStep}
                      placeholder="주 10"
                      onChange={v => setAxisConfig(p => ({ ...p, xStep: v !== null && v > 0 ? v : 10.0 }))}
                    />
                    <AxisNum
                      value={axisConfig.xMinorStep}
                      placeholder="보조 자동"
                      onChange={v => setAxisConfig(p => ({ ...p, xMinorStep: v !== null && v > 0 ? v : null }))}
                    />
                  </AxisRow>
                  <AxisRow label="눈금선">
                    <AxisCheck checked={axisConfig.showVGrid} onChange={c => setAxisConfig(p => ({ ...p, showVGrid: c }))}>
                      주
                    </AxisCheck>
                    <AxisCheck checked={axisConfig.showVMinorGrid} onChange={c => setAxisConfig(p => ({ ...p, showVMinorGrid: c }))}>
                      보조
                    </AxisCheck>
                    <AxisCheck checked={axisConfig.showTickMarks} onChange={c => setAxisConfig(p => ({ ...p, showTickMarks: c }))}>
                      눈금 틱
                    </AxisCheck>
                  </AxisRow>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyGlobalXFormat({
                        xMin: axisConfig.xMin,
                        xMax: axisConfig.xMax,
                        xStep: axisConfig.xStep,
                        xMinorStep: axisConfig.xMinorStep,
                        showVGrid: axisConfig.showVGrid,
                        showVMinorGrid: axisConfig.showVMinorGrid,
                        showTickMarks: axisConfig.showTickMarks,
                      });
                      setJustAppliedToAll(true);
                      setTimeout(() => setJustAppliedToAll(false), 2000);
                    }}
                    className="w-full flex items-center justify-center gap-1 py-1 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE] rounded text-[10.5px] font-bold cursor-pointer"
                    title="이 가로축 설정을 모든 그래프에 똑같이 적용합니다"
                  >
                    {justAppliedToAll ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">모든 그래프에 적용됨</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3" />
                        <span>모든 그래프에 가로축 적용</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <AxisRow label={`경계${metric.unit ? ` (${metric.unit})` : ''}`}>
                    <AxisNum value={axisConfig.yMin} placeholder="최소 자동" onChange={v => setAxisConfig(p => ({ ...p, yMin: v }))} />
                    <AxisNum value={axisConfig.yMax} placeholder="최대 자동" onChange={v => setAxisConfig(p => ({ ...p, yMax: v }))} />
                  </AxisRow>
                  <AxisRow label="눈금 간격">
                    <AxisNum
                      value={axisConfig.yStep}
                      placeholder="주 자동"
                      onChange={v => setAxisConfig(p => ({ ...p, yStep: v !== null && v > 0 ? v : null }))}
                    />
                    <AxisNum
                      value={axisConfig.yMinorStep}
                      placeholder="보조 자동"
                      onChange={v => setAxisConfig(p => ({ ...p, yMinorStep: v !== null && v > 0 ? v : null }))}
                    />
                  </AxisRow>
                  <AxisRow label="표시 형식">
                    <select
                      aria-label="소수 자릿수"
                      value={axisConfig.decimalPlaces}
                      onChange={e => {
                        const val = e.target.value;
                        setAxisConfig(p => ({ ...p, decimalPlaces: val === 'auto' ? 'auto' : (parseInt(val, 10) as 0 | 1 | 2) }));
                      }}
                      className={AXIS_INPUT}
                    >
                      <option value="auto">소수 자동</option>
                      <option value="0">정수</option>
                      <option value="1">소수 1자리</option>
                      <option value="2">소수 2자리</option>
                    </select>
                    <select
                      aria-label="표시 단위"
                      value={axisConfig.displayUnit}
                      onChange={e => setAxisConfig(p => ({ ...p, displayUnit: e.target.value as 'auto' | 'k' }))}
                      className={AXIS_INPUT}
                    >
                      <option value="auto">원래 값</option>
                      <option value="k">천 단위 (k)</option>
                    </select>
                  </AxisRow>
                  <AxisRow label="눈금 · 선">
                    <AxisCheck checked={axisConfig.showHGrid} onChange={c => setAxisConfig(p => ({ ...p, showHGrid: c }))}>
                      주
                    </AxisCheck>
                    <AxisCheck checked={axisConfig.showHMinorGrid} onChange={c => setAxisConfig(p => ({ ...p, showHMinorGrid: c }))}>
                      보조
                    </AxisCheck>
                    <AxisCheck checked={axisConfig.showZeroBaseline} onChange={c => setAxisConfig(p => ({ ...p, showZeroBaseline: c }))}>
                      0 기준선
                    </AxisCheck>
                    <AxisCheck checked={axisConfig.isLogScale} onChange={c => setAxisConfig(p => ({ ...p, isLogScale: c }))}>
                      로그
                    </AxisCheck>
                  </AxisRow>
                  <AxisRow label="목표선">
                    <AxisNum
                      value={axisConfig.targetLine}
                      placeholder="예: 4700 (없음)"
                      onChange={v => setAxisConfig(p => ({ ...p, targetLine: v }))}
                      accent
                    />
                  </AxisRow>
                </>
              )}
            </div>

            {/* 아래: 기본값 복원 */}
            <div className="flex items-center justify-between px-2 py-1 border-t border-slate-200 bg-[#F8FAFC] rounded-b-lg">
              <button
                type="button"
                onClick={handleResetCard}
                className="text-[10px] text-[#64748B] hover:text-[#DC2626] font-semibold cursor-pointer"
              >
                기본값 복원
              </button>
              <span className="text-[9.5px] text-[#94A3B8]">빈칸 = 자동</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
