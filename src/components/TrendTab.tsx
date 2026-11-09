import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, SlidersHorizontal, Check, Globe, Layers, ChevronDown, ChevronUp, X, ArrowDown01, ArrowDownWideNarrow, Ruler, Copy } from 'lucide-react';
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

// Recipe 선택 상태: 탭을 옮겨 TrendTab이 다시 그려져도 유지되도록 모듈 변수에 보관
let persistedRecipeSelection: string[] = [];

export const TrendTab: React.FC<TrendTabProps> = ({ files, results }) => {
  const [timeAlignment, setTimeAlignment] = useState<'elapsed' | 'rfOn'>('elapsed');
  // 그래프 배치: 한 행에 1·2·3개 (보는 사람 브라우저에 기억, 저장이 안 되는 환경이면 기본 2열)
  const [chartCols, setChartColsState] = useState<1 | 2 | 3>(() => {
    try {
      const v = Number(window.localStorage.getItem('pecvd.trend.chartCols'));
      return v === 1 || v === 3 ? v : 2;
    } catch {
      return 2;
    }
  });
  const setChartCols = (v: 1 | 2 | 3) => {
    setChartColsState(v);
    try {
      window.localStorage.setItem('pecvd.trend.chartCols', String(v));
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  };
  // Default 4 metrics requested by user
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'rfForwardAct',
    'rfReflect',
    'tvPressure',
    'matcherDCBias',
  ]);
  // 선택한 Recipe id 목록. 비어 있으면 전체 표시, 있으면 선택한 Recipe만 그래프에 표시
  const [selectedRecipeIds, setSelectedRecipeIdsState] = useState<string[]>(() => persistedRecipeSelection);
  const setSelectedRecipeIds = (next: string[] | ((prev: string[]) => string[])) => {
    setSelectedRecipeIdsState(prev => {
      const v = typeof next === 'function' ? next(prev) : next;
      persistedRecipeSelection = v;
      return v;
    });
  };
  // 파일이 바뀌면 없어진 Recipe만 선택에서 뺌 (선택은 유지)
  useEffect(() => {
    setSelectedRecipeIds(prev => {
      const ids = new Set(files.map(f => f.id));
      const kept = prev.filter(id => ids.has(id));
      return kept.length === prev.length ? prev : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);
  const visibleFileIds = useMemo(() => {
    const sel = new Set(selectedRecipeIds);
    const out: Record<string, boolean> = {};
    files.forEach(f => {
      out[f.id] = sel.size === 0 || sel.has(f.id);
    });
    return out;
  }, [files, selectedRecipeIds]);
  const setRecipeSelected = (id: string, on: boolean) =>
    setSelectedRecipeIds(prev => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(x => x !== id)));
  const toggleRecipeSelect = (id: string) =>
    setSelectedRecipeIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  // 묶음 제목 클릭: 묶음 전체가 이미 선택돼 있으면 해제, 아니면 묶음 전체를 선택에 추가
  const toggleRecipeGroup = (ids: string[]) =>
    setSelectedRecipeIds(prev => {
      const all = ids.every(id => prev.includes(id));
      return all ? prev.filter(x => !ids.includes(x)) : [...prev, ...ids.filter(id => !prev.includes(id))];
    });
  const clearRecipeSelection = () => setSelectedRecipeIds([]);
  const [resetAllKey, setResetAllKey] = useState<number>(0);
  // 구간 통계: 한 그래프에서 고른 시간 구간을 모든 그래프에 함께 적용 [시작, 끝] (그래프 x축 기준 초)
  const [statRange, setStatRange] = useState<[number, number] | null>(null);
  const [showStepTimeline, setShowStepTimeline] = useState<boolean>(true);
  // 그래프 오른쪽 커서 값 표: 보기 방식(개별/묶어 보기)과 정렬은 모든 그래프 카드에 함께 적용
  const [valueView, setValueView] = useState<ValueView>('list');
  const [valueSort, setValueSort] = useState<ValueSort>('no');
  const [stepRefFileId, setStepRefFileId] = useState<string>(files[0]?.id || '');

  // Visible files list
  const visibleFiles = useMemo(() => {
    return files.filter(f => visibleFileIds[f.id] !== false);
  }, [files, visibleFileIds]);

  // Step 기준 Run은 Recipe 선택과 상관없이 유지 (없는 파일일 때만 첫 파일로)
  useEffect(() => {
    if (files.length > 0 && (!stepRefFileId || !files.some(f => f.id === stepRefFileId))) {
      setStepRefFileId(files[0].id);
    }
  }, [files, stepRefFileId]);

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
    setStatRange(null); // 시간 기준이 바뀌면 구간의 의미가 달라지므로 해제
  }, [timeAlignment]);

  // Reset card zoom & custom axis bounds when visible files change so charts automatically fit the newly visible recipe!
  useEffect(() => {
    setGlobalXFormat(null);
    setResetAllKey(k => k + 1);
  }, [visibleFileIds]);


  // Step reference file:
  // 1. If currently selected stepRefFileId is visible, use it.
  // 2. Otherwise use the first visible file.
  // 3. Fallback to stepRefFileId or first file.
  const refFile = useMemo(() => files.find(f => f.id === stepRefFileId) || files[0], [files, stepRefFileId]);

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
      {/* 1. Left Vertical Control Panel (그래프 분석 매니저) */}
      <aside className="w-full lg:w-[250px] shrink-0 bg-[#F1F5F9] border border-slate-400 rounded-2xl p-2.5 shadow-xs space-y-3 lg:sticky lg:top-[68px] lg:z-20 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto scrollbar-thin">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
          <span className="text-xs font-extrabold text-[#0F172A] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
            그래프 분석 매니저
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

        {/* Section 1: 그래프 배치 (한 행에 1·2·3개) */}
        <div className="space-y-1">
          <span className="text-[10.5px] font-bold text-[#334155] block">1. 그래프 배치</span>
          <div className="grid grid-cols-3 gap-1 bg-[#E2E8F0] p-0.5 rounded-xl border border-slate-300" role="radiogroup" aria-label="그래프 배치">
            {([1, 2, 3] as const).map(n => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={chartCols === n}
                onClick={() => setChartCols(n)}
                title={n === 1 ? '한 행에 그래프 1개 (가장 크게)' : `한 행에 그래프 ${n}개`}
                className={`flex items-center justify-center gap-1 px-1 py-1 text-[10.5px] font-semibold rounded-lg transition-all cursor-pointer ${
                  chartCols === n ? 'bg-white text-[#2563EB] font-bold shadow-2xs' : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <span className="flex gap-[2px]" aria-hidden="true">
                  {Array.from({ length: n }).map((_, i) => (
                    <span key={i} className={`h-2.5 rounded-[2px] ${chartCols === n ? 'bg-[#2563EB]' : 'bg-[#94A3B8]'}`} style={{ width: n === 1 ? 12 : n === 2 ? 6 : 4 }} />
                  ))}
                </span>
                {n}열
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: 시간 축 기준 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <span className="text-[10.5px] font-bold text-[#334155] block">2. 시간축 기준</span>
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

        {/* Section 3: Step 타임라인 표시 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <label htmlFor="step-timeline-toggle" className="font-bold text-[#334155] cursor-pointer select-none">
              3. Step 타임라인 표시
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

        {/* Section 4: 레시피 필터 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-bold text-[#334155]">
              4. 레시피 필터 ({selectedRecipeIds.length > 0 ? `선택 ${selectedRecipeIds.length}` : '전체'}/{files.length})
            </span>
            {selectedRecipeIds.length > 0 && (
              <button
                type="button"
                onClick={clearRecipeSelection}
                className="text-[9.5px] text-[#2563EB] font-semibold hover:underline cursor-pointer"
                title="선택을 모두 해제하고 전체 Recipe를 표시합니다"
              >
                전체 보기
              </button>
            )}
          </div>

          <div className="space-y-1 max-h-[170px] overflow-y-auto scrollbar-thin pr-0.5">
            {files.map((file, idx) => {
              const color = RECIPE_COLORS[idx % RECIPE_COLORS.length];
              const isSelected = selectedRecipeIds.includes(file.id);
              const isVisible = visibleFileIds[file.id] !== false;
              const rcpName =
                results.find(r => r.fileId === file.id)?.rcpName ||
                file.meta.recipeName ||
                file.fileName;
              const isStepRef = refFile?.id === file.id;

              return (
                <button
                  type="button"
                  key={file.id}
                  onClick={() => toggleRecipeSelect(file.id)}
                  aria-pressed={isSelected}
                  className={`w-full flex items-center justify-between gap-1 px-2 py-1 text-[10.5px] rounded-lg border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1E40AF] shadow-2xs font-bold'
                      : isVisible
                      ? 'bg-white border-slate-300 text-[#334155] font-semibold hover:border-[#2563EB]'
                      : 'bg-slate-200/60 border-slate-300 text-[#94A3B8] hover:border-[#2563EB]'
                  }`}
                  title={`${rcpName} (클릭: 선택/해제)`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isVisible ? color : '#94A3B8' }}
                    />
                    <span className="truncate">
                      #{idx + 1} {rcpName}
                    </span>
                    {isStepRef && (
                      <span className="text-[8px] bg-blue-100 text-blue-700 font-bold px-1 py-0.2 rounded shrink-0">
                        기준
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 5: 파라미터 선택 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-bold text-[#334155]">
              5. 파라미터 ({selectedMetrics.length})
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

      {/* 2. Right Chart Area (그래프 배치: 한 행에 1·2·3개) */}
      <div className="flex-1 min-w-0">
        {selectedMetrics.length === 0 ? (
          <div className="p-12 text-center text-[#64748B] bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
            선택된 파라미터가 없습니다. 좌측 제어 설정에서 그래프를 확인할 파라미터를 선택하세요.
          </div>
        ) : (
          <div
            className={`grid gap-3.5 ${
              chartCols === 1 ? 'grid-cols-1' : chartCols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {selectedMetrics.map(metricId => {
              const metric = STANDARD_METRICS.find(m => m.id === metricId);
              if (!metric) return null;
              return (
                <TrendChartCard
                  key={metric.id}
                  metric={metric}
                  chartHeight={chartCols === 1 ? 420 : 272}
                  panelBelow={chartCols === 3}
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
                  selectedRecipeIds={selectedRecipeIds}
                  onToggleRecipe={toggleRecipeSelect}
                  onSetRecipeSelected={setRecipeSelected}
                  onToggleRecipeGroup={toggleRecipeGroup}
                  onClearRecipeSelection={clearRecipeSelection}
                  statRange={statRange}
                  onSetStatRange={setStatRange}
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
  /** 그래프 높이(px): 1열 배치일 때 크게 */
  chartHeight?: number;
  /** 3열 배치: 커서 값 표를 그래프 아래로 (그래프 폭 확보) */
  panelBelow?: boolean;
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
  selectedRecipeIds: string[];
  onToggleRecipe: (id: string) => void;
  onSetRecipeSelected: (id: string, on: boolean) => void;
  onToggleRecipeGroup: (ids: string[]) => void;
  onClearRecipeSelection: () => void;
  /** 구간 통계 구간 (모든 그래프 공통) */
  statRange: [number, number] | null;
  onSetStatRange: (r: [number, number] | null) => void;
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
  /** 겹쳐 보기 항목의 값 (겹쳐 보기를 켰을 때만) */
  formatted2?: string;
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
  /** 그래프와 같은 높이(px) */
  height?: number;
  /** true = 그래프 아래 전체 폭 배치 (3열) */
  below?: boolean;
  /** 겹쳐 보기 항목 단위 (켰을 때만) */
  unit2?: string;
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
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSetSelected: (id: string, on: boolean) => void;
  onToggleGroup: (ids: string[]) => void;
  onClearSelection: () => void;
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
  height = 272,
  below = false,
  unit2,
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
  selectedIds,
  onToggle,
  onSetSelected,
  onToggleGroup,
  onClearSelection,
}) => {
  const hasSelection = selectedIds.length > 0;
  // 드래그 선택: 처음 누른 행이 선택 안 됨이면 '선택', 선택됨이면 '해제' 모드로 지나가는 행 모두 적용
  const dragModeRef = useRef<boolean | null>(null);
  useEffect(() => {
    const end = () => {
      dragModeRef.current = null;
    };
    window.addEventListener('mouseup', end);
    return () => window.removeEventListener('mouseup', end);
  }, []);
  // 모든 Recipe를 표시 (선택 안 된 Recipe는 흐리게 → 다시 클릭해 추가 가능) (커서 값이 없을 때도 행 자리를 유지)
  const rows: CursorValue[] = useMemo(() => {
    const byId = new Map((values ?? []).map(v => [v.fileId, v]));
    const list: CursorValue[] = [];
    files.forEach((file, idx) => {
      const res = results.find(r => r.fileId === file.id) || results[idx];
      const hit = visibleFileIds[file.id] === false ? undefined : byId.get(file.id);
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
  }, [files, results, visibleFileIds, values, sort, selectedIds]);
  const hiddenRows = rows.filter(v => visibleFileIds[v.fileId] === false);

  const groups = useMemo(() => groupCursorValues((values ?? []).filter(v => Number.isFinite(v.numVal))), [values]);
  const hasValues = !!values && values.length > 0;

  return (
    <div className="shrink-0 bg-white border border-slate-400 rounded-lg flex flex-col overflow-hidden" style={below ? { width: '100%', height: 150 } : { width: 160, height }} title={unit ? `단위: ${unit}` : undefined}>
      {/* 머리글: 시점 / 보기 방식 + 정렬 */}
      <div className="px-1 py-1 bg-[#E2E8F0] border-b border-slate-300 space-y-1">
        <span
          className="flex items-center gap-1 min-w-0 px-0.5 text-[10px] font-bold text-[#0F172A]"
          title={live ? '현재 커서 위치' : '마지막 커서 위치의 값을 유지하고 있습니다'}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${live ? 'bg-[#2563EB]' : 'bg-slate-400'}`} />
          <span className="truncate tabular-nums">{timeLabel ?? '커서 위치 값'}</span>
        </span>
        {/* 선택 상태 줄: 선택이 없어도 자리를 유지해 행 위치가 밀리지 않음 (드래그 선택 중 오선택 방지) */}
        <button
          type="button"
          onClick={onClearSelection}
          disabled={!hasSelection}
          className={`w-full flex items-center justify-between px-1.5 py-[1px] rounded-md border text-[9.5px] font-bold ${
            hasSelection
              ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE] cursor-pointer'
              : 'bg-transparent border-transparent text-[#94A3B8] cursor-default'
          }`}
          title={hasSelection ? '선택을 모두 해제하고 전체 Recipe를 표시합니다' : '행을 클릭하거나 누른 채 끌어서 Recipe를 선택합니다'}
        >
          {hasSelection ? (
            <>
              <span>선택 {selectedIds.length}개</span>
              <span className="flex items-center gap-0.5">
                전체 보기 <X className="w-3 h-3" />
              </span>
            </>
          ) : (
            <span>클릭·드래그로 선택</span>
          )}
        </button>
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
                const sel = selectedIds.includes(v.fileId);
                const dim = hasSelection && !sel;
                return (
                  <tr
                    key={v.fileId}
                    onMouseEnter={() => {
                      onHighlight(dim ? null : v.fileId);
                      if (dragModeRef.current !== null) onSetSelected(v.fileId, dragModeRef.current);
                    }}
                    onMouseDown={e => {
                      if (e.button !== 0) return;
                      e.preventDefault(); // 드래그 중 글자 선택 방지
                      dragModeRef.current = !sel;
                      onSetSelected(v.fileId, !sel);
                    }}
                    aria-selected={sel}
                    className={`cursor-pointer select-none ${dim ? 'opacity-45' : ''} ${
                      sel ? 'bg-[#DBEAFE]' : hi ? 'bg-[#EFF6FF]' : i % 2 ? 'bg-[#F1F5F9]' : 'bg-white'
                    }`}
                    title={`#${v.fileNo} ${v.rcpName} (클릭: ${sel ? '선택 해제' : '선택'} · 누른 채 위아래로 끌면 여러 개)`}
                  >
                    <td className="pl-1 py-[2px] border-b border-slate-200 whitespace-nowrap overflow-hidden">
                      <span className="flex items-center gap-1 min-w-0">
                        {sel ? (
                          <Check className="w-2.5 h-2.5 shrink-0 text-[#2563EB]" strokeWidth={3.5} />
                        ) : (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                        )}
                        <span className="font-bold text-[#334155] tabular-nums shrink-0">#{v.fileNo}</span>
                        <span className="font-semibold text-[#475569] truncate">{v.shortName}</span>
                      </span>
                    </td>
                    <td className="w-[68px] pr-1 py-[2px] border-b border-slate-200 text-right font-bold text-[#0F172A] tabular-nums whitespace-nowrap">
                      {v.formatted}
                      {unit && Number.isFinite(v.numVal) && (
                        <span className="ml-0.5 text-[9px] font-semibold text-[#64748B]">{unit}</span>
                      )}
                      {v.formatted2 !== undefined && (
                        <div className="text-[9.5px] leading-tight font-semibold text-[#7C3AED]" title="겹쳐 보기 항목 값">
                          {v.formatted2}
                          {unit2 && <span className="ml-0.5 text-[8.5px] text-[#8B5CF6]">{unit2}</span>}
                        </div>
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
              const ids = g.items.map(v => v.fileId);
              const allSel = ids.every(id => selectedIds.includes(id));
              return (
                <div key={gi} className="px-1 py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => onToggleGroup(ids)}
                    className={`w-full flex items-baseline justify-between gap-1 rounded px-0.5 cursor-pointer text-left ${
                      allSel && hasSelection ? 'bg-[#DBEAFE]' : 'hover:bg-[#EFF6FF]'
                    }`}
                    title={allSel && hasSelection ? '클릭: 이 묶음 선택 해제' : '클릭: 이 묶음 전체 선택'}
                  >
                    <span className="text-[12px] font-bold text-[#0F172A] tabular-nums whitespace-nowrap">
                      {lo === hiV ? hiV : `${lo} ~ ${hiV}`}
                      {unit && <span className="ml-0.5 text-[10px] font-semibold text-[#64748B]">{unit}</span>}
                    </span>
                    <span className="text-[10px] font-semibold text-[#475569] whitespace-nowrap">{g.items.length}개</span>
                  </button>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map(v => (
                      <button
                        type="button"
                        key={v.fileId}
                        onMouseEnter={() => onHighlight(v.fileId)}
                        onClick={() => onToggle(v.fileId)}
                        title={`${v.rcpName}: ${v.formatted}${unit ? ' ' + unit : ''} (클릭: 선택/해제)`}
                        className={`inline-flex items-center gap-0.5 px-1 py-[1px] max-w-full min-w-0 rounded border text-[10px] font-bold tabular-nums cursor-pointer ${
                          selectedIds.includes(v.fileId)
                            ? 'bg-[#DBEAFE] border-[#2563EB] text-[#1E3A8A]'
                            : highlightFileId === v.fileId
                            ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#1E3A8A]'
                            : 'bg-[#F8FAFC] border-slate-300 text-[#334155]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                        <span className="shrink-0">#{v.fileNo}</span>
                        <span className="font-semibold text-[#475569] truncate">{v.shortName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {hiddenRows.length > 0 && (
              <div className="px-1 py-1 space-y-0.5 bg-[#F8FAFC]">
                <div className="text-[10px] font-semibold text-[#94A3B8]">선택 안 됨 · {hiddenRows.length}개</div>
                <div className="flex flex-wrap gap-1">
                  {hiddenRows.map(v => (
                    <button
                      type="button"
                      key={v.fileId}
                      onClick={() => onToggle(v.fileId)}
                      title={`${v.rcpName} (클릭: 선택에 추가)`}
                      className="inline-flex items-center gap-0.5 px-1 py-[1px] max-w-full min-w-0 rounded border border-dashed border-slate-300 text-[10px] font-bold text-[#94A3B8] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                    >
                      <span className="shrink-0">#{v.fileNo}</span>
                      <span className="truncate">{v.shortName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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

/** 구간 통계·겹쳐 보기 값 표시: 크기에 맞춰 소수 자릿수 */
const formatStatNum = (v: number): string => {
  if (!Number.isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a >= 1000) return Math.round(v).toLocaleString();
  if (a >= 10) return (Math.round(v * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (Math.round(v * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface RangeStat {
  fileId: string;
  fileNo: number;
  name: string;
  color: string;
  n: number;
  avg: number;
  min: number;
  max: number;
  sd: number;
  unif: number | null;
}

/** 구간 [lo, hi] 안의 행으로 Run별 통계 (그래프와 같은 시간 기준: elapsedSec − RF On 기준점) */
const computeRangeStats = (
  m: MetricDefinition,
  files: ParsedLogFile[],
  results: AnalysisFileResult[],
  visibleFileIds: Record<string, boolean>,
  timeAlignment: 'elapsed' | 'rfOn',
  lo: number,
  hi: number
): RangeStat[] => {
  const out: RangeStat[] = [];
  files.forEach((file, idx) => {
    if (visibleFileIds[file.id] === false) return;
    const res = results.find(r => r.fileId === file.id) || results[idx];
    const off = timeAlignment === 'rfOn' ? getRfOnOffsetSec(file, res) : 0;
    let n = 0, sum = 0, sum2 = 0, mn = Infinity, mx = -Infinity;
    for (const r of file.rows) {
      const x = r.elapsedSec - off;
      if (x < lo - 1e-9 || x > hi + 1e-9) continue;
      const v = m.getter(r);
      if (!Number.isFinite(v)) continue;
      n++; sum += v; sum2 += v * v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (n === 0) return;
    const avg = sum / n;
    const sd = Math.sqrt(Math.max(0, sum2 / n - avg * avg));
    // Unif.% = (Max − Min) ÷ (Max + Min) × 100 (공정 종합 분석과 같은 식), 분모 0이면 평균 기준
    const unif = mx + mn !== 0 ? ((mx - mn) / Math.abs(mx + mn)) * 100 : Math.abs(avg) > 1e-9 ? ((mx - mn) / (2 * Math.abs(avg))) * 100 : null;
    out.push({
      fileId: file.id,
      fileNo: idx + 1,
      name: shortRecipeName(file.meta.recipeName || res?.rcpName || file.fileName),
      color: RECIPE_COLORS[idx % RECIPE_COLORS.length],
      n, avg, min: mn, max: mx, sd, unif,
    });
  });
  return out;
};

const TrendChartCard: React.FC<TrendChartCardProps> = ({
  metric,
  chartHeight = 272,
  panelBelow = false,
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
  selectedRecipeIds,
  onToggleRecipe,
  onSetRecipeSelected,
  onToggleRecipeGroup,
  onClearRecipeSelection,
  statRange,
  onSetStatRange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 겹쳐 보기: 두 번째 파라미터 (오른쪽 Y축, 점선)
  const [overlayId, setOverlayId] = useState<string>('');
  const overlayMetric = useMemo(() => STANDARD_METRICS.find(m => m.id === overlayId && m.id !== metric.id) ?? null, [overlayId, metric.id]);
  // 구간 선택 모드: 켜면 드래그 = 구간 선택 (꺼져 있어도 Shift+드래그로 선택)
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [rangeDraft, setRangeDraft] = useState<[number, number] | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const rangeStartRef = useRef<number>(0);
  /** 그래프 오른쪽 여백: 겹쳐 보기를 켜면 오른쪽 Y축 눈금 자리를 확보 */
  const PAD_R = overlayMetric ? 58 : 18;
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

  // 겹쳐 보기 항목의 자동 Y 범위 (오른쪽 축)
  const overlayYRange = useMemo<[number, number] | null>(() => {
    if (!overlayMetric) return null;
    let minY = Infinity;
    let maxY = -Infinity;
    files.forEach(f => {
      if (visibleFileIds[f.id] === false) return;
      f.rows.forEach(r => {
        const v = overlayMetric.getter(r);
        if (Number.isFinite(v)) {
          if (v < minY) minY = v;
          if (v > maxY) maxY = v;
        }
      });
    });
    if (minY === Infinity) return [0, 100];
    if (minY === maxY) return [minY - 1, maxY + 1];
    const pad = (maxY - minY) * 0.1;
    return [minY - pad, maxY + pad];
  }, [overlayMetric, files, visibleFileIds]);

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
      const padRight = PAD_R;
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
  }, [effectiveXRange, globalXRange, PAD_R]);

  // 2. Mouse Drag Pan Listener
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 54;
    const padRight = PAD_R;
    const plotW = rect.width - padLeft - padRight;
    if (mouseX < padLeft || mouseX > padLeft + plotW) return;

    // 구간 선택: '구간' 버튼을 켰거나 Shift를 누른 채 드래그
    if (selectMode || e.shiftKey) {
      e.preventDefault();
      const t = effectiveXRange[0] + ((mouseX - padLeft) / plotW) * (effectiveXRange[1] - effectiveXRange[0]);
      rangeStartRef.current = t;
      setRangeDraft([t, t]);
      setIsSelecting(true);
      return;
    }

    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartRangeRef.current = [...effectiveXRange];
  };

  // 구간 선택 드래그: 놓으면 0.2초 이상일 때 모든 그래프에 구간 적용
  useEffect(() => {
    if (!isSelecting) return;
    const timeAt = (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return rangeStartRef.current;
      const rect = canvas.getBoundingClientRect();
      const padLeft = 54;
      const plotW = rect.width - padLeft - PAD_R;
      const x = Math.max(padLeft, Math.min(padLeft + plotW, clientX - rect.left));
      return effectiveXRange[0] + ((x - padLeft) / plotW) * (effectiveXRange[1] - effectiveXRange[0]);
    };
    const onMove = (e: MouseEvent) => setRangeDraft([rangeStartRef.current, timeAt(e.clientX)]);
    const onUp = (e: MouseEvent) => {
      const a = rangeStartRef.current;
      const b = timeAt(e.clientX);
      const lo = Math.round(Math.min(a, b) * 10) / 10;
      const hi = Math.round(Math.max(a, b) * 10) / 10;
      if (hi - lo >= 0.2) onSetStatRange([lo, hi]);
      setRangeDraft(null);
      setIsSelecting(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isSelecting, effectiveXRange, PAD_R, onSetStatRange]);

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const padLeft = 54;
      const padRight = PAD_R;
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
    const padRight = PAD_R;
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

          let formatted2: string | undefined;
          if (overlayMetric) {
            const y2 = overlayMetric.getter(closestRow);
            formatted2 = Number.isFinite(y2) ? formatStatNum(y2) : '-';
          }
          fileValues.push({
            shortName: shortRecipeName(file.meta.recipeName || rcpName),
            fileId: file.id,
            fileIdx,
            fileNo: fileIdx + 1,
            rcpName,
            color,
            formatted,
            numVal: yVal,
            formatted2,
          });
        }
      }
    });

    return {
      timeFormatted: `${t.toFixed(1)}`,
      fileValues,
      stepStr,
    };
  }, [effectiveXRange, alignedSteps, files, results, visibleFileIds, timeAlignment, metric, overlayMetric]);

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
    const height = chartHeight; // 기본 272px, 1열 배치는 더 크게 (오른쪽 값 표와 같은 높이)
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
    const padRight = PAD_R;
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

    // 구간 통계 구간 (선택 중이면 드래그 중인 구간) — 선 아래에 옅은 호박색 띠
    const bandRange = rangeDraft ?? statRange;
    if (bandRange) {
      const b0 = Math.min(bandRange[0], bandRange[1]);
      const b1 = Math.max(bandRange[0], bandRange[1]);
      const x0 = mapX(b0);
      const x1 = mapX(b1);
      ctx.save();
      ctx.fillStyle = rangeDraft ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)';
      ctx.fillRect(x0, padTop, Math.max(1, x1 - x0), plotH);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([]);
      [x0, x1].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, padTop);
        ctx.lineTo(Math.round(x) + 0.5, padTop + plotH);
        ctx.stroke();
      });
      ctx.restore();
    }

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

    // 겹쳐 보기 항목: 같은 Run 색의 점선, 오른쪽 Y축 기준
    const ov = overlayMetric && overlayYRange ? { m: overlayMetric, lo: overlayYRange[0], hi: overlayYRange[1] } : null;
    if (ov) {
      const span2 = Math.max(1e-9, ov.hi - ov.lo);
      const mapY2 = (y: number) => padTop + plotH - ((y - ov.lo) / span2) * plotH;
      files.forEach((file, idx) => {
        if (visibleFileIds[file.id] === false) return;
        const res = results.find(r => r.fileId === file.id) || results[idx];
        const off = timeAlignment === 'rfOn' ? getRfOnOffsetSec(file, res) : 0;
        const isDim = highlightFileId !== null && highlightFileId !== file.id;
        ctx.save();
        ctx.globalAlpha = isDim ? 0.2 : 0.95;
        ctx.strokeStyle = RECIPE_COLORS[idx % RECIPE_COLORS.length];
        ctx.lineWidth = highlightFileId === file.id ? 2.4 : 1.6;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        let started = false;
        const marginX = Math.max(1.0, spanX * 0.05);
        file.rows.forEach(r => {
          const x = r.elapsedSec - off;
          if (x < minX - marginX || x > maxX + marginX) { started = false; return; }
          const y = ov.m.getter(r);
          if (!Number.isFinite(y)) { started = false; return; }
          const px = mapX(x);
          const py = mapY2(y);
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      });
    }

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

    // 겹쳐 보기 오른쪽 Y축 눈금 + 단위
    if (ov) {
      const span2 = Math.max(1e-9, ov.hi - ov.lo);
      ctx.save();
      ctx.font = FONT_NUM;
      ctx.fillStyle = '#6D28D9';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let k = 0; k <= 4; k++) {
        const v = ov.lo + (span2 * k) / 4;
        const y = padTop + plotH - (plotH * k) / 4;
        ctx.strokeStyle = '#A78BFA';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft + plotW, Math.round(y) + 0.5);
        ctx.lineTo(padLeft + plotW + 3, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.fillText(formatStatNum(v).replace(/\.0+$/, ''), padLeft + plotW + 5, Math.round(y));
      }
      ctx.font = FONT_LABEL;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const fullLabel = `점선: ${ov.m.name} [${ov.m.unit}]`;
      ctx.fillText(ctx.measureText(fullLabel).width > plotW * 0.55 ? `점선: [${ov.m.unit}]` : fullLabel, padLeft + plotW + PAD_R - 2, padTop - 5);
      ctx.restore();
    }

    // 구간 길이 표시 (띠 위쪽)
    const bandR = rangeDraft ?? statRange;
    if (bandR) {
      const b0 = Math.max(minX, Math.min(bandR[0], bandR[1]));
      const b1 = Math.min(maxX, Math.max(bandR[0], bandR[1]));
      if (b1 > b0) {
        const label = `구간 ${Math.abs(bandR[1] - bandR[0]).toFixed(1)}s`;
        ctx.save();
        ctx.font = FONT_TAG;
        const lw = ctx.measureText(label).width;
        const cx = Math.max(padLeft + lw / 2 + 4, Math.min(padLeft + plotW - lw / 2 - 4, (mapX(b0) + mapX(b1)) / 2));
        ctx.fillStyle = 'rgba(255, 251, 235, 0.95)';
        ctx.fillRect(Math.round(cx - lw / 2 - 4), padTop + 2, Math.round(lw + 8), 14);
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(cx - lw / 2 - 4) + 0.5, padTop + 2.5, Math.round(lw + 8), 14);
        ctx.fillStyle = '#92400E';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, Math.round(cx), padTop + 9.5);
        ctx.restore();
      }
    }

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
    chartHeight,
    overlayMetric,
    overlayYRange,
    statRange,
    rangeDraft,
    PAD_R,
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

        {/* Action Buttons: 겹쳐 보기 + 구간 + 줌 리셋 + 축 서식 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 겹쳐 보기: 두 번째 파라미터 (오른쪽 Y축, 점선) */}
          <span className="relative">
            <select
              aria-label="겹쳐 보기"
              value={overlayMetric ? overlayMetric.id : ''}
              onChange={e => setOverlayId(e.target.value)}
              className={`appearance-none max-w-[118px] pl-1.5 pr-4 py-0.5 text-[10px] font-semibold rounded-lg border shadow-2xs cursor-pointer focus:outline-none ${
                overlayMetric ? 'bg-[#F5F3FF] border-[#A78BFA] text-[#6D28D9]' : 'bg-white border-slate-300 text-[#0F172A] hover:bg-slate-100'
              }`}
              title={overlayMetric ? `겹쳐 보기: ${overlayMetric.name} (오른쪽 축, 점선)` : '다른 파라미터를 오른쪽 축에 점선으로 겹쳐 보기'}
            >
              <option value="">겹쳐 보기</option>
              {STANDARD_METRICS.filter(m => m.id !== metric.id).map(m => (
                <option key={m.id} value={m.id}>
                  + {m.name} [{m.unit}]
                </option>
              ))}
            </select>
            <ChevronDown className={`w-3 h-3 absolute right-1 top-[5px] pointer-events-none ${overlayMetric ? 'text-[#7C3AED]' : 'text-[#94A3B8]'}`} />
          </span>
          {overlayMetric && (
            <button
              type="button"
              onClick={() => setOverlayId('')}
              className="p-0.5 rounded text-[#7C3AED] hover:bg-[#EDE9FE] cursor-pointer"
              title="겹쳐 보기 끄기"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {/* 구간 선택 모드 */}
          <button
            type="button"
            onClick={() => setSelectMode(v => !v)}
            aria-pressed={selectMode}
            className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-lg border shadow-2xs cursor-pointer transition-all ${
              selectMode ? 'bg-[#F59E0B] border-[#D97706] text-white' : 'bg-white border-slate-300 text-[#0F172A] hover:bg-slate-100'
            }`}
            title="켜면 그래프를 드래그해 구간을 고릅니다 (꺼져 있어도 Shift+드래그). 고른 구간은 모든 그래프에 적용되고 아래에 구간 통계가 나옵니다."
          >
            <Ruler className="w-3 h-3" />
            구간
          </button>
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
          간격: {axisConfig.xStep || 10}s · 휠: 줌 · {selectMode ? '드래그: 구간 선택' : '드래그: 이동 · Shift+드래그: 구간'}
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
      <div className={`p-2 bg-[#EEF2F6] flex-1 flex ${panelBelow ? 'flex-col' : ''} items-stretch gap-1.5 relative`} style={{ minHeight: chartHeight }}>
        <div ref={plotWrapRef} className="flex-1 min-w-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleResetCard}
          style={{ imageRendering: 'auto' }}
          className={`w-full block ${
            isSelecting || selectMode
              ? 'cursor-col-resize'
              : isDragging
              ? 'cursor-grabbing'
              : isCustomOrZoomed
              ? 'cursor-grab'
              : 'cursor-crosshair'
          }`}
          title={selectMode ? '드래그: 구간 선택 (모든 그래프에 적용) | 마우스 휠: 확대/축소 | 더블클릭: 줌 초기화' : '마우스 휠: 개별 확대/축소 | 좌클릭 드래그: 개별 좌우 이동 | Shift+드래그: 구간 선택 | 더블클릭: 줌 초기화'}
        />
        </div>

        <CursorValuePanel
          height={chartHeight}
          below={panelBelow}
          unit2={overlayMetric?.unit}
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
          selectedIds={selectedRecipeIds}
          onToggle={onToggleRecipe}
          onSetSelected={onSetRecipeSelected}
          onToggleGroup={onToggleRecipeGroup}
          onClearSelection={onClearRecipeSelection}
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

      {/* 5. 구간 통계 (모든 그래프 공통 구간) */}
      {statRange && (
        <RangeStatsTable
          range={statRange}
          sections={[
            { metric, stats: computeRangeStats(metric, files, results, visibleFileIds, timeAlignment, statRange[0], statRange[1]) },
            ...(overlayMetric
              ? [{ metric: overlayMetric, stats: computeRangeStats(overlayMetric, files, results, visibleFileIds, timeAlignment, statRange[0], statRange[1]), overlay: true }]
              : []),
          ]}
          highlightFileId={highlightFileId}
          onHighlight={setHighlightFileId}
          onClear={() => onSetStatRange(null)}
        />
      )}
    </div>
  );
};

/** 그래프 아래 구간 통계 표: Run별 평균·최소·최대·Max−Min·σ·Unif.·행 수 (겹쳐 보기 항목은 아래 묶음) */
const RangeStatsTable: React.FC<{
  range: [number, number];
  sections: { metric: MetricDefinition; stats: RangeStat[]; overlay?: boolean }[];
  highlightFileId: string | null;
  onHighlight: (id: string | null) => void;
  onClear: () => void;
}> = ({ range, sections, highlightFileId, onHighlight, onClear }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const head = ['항목', 'No.', 'Run', '평균', '최소', '최대', 'Max-Min', 'σ', 'Unif.(%)', '행 수'];
    const lines = [`구간\t${range[0].toFixed(1)} ~ ${range[1].toFixed(1)} s (${(range[1] - range[0]).toFixed(1)} s)`, head.join('\t')];
    sections.forEach(sec =>
      sec.stats.forEach(st =>
        lines.push(
          [
            `${sec.metric.name} [${sec.metric.unit}]`,
            st.fileNo,
            st.name,
            formatStatNum(st.avg),
            formatStatNum(st.min),
            formatStatNum(st.max),
            formatStatNum(st.max - st.min),
            formatStatNum(st.sd),
            st.unif === null ? '-' : st.unif.toFixed(2),
            st.n,
          ].join('\t')
        )
      )
    );
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 사용 불가 환경 */
    }
  };
  const th = 'px-1 py-[3px] border border-slate-300 bg-[#E2E8F0] text-[#334155] font-bold whitespace-nowrap text-center align-middle';
  const td = 'px-1 py-[2px] border border-slate-200 tabular-nums text-center align-middle whitespace-nowrap';
  return (
    <div className="border-t border-slate-300 bg-white" data-range-stats onMouseLeave={() => onHighlight(null)}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-[#FFFBEB] border-b border-[#FDE68A] text-[10.5px]">
        <span className="flex items-center gap-1.5 min-w-0">
          <Ruler className="w-3 h-3 text-[#D97706] shrink-0" />
          <span className="font-bold text-[#92400E] whitespace-nowrap">구간 통계</span>
          <span className="font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
            {range[0].toFixed(1)} ~ {range[1].toFixed(1)} s
          </span>
          <span className="text-[#B45309] tabular-nums whitespace-nowrap">({(range[1] - range[0]).toFixed(1)} s)</span>
          <span className="text-[9.5px] text-[#94A3B8] truncate hidden md:inline">· 모든 그래프에 같은 구간</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] font-semibold text-[#2563EB] hover:border-[#2563EB] cursor-pointer"
            title="엑셀에 붙여 넣을 수 있게 표 복사"
          >
            <Copy className="w-3 h-3" />
            {copied ? '복사됨' : '복사'}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] font-semibold text-[#475569] hover:text-[#DC2626] hover:border-[#FCA5A5] cursor-pointer"
            title="구간 해제 (모든 그래프)"
          >
            <X className="w-3 h-3" />
            해제
          </button>
        </span>
      </div>
      <div className="max-h-[220px] overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-[10.5px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${th} text-left pl-2`}>Run</th>
              <th className={th}>평균</th>
              <th className={th}>최소</th>
              <th className={th}>최대</th>
              <th className={th}>Max−Min</th>
              <th className={th}>σ</th>
              <th className={th}>Unif.(%)</th>
              <th className={th}>행 수</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(sec => (
              <React.Fragment key={sec.metric.id}>
                {sections.length > 1 && (
                  <tr>
                    <td
                      colSpan={8}
                      className={`px-2 py-[2px] border border-slate-200 font-bold text-[10px] ${sec.overlay ? 'bg-[#F5F3FF] text-[#6D28D9]' : 'bg-[#EFF6FF] text-[#1E3A8A]'}`}
                    >
                      {sec.overlay ? '점선 · ' : '실선 · '}
                      {sec.metric.name} [{sec.metric.unit}]
                    </td>
                  </tr>
                )}
                {sec.stats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`${td} text-[#94A3B8]`}>
                      이 구간에 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  sec.stats.map((st, i) => (
                    <tr
                      key={st.fileId}
                      onMouseEnter={() => onHighlight(st.fileId)}
                      className={highlightFileId === st.fileId ? 'bg-[#EFF6FF]' : i % 2 ? 'bg-[#F8FAFC]' : 'bg-white'}
                    >
                      <td className={`${td} text-left pl-2 max-w-[150px] overflow-hidden`}>
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                          <span className="font-bold text-[#334155] shrink-0">#{st.fileNo}</span>
                          <span className="font-semibold text-[#475569] truncate">{st.name}</span>
                        </span>
                      </td>
                      <td className={`${td} font-bold text-[#0F172A]`}>{formatStatNum(st.avg)}</td>
                      <td className={td}>{formatStatNum(st.min)}</td>
                      <td className={td}>{formatStatNum(st.max)}</td>
                      <td className={`${td} font-semibold`}>{formatStatNum(st.max - st.min)}</td>
                      <td className={td}>{formatStatNum(st.sd)}</td>
                      <td className={td}>{st.unif === null ? '-' : st.unif.toFixed(2)}</td>
                      <td className={`${td} text-[#64748B]`}>{st.n.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
