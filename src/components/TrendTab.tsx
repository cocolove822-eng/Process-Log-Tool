import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RefreshCw, Eye, EyeOff, SlidersHorizontal, Check, Globe, Layers, ChevronDown, ChevronUp, X } from 'lucide-react';
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

        {/* Section 1-2: Step 타임라인 설정 */}
        <div className="space-y-1.5 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-bold text-[#334155] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
              Step 타임라인
            </span>
            <label className="flex items-center gap-1 text-[10px] text-[#334155] font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showStepTimeline}
                onChange={e => setShowStepTimeline(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-400 text-[#2563EB] focus:ring-0 cursor-pointer"
              />
              <span>표시</span>
            </label>
          </div>

          {showStepTimeline && (
            <div className="p-1.5 bg-[#E2E8F0] rounded-xl border border-slate-300 space-y-1 text-[10px]">
              <div className="flex items-center justify-between text-[#475569]">
                <span>스텝 수:</span>
                <span className="font-mono font-bold text-[#0F172A]">{alignedSteps.length}개 Step</span>
              </div>
              {files.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[#64748B] font-medium">기준 Run:</span>
                    {refFile && (
                      <span className="text-[9px] font-mono text-[#2563EB] font-bold">
                        {alignedSteps.length}개 Step
                      </span>
                    )}
                  </div>
                  <select
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
                          #{idx + 1} {rcpName} {!isVis ? '(숨김)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: 레시피 필터 */}
        <div className="space-y-1 pt-1 border-t border-slate-300">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-bold text-[#334155]">
              2. 레시피 필터 ({files.filter(f => visibleFileIds[f.id] !== false).length}/{files.length})
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
              3. 파라미터 ({selectedMetrics.length})
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
}

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
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setHoverTime(null);
    }
  };

  // Docked hover information calculation (방안 A: 상단 고정 도킹형 상태바)
  const hoverInfo = useMemo(() => {
    if (hoverTime === null || hoverTime < effectiveXRange[0] || hoverTime > effectiveXRange[1]) {
      return null;
    }

    // 1. Current active Step at hover timestamp: "Step 4(SIN)"
    const curStep = alignedSteps.find(s => hoverTime >= s.alignedStart && hoverTime <= s.alignedEnd);
    const stepStr = curStep
      ? (curStep.stepName ? `Step ${curStep.step}(${curStep.stepName})` : `Step ${curStep.step}`)
      : '';

    // 2. Y-values across visible files at hover timestamp
    const visibleFiles = files.filter(f => visibleFileIds[f.id] !== false);
    const fileValues: {
      fileIdx: number;
      fileNo: number;
      rcpName: string;
      color: string;
      formatted: string;
      numVal: number;
    }[] = [];

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

          const rcpName = res?.rcpName || file.meta.recipeName || file.fileName;

          fileValues.push({
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
      timeFormatted: `${hoverTime.toFixed(1)}`,
      fileValues,
      stepStr,
    };
  }, [hoverTime, effectiveXRange, alignedSteps, files, results, visibleFileIds, timeAlignment, metric]);

  // 3. Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 450;
    const height = 240; // Proportioned height for 2-column view
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
    const stepMultiplier = tickCount > 30 ? Math.ceil(tickCount / 20) : 1;
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

    // Plot series for each visible file
    files.forEach((file, idx) => {
      if (visibleFileIds[file.id] === false) return;
      const color = RECIPE_COLORS[idx % RECIPE_COLORS.length];
      const res = results.find(r => r.fileId === file.id) || results[idx];
      const tOnOffset = timeAlignment === 'rfOn' ? getRfOnOffsetSec(file, res) : 0;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
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

        // Top mini step tag inside canvas plot area
        const visS = Math.max(minX, step.alignedStart);
        const visE = Math.min(maxX, step.alignedEnd);
        if (visE > minX && visS < maxX) {
          const px0 = mapX(visS);
          const px1 = mapX(visE);
          const stepW = px1 - px0;
          if (stepW > 28) {
            ctx.save();
            ctx.font = FONT_TAG;
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const tagLabel = stepW > 64 ? `S${step.step} ${step.stepName}` : `S${step.step}`;
            ctx.fillText(tagLabel, Math.round(px0 + 5), padTop + 4);
            ctx.restore();
          }
        }
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
  }, [
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
        <div className="bg-[#EAEFF5] border-b border-slate-300 px-2 py-1 flex items-center select-none">
          {/* Left label width exactly matching canvas padLeft (52px) */}
          <div
            className="w-[52px] shrink-0 flex items-center gap-1 text-[9px] font-bold text-[#334155] pr-1"
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

          {/* Step track matching plot canvas width (padLeft: 52px, padRight: 18px) */}
          <div className="flex-1 relative h-[21px] rounded overflow-hidden bg-slate-300/60 border border-slate-400 mr-[10px]">
            {alignedSteps.map(step => {
              const [minX, maxX] = effectiveXRange;
              const spanX = Math.max(0.1, maxX - minX);
              const visStart = Math.max(minX, step.alignedStart);
              const visEnd = Math.min(maxX, step.alignedEnd);
              if (visEnd <= minX || visStart >= maxX) return null;

              const leftPct = ((visStart - minX) / spanX) * 100;
              const widthPct = Math.max(0.4, ((visEnd - visStart) / spanX) * 100);
              const palette = STEP_PALETTE[(step.step - 1) % STEP_PALETTE.length];

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
                  className={`absolute top-0 bottom-0 flex items-center justify-center border-r transition-all cursor-pointer hover:brightness-95 active:scale-[0.99] ${palette.badgeClass}`}
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

      {/* 2-2. Docked Hover Info Bar (방안 A: 상단 고정 도킹형 상태바 - 화이트톤 테마) */}
      <div
        className={`px-3 py-1.5 border-b transition-colors flex items-center justify-between text-xs select-none min-h-[30px] ${
          hoverInfo
            ? 'bg-white border-blue-300 text-slate-800 shadow-2xs'
            : 'bg-[#F8FAFC] border-slate-300 text-slate-600'
        }`}
      >
        {hoverInfo ? (
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* 1. Time */}
            <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-mono tracking-tight shrink-0 shadow-2xs">
              {hoverInfo.timeFormatted}
            </span>

            <span className="text-slate-300 font-bold shrink-0">|</span>

            {/* 2. Y축 수치 */}
            {hoverInfo.fileValues.length > 0 ? (
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {hoverInfo.fileValues.map(fv => (
                  <div
                    key={fv.fileNo}
                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800 shadow-2xs"
                    title={fv.rcpName}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: fv.color }} />
                    {hoverInfo.fileValues.length > 1 && (
                      <span className="text-slate-500 font-mono text-[10px]">#{fv.fileNo}</span>
                    )}
                    <span className="font-bold text-slate-900 font-mono">{fv.formatted}</span>
                    {metric.unit && <span className="text-slate-500 text-[10px] font-medium">{metric.unit}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 text-[11px] font-mono">--</span>
            )}

            {/* 3. Step */}
            {hoverInfo.stepStr && (
              <>
                <span className="text-slate-300 font-bold shrink-0">|</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-[11px] shrink-0 shadow-2xs">
                  {hoverInfo.stepStr}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
            <span>마우스 커서를 그래프 위에 올리면 실시간 시점(s), Y축 수치, Step 정보가 상단에 고정 표시됩니다</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-[10px] font-mono shrink-0 ml-2">
          {hoverInfo ? (
            <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1 text-[10px] font-medium shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              실시간 커서
            </span>
          ) : (
            <span className="text-slate-500 hidden sm:inline">
              단위: [{metric.unit}]
            </span>
          )}
        </div>
      </div>

      {/* 3. Canvas Area */}
      <div className="p-2 bg-[#EEF2F6] flex-1 flex items-center justify-center relative min-h-[240px]">
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

        {/* 4. Excel-Style [축 서식] Clean Overlay Modal */}
        {isFormatOpen && (
          <div className="absolute inset-2 z-30 bg-white/98 backdrop-blur-md p-3.5 flex flex-col justify-between overflow-y-auto rounded-xl shadow-lg border border-[#2563EB]/40 animate-in fade-in zoom-in-95 duration-100">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB]">
                    <SlidersHorizontal className="w-3 h-3" />
                  </div>
                  <h4 className="text-xs font-bold text-[#0F172A]">축 서식</h4>
                  <span className="text-[10px] text-[#64748B]">({metric.name})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormatOpen(false)}
                  className="p-1 rounded text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-100 text-xs font-bold cursor-pointer"
                  title="닫기"
                >
                  ✕
                </button>
              </div>

              {/* Excel Style Tabs: 가로 축 (X) vs 세로 축 (Y) */}
              <div className="grid grid-cols-2 gap-1 bg-[#F1F5F9] p-0.5 rounded-lg text-[11px] font-semibold my-2">
                <button
                  type="button"
                  onClick={() => setFormatTab('x')}
                  className={`py-1 rounded text-center transition-all cursor-pointer ${
                    formatTab === 'x'
                      ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  가로(시간) 축 옵션 [X]
                </button>
                <button
                  type="button"
                  onClick={() => setFormatTab('y')}
                  className={`py-1 rounded text-center transition-all cursor-pointer ${
                    formatTab === 'y'
                      ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  세로(값) 축 옵션 [Y]
                </button>
              </div>

              {/* Form Content: X-Axis Options (Excel 1:1) */}
              {formatTab === 'x' && (
                <div className="space-y-3 text-[11px] py-1">
                  {/* 1. 경계 (Bounds) */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-[#0F172A] block text-[10.5px]">경계 (Time sec)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">최소값</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            value={axisConfig.xMin !== null ? axisConfig.xMin : autoMinX}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, xMin: isNaN(v) ? null : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, xMin: null }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="자동 계산 최소값으로 복원"
                          >
                            다시 설정
                          </button>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">최대값</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            value={axisConfig.xMax !== null ? axisConfig.xMax : autoMaxX}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, xMax: isNaN(v) ? null : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, xMax: null }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="자동 계산 최대값으로 복원"
                          >
                            다시 설정
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. 단위 (Units) - 주 단위 & 보조 단위 */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="font-bold text-[#0F172A] block text-[10.5px]">단위 (Time Unit)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">주 눈금 간격 (초)</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={axisConfig.xStep !== null ? axisConfig.xStep : 10.0}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, xStep: isNaN(v) || v <= 0 ? 10.0 : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, xStep: 10.0 }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="기본 10.0초 간격으로 복원"
                          >
                            10초
                          </button>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">보조 눈금 간격 (초)</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            min="0.5"
                            placeholder="자동 (5초)"
                            value={axisConfig.xMinorStep !== null ? axisConfig.xMinorStep : ''}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, xMinorStep: isNaN(v) || v <= 0 ? null : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, xMinorStep: null }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="자동 보조 간격으로 복원"
                          >
                            자동
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. 눈금선 및 틱 (Lines & Ticks) */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="font-bold text-[#0F172A] block text-[10.5px]">눈금선 및 축 틱 (Lines & Ticks)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={axisConfig.showVGrid}
                          onChange={e => setAxisConfig(prev => ({ ...prev, showVGrid: e.target.checked }))}
                          className="rounded accent-[#2563EB]"
                        />
                        <span>주 세로 눈금선(Grid)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={axisConfig.showVMinorGrid}
                          onChange={e => setAxisConfig(prev => ({ ...prev, showVMinorGrid: e.target.checked }))}
                          className="rounded accent-[#2563EB]"
                        />
                        <span>보조 세로 눈금선(점선)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={axisConfig.showTickMarks}
                          onChange={e => setAxisConfig(prev => ({ ...prev, showTickMarks: e.target.checked }))}
                          className="rounded accent-[#2563EB]"
                        />
                        <span>축 경계 눈금 틱(Ticks)</span>
                      </label>
                    </div>
                  </div>

                  {/* 4. 일괄 적용 버튼 */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
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
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE] rounded text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                      title="현재 설정된 시간축 범위 및 간격을 모든 그래프에 일괄 적용합니다"
                    >
                      {justAppliedToAll ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">전체 적용 완료!</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 text-[#2563EB]" />
                          <span>전체 그래프 시간축 일괄 적용</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Form Content: Y-Axis Options (Excel 1:1) */}
              {formatTab === 'y' && (
                <div className="space-y-3 text-[11px] py-1">
                  {/* 1. 경계 (Bounds) */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-[#0F172A] block text-[10.5px]">
                      경계 ({metric.unit})
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">최소값</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            value={axisConfig.yMin !== null ? axisConfig.yMin : autoMinY}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, yMin: isNaN(v) ? null : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, yMin: null }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="데이터 자동 최소값으로 복원"
                          >
                            다시 설정
                          </button>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">최대값</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            value={axisConfig.yMax !== null ? axisConfig.yMax : autoMaxY}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, yMax: isNaN(v) ? null : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, yMax: null }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="데이터 자동 최대값으로 복원"
                          >
                            다시 설정
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. 단위 (Units) - 주 단위 & 보조 단위 */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="font-bold text-[#0F172A] block text-[10.5px]">단위 ({metric.unit})</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">주 눈금 간격</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            placeholder="자동"
                            value={axisConfig.yStep !== null ? axisConfig.yStep : ''}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, yStep: isNaN(v) || v <= 0 ? null : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, yStep: null }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="자동 간격으로 복원"
                          >
                            자동
                          </button>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">보조 눈금 간격</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            placeholder="자동"
                            value={axisConfig.yMinorStep !== null ? axisConfig.yMinorStep : ''}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setAxisConfig(prev => ({ ...prev, yMinorStep: isNaN(v) || v <= 0 ? null : v }));
                            }}
                            className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={() => setAxisConfig(prev => ({ ...prev, yMinorStep: null }))}
                            className="px-1.5 py-0.5 text-[9.5px] border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded text-[#475569] shrink-0 font-medium cursor-pointer"
                            title="자동 보조 간격으로 복원"
                          >
                            자동
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. 스케일 및 표시 형식 (Scale & Format) */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="font-bold text-[#0F172A] block text-[10.5px]">스케일 및 표시 형식 (Scale & Format)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">로그 눈금 (Log₁₀)</span>
                        <label className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#CBD5E1] rounded cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={axisConfig.isLogScale}
                            onChange={e => setAxisConfig(prev => ({ ...prev, isLogScale: e.target.checked }))}
                            className="rounded accent-[#2563EB]"
                          />
                          <span className="font-medium text-[#0F172A]">로그 스케일</span>
                        </label>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">소수점 자릿수</span>
                        <select
                          value={axisConfig.decimalPlaces}
                          onChange={e => {
                            const val = e.target.value;
                            setAxisConfig(prev => ({
                              ...prev,
                              decimalPlaces: val === 'auto' ? 'auto' : (parseInt(val, 10) as 0 | 1 | 2),
                            }));
                          }}
                          className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-1 text-[10.5px] font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                        >
                          <option value="auto">자동 판별</option>
                          <option value="0">정수 (0자리)</option>
                          <option value="1">소수점 1자리</option>
                          <option value="2">소수점 2자리</option>
                        </select>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#64748B]">표시 단위 축약</span>
                        <select
                          value={axisConfig.displayUnit}
                          onChange={e => {
                            setAxisConfig(prev => ({
                              ...prev,
                              displayUnit: e.target.value as 'auto' | 'k',
                            }));
                          }}
                          className="w-full bg-white border border-[#CBD5E1] rounded px-1.5 py-1 text-[10.5px] font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                        >
                          <option value="auto">원래 값</option>
                          <option value="k">천 단위 (k)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 4. 기준선 및 눈금선 (Lines & Target) */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="font-bold text-[#0F172A] block text-[10.5px]">기준선 및 눈금선 (Lines & Target)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={axisConfig.showHGrid}
                          onChange={e => setAxisConfig(prev => ({ ...prev, showHGrid: e.target.checked }))}
                          className="rounded accent-[#2563EB]"
                        />
                        <span>주 가로 눈금선(Grid)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={axisConfig.showHMinorGrid}
                          onChange={e => setAxisConfig(prev => ({ ...prev, showHMinorGrid: e.target.checked }))}
                          className="rounded accent-[#2563EB]"
                        />
                        <span>보조 가로 눈금선(점선)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={axisConfig.showZeroBaseline}
                          onChange={e => setAxisConfig(prev => ({ ...prev, showZeroBaseline: e.target.checked }))}
                          className="rounded accent-[#2563EB]"
                        />
                        <span>0.0 기준선 강조</span>
                      </label>
                    </div>

                    {/* 공정 목표/스펙 기준선 (Target Line) */}
                    <div className="pt-1">
                      <span className="text-[10px] text-[#64748B] block mb-0.5">공정 목표/스펙 기준선 (Target Line)</span>
                      <div className="flex items-center gap-1 max-w-[280px]">
                        <input
                          type="number"
                          step="any"
                          placeholder="예: 4700"
                          value={axisConfig.targetLine !== null ? axisConfig.targetLine : ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            setAxisConfig(prev => ({ ...prev, targetLine: isNaN(v) ? null : v }));
                          }}
                          className="w-full bg-white border border-[#FDBA74] rounded px-1.5 py-0.5 text-xs font-mono font-bold text-[#C2410C] focus:outline-none focus:border-[#EA580C]"
                        />
                        <button
                          type="button"
                          onClick={() => setAxisConfig(prev => ({ ...prev, targetLine: null }))}
                          className="px-2 py-0.5 text-[9.5px] border border-orange-200 bg-orange-50 hover:bg-orange-100 rounded text-orange-700 shrink-0 font-medium cursor-pointer"
                          title="기준선 제거"
                        >
                          지우기
                        </button>
                      </div>
                      <span className="text-[9px] text-[#94A3B8] block mt-0.5">
                        수치를 입력하면 차트에 주황색 목표 점선 및 배지가 오버레이됩니다.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetCard}
                className="text-[10.5px] text-[#64748B] hover:text-[#DC2626] font-medium cursor-pointer"
              >
                기본값 복원
              </button>

              <button
                type="button"
                onClick={() => setIsFormatOpen(false)}
                className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
