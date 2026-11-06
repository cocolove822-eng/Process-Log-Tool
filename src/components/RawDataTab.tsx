import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  AlertTriangle,
  Layers,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
} from 'lucide-react';
import { AnalysisFileResult, HeaterChannelDef, ParsedLogFile, RawLogRow } from '../types/pecvd';
import { resolveDynamicHeaterChannels } from '../utils/csvParser';

interface RawDataTabProps {
  files: ParsedLogFile[];
  results?: AnalysisFileResult[];
  selectedRunIdx?: number | null;
}

interface GasDef {
  key: string;
  name: string;
  setGetter: (r: RawLogRow) => number;
  actGetter: (r: RawLogRow) => number;
  unit: string;
}

const CANDIDATE_GASES: GasDef[] = [
  { key: 'pyroSiH4', name: 'SiH4', setGetter: r => r.pyroSiH4Set, actGetter: r => r.pyroSiH4, unit: 'sccm' },
  { key: 'pyroN2O', name: 'N2O', setGetter: r => r.pyroN2OSet, actGetter: r => r.pyroN2O, unit: 'sccm' },
  { key: 'pyroNH3', name: 'NH3', setGetter: r => r.pyroNH3Set, actGetter: r => r.pyroNH3, unit: 'sccm' },
  { key: 'pyroPN2', name: 'PN2', setGetter: r => r.pyroPN2Set, actGetter: r => r.pyroPN2, unit: 'sccm' },
  { key: 'pyroAr', name: 'Ar', setGetter: r => r.pyroArSet, actGetter: r => r.pyroAr, unit: 'sccm' },
  { key: 'pyroH2', name: 'H2', setGetter: r => r.pyroH2Set, actGetter: r => r.pyroH2, unit: 'sccm' },
  { key: 'oxyNF3', name: 'Oxy.NF3', setGetter: r => r.oxyNF3Set, actGetter: r => r.oxyNF3, unit: 'sccm' },
  { key: 'oxyAr', name: 'Oxy.Ar', setGetter: r => r.oxyArSet, actGetter: r => r.oxyAr, unit: 'sccm' },
];

const ROW_HEIGHT = 30; // Pixel-precise row height
const OVERSCAN = 25;   // Pre-rendered buffer rows above & below viewport for 60fps scrolling

// ============================================================================
// [공정 종합 분석] 100% 동일한 삼성/SK하이닉스 실무 엔지니어링 엑셀 그리드 스타일 상수
// ============================================================================
const TINT_FIXED_TH1 = 'py-1 px-1 border border-slate-400 bg-[#CBD5E1] text-[#0F172A] font-bold text-[11px] font-sans align-middle';
const TINT_FIXED_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#DDE3EA] text-[#0F172A] font-bold text-[11px] font-sans align-middle';

const TINT_RF_TH1 = 'py-1 px-1 border border-slate-400 bg-[#C2D7EF] text-[#1E3A8A] font-bold text-[11px] font-sans align-middle';
const TINT_RF_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#D7E5F4] text-[#1E3A8A] font-bold text-[11px] font-sans align-middle';

const TINT_MATCHER_TH1 = 'py-1 px-1 border border-slate-400 bg-[#C1E2D4] text-[#065F46] font-bold text-[11px] font-sans align-middle';
const TINT_MATCHER_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#D8EDE4] text-[#065F46] font-bold text-[11px] font-sans align-middle';

const TINT_PRES_TH1 = 'py-1 px-1 border border-slate-400 bg-[#C6E1DB] text-[#115E59] font-bold text-[11px] font-sans align-middle';
const TINT_PRES_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#DBECE7] text-[#115E59] font-bold text-[11px] font-sans align-middle';

const TINT_LIFT_TH1 = 'py-1 px-1 border border-slate-400 bg-[#D9D7F1] text-[#3730A3] font-bold text-[11px] font-sans align-middle';
const TINT_LIFT_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#EAE8F8] text-[#3730A3] font-bold text-[11px] font-sans align-middle';

const TINT_GAS_TH1 = 'py-1 px-1 border border-slate-400 bg-[#EEDBB8] text-[#78350F] font-bold text-[11px] font-sans align-middle';
const TINT_GAS_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#F4E7CE] text-[#78350F] font-bold text-[11px] font-sans align-middle';

const TINT_HEAT_TH1 = 'py-1 px-1 border border-slate-400 bg-[#F2CCD1] text-[#881337] font-bold text-[11px] font-sans align-middle';
const TINT_HEAT_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#F7DEE2] text-[#881337] font-bold text-[11px] font-sans align-middle';

/**
 * Utility helper to format numbers with thousand-separator commas
 * and optional fixed decimal places.
 */
const fmtNum = (val: number | null | undefined, decimals?: number): string => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  if (decimals !== undefined && decimals > 0) {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return Math.round(val).toLocaleString();
};

export const RawDataTab: React.FC<RawDataTabProps> = ({
  files,
  results = [],
  selectedRunIdx = null,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStepFilter, setSelectedStepFilter] = useState<string>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Virtual Scrolling State
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(600);

  // Link active file with selected Run in '공정 Run 매니저'
  const activeFile = useMemo(() => {
    if (selectedRunIdx !== null && results && results[selectedRunIdx]) {
      const targetFileId = results[selectedRunIdx].fileId;
      const matched = files.find(f => f.id === targetFileId);
      if (matched) return matched;
    }
    if (selectedRunIdx !== null && files[selectedRunIdx]) {
      return files[selectedRunIdx];
    }
    return files[0] || null;
  }, [files, results, selectedRunIdx]);

  // When activeFile changes via '공정 Run 매니저', reset step filter to 'all'
  useEffect(() => {
    setSelectedStepFilter('all');
  }, [activeFile?.id]);

  // Measure container viewport height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      if (el.clientHeight > 0) {
        setViewportHeight(el.clientHeight);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 파일·검색어가 바뀌면 맨 위로 (Step 선택은 아래에서 해당 Step 첫 행으로 이동)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [activeFile?.id, searchTerm]);

  // Helper to test if a column is present in the uploaded file header
  const hasCol = (name: string): boolean => {
    if (!activeFile || !activeFile.headers) return false;
    const cleanTarget = name.toLowerCase().replace(/[\s._\-\/\(\)]/g, '');
    return activeFile.headers.some(h => {
      const cleanHeader = h.toLowerCase().replace(/[\s._\-\/\(\)]/g, '');
      return cleanHeader === cleanTarget;
    });
  };

  // Match both Velocity and typo Velcovity
  const hasLiftVel = useMemo(() =>
    hasCol('Lift Velocity') || hasCol('Lift Velcovity') || hasCol('Lift Vel') || hasCol('Lift Speed') || hasCol('LiftVelocity') || hasCol('LiftVelcovity'),
    [activeFile]
  );
  const hasLiftAcc = useMemo(() =>
    hasCol('Lift Acc/Dec') || hasCol('Lift Acc') || hasCol('Lift Acceleration') || hasCol('Lift AccDec'),
    [activeFile]
  );
  // Dynamically resolve heater zones for the active file (matches IntegratedDashboard dynamic detection)
  const activeHeaterZones = useMemo<HeaterChannelDef[]>(() => {
    if (!activeFile) return [];

    const isExcluded = (name: string) => {
      const l = name.toLowerCase().trim();
      return /\b(tv\d*|t\/v\d*|throttle|rpsc)\b/i.test(l) || l.startsWith('tv') || l.includes('rpsc') || l.includes('throttle');
    };

    // 1. From activeFile's parsed heaterChannelDefs
    if (activeFile.heaterChannelDefs && activeFile.heaterChannelDefs.length > 0) {
      const valid = activeFile.heaterChannelDefs.filter(d => !isExcluded(d.name));
      if (valid.length > 0) return valid;
    }

    // 2. From matching result's dynamicHeaterDefs
    const matchedResult = results?.find(r => r.fileId === activeFile.id);
    if (matchedResult?.dynamicHeaterDefs && matchedResult.dynamicHeaterDefs.length > 0) {
      const valid = matchedResult.dynamicHeaterDefs.filter(d => !isExcluded(d.name));
      if (valid.length > 0) return valid;
    }

    // 3. Fallback: discover dynamically from activeFile.headers
    if (activeFile.headers && activeFile.headers.length > 0) {
      const res = resolveDynamicHeaterChannels(activeFile.headers);
      if (res.discoveredHeaters && res.discoveredHeaters.length > 0) {
        const valid = res.discoveredHeaters.filter(d => !isExcluded(d.name));
        if (valid.length > 0) return valid;
      }
    }

    // 4. Default 5 standard zones fallback
    return [
      { id: 'gate_in_1', name: 'GateIn1', rawSetName: 'Gate In 1 Set', rawActName: 'Gate In 1' },
      { id: 'gate_out_2', name: 'GateOut2', rawSetName: 'Gate Out 2 Set', rawActName: 'Gate Out 2' },
      { id: 'win_in_3', name: 'WinIn3', rawSetName: 'Window In 3 Set', rawActName: 'Window In 3' },
      { id: 'win_out_4', name: 'WinOut4', rawSetName: 'Window Out 4 Set', rawActName: 'Window Out 4' },
      { id: 'side_in_5', name: 'SideIn5', rawSetName: 'Side 1 In 5 Set', rawActName: 'Side 1 In 5' },
    ];
  }, [activeFile, results]);

  const getZoneValues = (row: RawLogRow, zone: HeaterChannelDef) => {
    // 1. Try row.dynamicHeaters
    let setVal: number | null = row.dynamicHeaters?.[zone.name]?.set ?? null;
    let actVal: number | null = row.dynamicHeaters?.[zone.name]?.act ?? null;

    // If not found by exact name, try case-insensitive / normalized lookup in dynamicHeaters
    if ((setVal === null && actVal === null) && row.dynamicHeaters) {
      const targetKey = zone.name.toLowerCase().replace(/[\s._\-]/g, '');
      for (const [k, v] of Object.entries(row.dynamicHeaters)) {
        if (k.toLowerCase().replace(/[\s._\-]/g, '') === targetKey) {
          setVal = v.set;
          actVal = v.act;
          break;
        }
      }
    }

    // 2. Try rawSetName / rawActName from allValues
    if ((setVal === null || isNaN(setVal)) && zone.rawSetName && row.allValues) {
      const raw = row.allValues[zone.rawSetName];
      if (raw !== undefined && raw !== null && raw !== '') {
        const parsed = parseFloat(String(raw).replace(/,/g, ''));
        if (!isNaN(parsed)) setVal = parsed;
      }
    }
    if ((actVal === null || isNaN(actVal)) && zone.rawActName && row.allValues) {
      const raw = row.allValues[zone.rawActName];
      if (raw !== undefined && raw !== null && raw !== '') {
        const parsed = parseFloat(String(raw).replace(/,/g, ''));
        if (!isNaN(parsed)) actVal = parsed;
      }
    }

    // 3. Direct lookup in allValues using common patterns if rawSetName/rawActName weren't paired
    if ((setVal === null || isNaN(setVal)) && row.allValues) {
      const possibleSetKeys = [
        `${zone.name} Set`,
        `${zone.name}Set`,
        `${zone.name} (Set)`,
        `${zone.name} [Set]`,
        `${zone.name}_Set`,
        `${zone.name} SV`,
      ];
      for (const key of possibleSetKeys) {
        if (row.allValues[key] !== undefined && row.allValues[key] !== null && row.allValues[key] !== '') {
          const parsed = parseFloat(String(row.allValues[key]).replace(/,/g, ''));
          if (!isNaN(parsed)) {
            setVal = parsed;
            break;
          }
        }
      }
    }
    if ((actVal === null || isNaN(actVal)) && row.allValues) {
      const possibleActKeys = [
        zone.name,
        `${zone.name} Act`,
        `${zone.name}Act`,
        `${zone.name} (Act)`,
        `${zone.name}_Act`,
        `${zone.name} PV`,
        `${zone.name} Real`,
      ];
      for (const key of possibleActKeys) {
        if (row.allValues[key] !== undefined && row.allValues[key] !== null && row.allValues[key] !== '') {
          const parsed = parseFloat(String(row.allValues[key]).replace(/,/g, ''));
          if (!isNaN(parsed)) {
            actVal = parsed;
            break;
          }
        }
      }
    }

    // 4. Fallback for standard 5 zones by name matching
    const l = zone.name.toLowerCase().replace(/[\s._\-]/g, '');
    if (setVal === null || isNaN(setVal)) {
      if (l.includes('gate') && (l.includes('1') || l.includes('in'))) setVal = row.gateIn1Set || null;
      else if (l.includes('gate') && (l.includes('2') || l.includes('out'))) setVal = row.gateOut2Set || null;
      else if ((l.includes('win') || l.includes('window')) && (l.includes('3') || l.includes('in'))) setVal = row.windowIn3Set || null;
      else if ((l.includes('win') || l.includes('window')) && (l.includes('4') || l.includes('out'))) setVal = row.windowOut4Set || null;
      else if (l.includes('side') || l.includes('5')) setVal = row.side1In5Set || null;
    }
    if (actVal === null || isNaN(actVal)) {
      if (l.includes('gate') && (l.includes('1') || l.includes('in'))) actVal = row.gateIn1 || null;
      else if (l.includes('gate') && (l.includes('2') || l.includes('out'))) actVal = row.gateOut2 || null;
      else if ((l.includes('win') || l.includes('window')) && (l.includes('3') || l.includes('in'))) actVal = row.windowIn3 || null;
      else if ((l.includes('win') || l.includes('window')) && (l.includes('4') || l.includes('out'))) actVal = row.windowOut4 || null;
      else if (l.includes('side') || l.includes('5')) actVal = row.side1In5 || null;
    }

    // 5. In case Set is 0 / empty in PLC logs, Set point is nominal temperature (equals Act)
    if ((setVal === null || setVal === 0 || isNaN(setVal)) && actVal !== null && !isNaN(actVal) && actVal > 0) {
      setVal = actVal;
    }

    return { setVal, actVal };
  };

  // Dynamically filter ONLY gases that were actually used (Set > 0 or Act >= 1 in any row)
  const usedGases = useMemo(() => {
    if (!activeFile) return [];
    return CANDIDATE_GASES.filter(g => {
      return activeFile.rows.some(r => g.setGetter(r) > 0 || g.actGetter(r) >= 1);
    });
  }, [activeFile]);

  const filteredRows = useMemo(() => {
    if (!activeFile) return [];
    let rows = activeFile.rows;

    // Step 선택은 행을 걸러내지 않고 해당 Step 위치로 이동만 한다
    // → 마우스 휠로 직전·다음 Step 로그를 이어서 볼 수 있음

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.stepName.toLowerCase().includes(q) ||
        r.timeStr.toLowerCase().includes(q) ||
        r.step.toString().includes(q) ||
        r.rfOn.toLowerCase().includes(q) ||
        (r.tvCtrlModeSet || r.tvCtrlMode || '').toLowerCase().includes(q)
      );
    }

    return rows;
  }, [activeFile, searchTerm]);

  // 선택한 Step 번호와, 그 Step이 차지하는 행 수
  const selectedStepNum = selectedStepFilter === 'all' ? null : parseInt(selectedStepFilter, 10);
  const selectedStepRowCount = useMemo(
    () => (selectedStepNum === null ? 0 : filteredRows.reduce((n, r) => n + (r.step === selectedStepNum ? 1 : 0), 0)),
    [filteredRows, selectedStepNum]
  );

  // Step을 고르면 그 Step의 첫 행이 표 맨 위(머리글 바로 아래)에 오도록 이동
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let top = 0;
    if (selectedStepNum !== null) {
      const first = filteredRows.findIndex(r => r.step === selectedStepNum);
      if (first >= 0) top = first * ROW_HEIGHT;
    }
    el.scrollTop = top;
    setScrollTop(top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStepFilter, activeFile?.id]);

  // Virtual Window Calculation
  const totalCount = filteredRows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, startIndex, endIndex]);

  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (!activeFile) {
    return (
      <div className="p-16 text-center text-[#64748B] bg-white border border-slate-400 rounded-2xl shadow-xs">
        공정 Run 데이터가 없습니다. 좌측 '공정 Run 매니저'에서 파일을 등록해주세요.
      </div>
    );
  }

  // T/V Active 제어: Pressure인 경우 소숫점 없이 천자리 콤마 표시
  const renderActiveTVControl = (r: RawLogRow) => {
    const mode = (r.tvCtrlModeSet || r.tvCtrlMode || '').toUpperCase();
    if (mode.includes('PRESS')) {
      const pressVal = Math.round(r.tvPressure).toLocaleString();
      return (
        <span className="text-[#9A3412] font-bold" title="Pressure 제어 모드 (정수)">
          {pressVal} <span className="text-[10px] text-[#C2410C] font-sans font-semibold">(P)</span>
        </span>
      );
    }
    if (mode.includes('POS')) {
      const posVal = fmtNum(r.tvPosition, 1);
      return (
        <span className="text-[#9A3412] font-bold" title="Position 제어 모드">
          {posVal}% <span className="text-[10px] text-[#C2410C] font-sans font-semibold">(Pos)</span>
        </span>
      );
    }
    if (mode.includes('OPEN')) {
      return (
        <span className="text-[#9A3412] font-bold" title="Valve Open">
          OPEN
        </span>
      );
    }
    return (
      <span className="text-[#9A3412] font-bold">
        {r.tvPressure > 0 ? `${Math.round(r.tvPressure).toLocaleString()} (P)` : `${fmtNum(r.tvPosition, 1)}%`}
      </span>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-2 items-start w-full">
      {/* 1. Left Sidebar: 초소형·고밀도 '로그 & Step 매니저' (공정 Run 매니저와 연동) */}
      <div
        className={`shrink-0 transition-all duration-200 ${
          isSidebarCollapsed ? 'w-9' : 'w-full lg:w-[160px]'
        } lg:sticky lg:top-2`}
      >
        <div className="bg-[#F8FAFC] border border-slate-400 rounded-2xl shadow-xs overflow-hidden flex flex-col max-h-[calc(100vh-90px)]">
          {/* Sidebar Top Header (공정 종합 분석 카드 스타일) */}
          <div className="px-2.5 py-1.5 bg-[#E2E8F0] border-b border-slate-400 flex items-center justify-between">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs shrink-0" />
                <h2 className="text-[11px] font-bold text-[#0F172A] truncate">
                  로그 & Step 매니저
                </h2>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
              </div>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 hover:bg-[#CBD5E1] rounded-md text-[#64748B] hover:text-[#0F172A] transition-colors shrink-0 cursor-pointer"
              title={isSidebarCollapsed ? '패널 펼치기' : '패널 접기'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="p-1.5 space-y-1.5 overflow-y-auto scrollbar-thin flex-1 text-xs">
              {/* 1-1. 선택된 Recipe 연동 안내 뱃지 */}
              <div className="px-1.5 py-1 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#2563EB]">
                  <span>선택 Run</span>
                  <span className="font-mono">{activeFile.rows.length.toLocaleString()}행</span>
                </div>
                <div
                  className="text-[11px] font-bold text-[#0F172A] truncate mt-0.5"
                  title={activeFile.meta.recipeName || activeFile.fileName}
                >
                  {activeFile.meta.recipeName || activeFile.fileName}
                </div>
              </div>

              {/* 1-2. 검색 (Ultra-compact 28px height) */}
              <div className="relative">
                <Search className="w-3 h-3 text-[#94A3B8] absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="검색"
                  title="Time, Step, 모드 등으로 검색"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-[#0F172A] text-[11px] rounded-lg pl-6.5 pr-6 py-1 focus:outline-none focus:border-[#2563EB] transition-all placeholder:text-[#94A3B8]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-1.5 top-1.5 text-[#94A3B8] hover:text-[#0F172A] p-0.5 cursor-pointer"
                    title="검색어 지우기"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 1-3. Step 필터 & Step 별 요약 (Ultra-compact high-density vertical list) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#64748B] px-0.5">
                  <span className="flex items-center gap-1">
                    <Filter className="w-3 h-3 text-[#2563EB]" />
                    Step ({activeFile.stepsSummary.length})
                  </span>
                  {selectedStepFilter !== 'all' && (
                    <button
                      onClick={() => setSelectedStepFilter('all')}
                      className="text-[#2563EB] hover:underline cursor-pointer"
                    >
                      전체 해제
                    </button>
                  )}
                </div>

                {/* All Steps Row Button */}
                <button
                  type="button"
                  onClick={() => setSelectedStepFilter('all')}
                  className={`w-full px-1.5 py-1 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer text-[11px] ${
                    selectedStepFilter === 'all'
                      ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1D4ED8] font-bold shadow-xs'
                      : 'bg-white border-slate-300 hover:bg-[#F1F5F9] text-[#334155]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        selectedStepFilter === 'all'
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-slate-200 text-[#475569]'
                      }`}
                    >
                      ALL
                    </span>
                    <span>전체 Step</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#64748B]">
                    {activeFile.rows.length.toLocaleString()}행
                  </span>
                </button>

                {/* Vertical Step Items: Ultra-dense single-line layout */}
                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-0.5 scrollbar-thin">
                  {activeFile.stepsSummary.map(s => {
                    const isSelected = selectedStepFilter === s.step.toString();
                    return (
                      <button
                        key={s.step}
                        type="button"
                        onClick={() => setSelectedStepFilter(s.step.toString())}
                        className={`w-full px-1.5 py-1 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer text-[11px] ${
                          isSelected
                            ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-[#2563EB] text-[#1D4ED8] font-bold shadow-xs'
                            : 'bg-white border-slate-300 hover:bg-[#F1F5F9] text-[#334155]'
                        }`}
                        title={`Step ${s.step}: ${s.stepName} (${s.rowCount.toLocaleString()}행, ${s.durationSec}s, ${s.startElapsedSec}s ~ ${s.endElapsedSec}s)`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0 ${
                              isSelected
                                ? 'bg-[#2563EB] text-white'
                                : 'bg-slate-200 text-[#2563EB]'
                            }`}
                          >
                            S{s.step}
                          </span>
                          <span className="truncate text-[11px] font-medium text-[#0F172A]">
                            {s.stepName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B] shrink-0 ml-1">
                          {s.durationSec}s
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1-4. Gas Auto-Filter Info (Compact single-line pill) */}
              {usedGases.length > 0 && (
                <div
                  className="px-2 py-1 bg-[#EEDBB8]/40 border border-[#FED7AA] rounded-lg text-[10px] text-[#78350F] flex items-center justify-between"
                  title={`사용 Gas: ${usedGases.map(g => g.name).join(', ')}`}
                >
                  <span className="font-bold flex items-center gap-1 text-[#78350F]">
                    <Filter className="w-2.5 h-2.5 text-[#EA580C]" />
                    Gas ({usedGases.length})
                  </span>
                  <span className="font-mono font-semibold truncate max-w-[80px]">
                    {usedGases.map(g => g.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Right Content: Raw Data Table (공정 종합 분석과 100% 동일한 고밀도 엑셀 그리드 스타일) */}
      <div className="flex-1 min-w-0 w-full space-y-2">
        {/* Missing Columns Notice if any */}
        {activeFile.missingColumns.length > 0 && (
          <div className="p-2.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex items-start gap-2 text-xs text-[#92400E] shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <span className="font-bold">설비 미제공 컬럼 안내:</span> 일부 컬럼이 누락되어 있습니다:{' '}
              <span className="font-mono text-[#0F172A] font-semibold">
                {activeFile.missingColumns.join(', ')}
              </span>
            </div>
          </div>
        )}

        {/* Table Container - 공정 종합 분석과 동일한 cardBorder & rounded-2xl & cardShadow */}
        <div className="bg-[#F8FAFC] border border-slate-400 rounded-2xl overflow-hidden shadow-xs">
          {/* Table Top Toolbar - 공정 종합 분석과 동일한 타이틀 바 디자인 */}
          <div className="px-3 py-1.5 bg-[#E2E8F0] border-b border-slate-400 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs shrink-0" />
              <h3 className="text-[13px] font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
                [Raw Data] 원본 공정 로그
              </h3>
              <span className="h-3.5 w-px bg-slate-300 mx-0.5 hidden sm:inline-block" />

              <span className="text-[#4E5968] text-[11px] flex items-center gap-1 font-medium">
                {selectedStepNum !== null ? (
                  <>
                    <span>Step {selectedStepNum}:</span>
                    <strong className="font-mono text-[#2563EB] text-xs font-bold">
                      {selectedStepRowCount.toLocaleString()}
                    </strong>
                    <span>행 / 전체 {totalCount.toLocaleString()}행 · 휠로 앞뒤 Step 이어 보기</span>
                  </>
                ) : (
                  <>
                    <span>표시 중:</span>
                    <strong className="font-mono text-[#2563EB] text-xs font-bold">
                      {totalCount.toLocaleString()}
                    </strong>
                    <span>행</span>
                  </>
                )}
              </span>

              <span className="inline-flex items-center gap-1 bg-[#D1FAE5] text-[#065F46] border border-[#34D399] px-1.5 py-0.2 rounded text-[10px] font-bold">
                <Zap className="w-2.5 h-2.5 text-[#059669]" />
                가상 스크롤 60FPS
              </span>

              {selectedStepFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-[#3182F6]/15 text-[#3182F6] border border-[#3182F6]/40 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  Step {selectedStepFilter}
                  <button
                    onClick={() => setSelectedStepFilter('all')}
                    className="hover:text-[#DC2626] ml-0.5 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              {searchTerm && (
                <span className="inline-flex items-center gap-1 bg-white text-[#0F172A] border border-slate-400 px-1.5 py-0.2 rounded text-[10px]">
                  검색: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm('')}
                    className="hover:text-[#DC2626] ml-0.5 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
            </div>

            <div className="text-[10px] text-[#475569] flex items-center gap-2">
              <span>
                현재 렌더링 범위: <strong className="font-mono text-[#0F172A]">{totalCount > 0 ? (startIndex + 1).toLocaleString() : 0} ~ {Math.min(endIndex, totalCount).toLocaleString()}</strong> / {totalCount.toLocaleString()}행
              </span>
              <span className="text-slate-300">|</span>
              <span className="truncate max-w-[200px] font-bold text-[#1E293B]" title={activeFile.meta.recipeName || activeFile.fileName}>
                {activeFile.meta.recipeName || activeFile.fileName}
              </span>
            </div>
          </div>

          {/* 2-Tier High-Density Sticky Table with Virtual Scrolling Window */}
          {/* 공정 종합 분석과 동일한 border-slate-400 일관된 그리드 + 흰색/EDF2F7 지브라 패턴 */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="overflow-auto max-h-[calc(100vh-170px)] min-h-[500px] scrollbar-thin relative bg-white"
          >
            <table className="w-full text-xs text-center border-collapse font-sans whitespace-nowrap border border-slate-400">
              {/* Header Tier 1: Group Badges (공정 종합 분석과 동일한 카테고리 틴트 시스템) */}
              <thead className="sticky top-0 z-20 text-[11px] font-bold font-sans">
                <tr className="border-b border-slate-400">
                  <th colSpan={5} className={TINT_FIXED_TH1}>
                    Step & Time
                  </th>
                  {usedGases.length > 0 && (
                    <th colSpan={usedGases.length * 2} className={TINT_GAS_TH1}>
                      Process Gas (sccm)
                    </th>
                  )}
                  <th colSpan={4} className={TINT_LIFT_TH1}>
                    Lift Spacing
                  </th>
                  <th colSpan={6} className={TINT_PRES_TH1}>
                    T/V & Pressure
                  </th>
                  <th colSpan={5} className={TINT_MATCHER_TH1}>
                    Matcher Parameter
                  </th>
                  <th colSpan={5} className={TINT_RF_TH1}>
                    RF Power (W)
                  </th>
                  <th colSpan={Math.max(2, activeHeaterZones.length * 2)} className={TINT_HEAT_TH1}>
                    Susceptor Zone 온도 (℃)
                  </th>
                </tr>

                {/* Header Tier 2: Individual Column Names */}
                <tr className="border-b border-slate-400 text-[11px] font-sans font-semibold text-[#1E293B]">
                  {/* 1. Sequence Info: Column 1 is Step Name (Sticky left-0) */}
                  <th className={`${TINT_FIXED_TH2} sticky left-0 z-30 shadow-xs`}>
                    Step Name
                  </th>
                  <th className={TINT_FIXED_TH2}>Time</th>
                  <th className={`${TINT_FIXED_TH2} text-[#1D4ED8]`}>Step All Time</th>
                  <th className={`${TINT_FIXED_TH2} text-[#1D4ED8]`}>Step Time</th>
                  <th className={`${TINT_FIXED_TH2} text-[#1D4ED8]`}>Step</th>

                  {/* 6. Used Gases */}
                  {usedGases.map(g => (
                    <React.Fragment key={g.key}>
                      <th className={TINT_GAS_TH2}>
                        {g.name} Set
                      </th>
                      <th className={`${TINT_GAS_TH2} font-bold text-[#C2410C]`}>
                        {g.name} Act
                      </th>
                    </React.Fragment>
                  ))}

                  {/* 5. Lift */}
                  <th className={TINT_LIFT_TH2}>Spacing Set</th>
                  <th className={`${TINT_LIFT_TH2} text-[#4338CA] font-bold`}>Spacing Act</th>
                  <th className={TINT_LIFT_TH2} title="Lift Velocity (또는 Velcovity)">Lift Velocity</th>
                  <th className={TINT_LIFT_TH2}>Lift Acc/Dec</th>

                  {/* 4. T/V & Pressure */}
                  <th className={TINT_PRES_TH2}>T/V Mode</th>
                  <th className={`${TINT_PRES_TH2} text-[#9A3412] font-bold bg-[#F4E7CE]`} title="Mode가 Pressure면 Pressure, Position이면 Position 표시">
                    T/V Active 제어
                  </th>
                  <th className={TINT_PRES_TH2}>Press Set</th>
                  <th className={`${TINT_PRES_TH2} text-[#9A3412] font-bold`}>Press Act</th>
                  <th className={TINT_PRES_TH2}>Pos Set</th>
                  <th className={`${TINT_PRES_TH2} text-[#9A3412]`}>Pos Act</th>

                  {/* 3. Matcher */}
                  <th className={TINT_MATCHER_TH2}>Load</th>
                  <th className={TINT_MATCHER_TH2}>Tune</th>
                  <th className={TINT_MATCHER_TH2}>Vpp</th>
                  <th className={TINT_MATCHER_TH2}>Irms</th>
                  <th className={`${TINT_MATCHER_TH2} text-[#047857] font-bold`}>Vdc</th>

                  {/* 2. RF */}
                  <th className={TINT_RF_TH2}>RF On</th>
                  <th className={TINT_RF_TH2}>Fwd Set</th>
                  <th className={TINT_RF_TH2}>Fwd Set(A)</th>
                  <th className={`${TINT_RF_TH2} text-[#1D4ED8] font-bold`}>Fwd Act</th>
                  <th className={`${TINT_RF_TH2} text-[#BE123C] font-bold`}>Reflect</th>

                  {/* 7. Dynamic Heater Zones */}
                  {activeHeaterZones.map(zone => (
                    <React.Fragment key={zone.id || zone.name}>
                      <th className={TINT_HEAT_TH2} title={`${zone.name} Set Point`}>
                        {zone.name} Set
                      </th>
                      <th className={`${TINT_HEAT_TH2} text-[#B91C1C] font-bold`} title={`${zone.name} Real Value`}>
                        {zone.name}
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              {/* Table Body - 공정 종합 분석과 동일한 White / #EDF2F7 지브라 패턴 & border-slate-400 */}
              <tbody className="font-sans text-[11px] tabular-nums text-slate-900">
                {/* 1. Top Virtual Spacer */}
                {topSpacerHeight > 0 && (
                  <tr style={{ height: `${topSpacerHeight}px` }}>
                    <td colSpan={100} className="p-0 m-0 border-0 pointer-events-none" />
                  </tr>
                )}

                {/* 2. Visible Virtual Rows Window */}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={100} className="py-12 text-center text-[#64748B] font-sans">
                      조회된 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r, vi) => {
                    const isEven = r.rowIndex % 2 === 0;
                    // 공정 종합 분석과 100% 동일한 zebra: 흰색(white)과 소프트 슬레이트(#EDF2F7)
                    const rowBgClass = isEven ? 'bg-white' : 'bg-[#EDF2F7]';
                    // Step이 바뀌는 첫 행 → 위쪽에 파란 굵은 경계선
                    const prev = filteredRows[startIndex + vi - 1];
                    const isStepStart = !!prev && prev.step !== r.step;
                    const inSelected = selectedStepNum !== null && r.step === selectedStepNum;
                    const nameCellBg = inSelected ? 'bg-[#DBEAFE] text-[#1E3A8A]' : rowBgClass;

                    return (
                      <tr
                        key={r.rowIndex}
                        className={`group transition-colors h-[30px] ${rowBgClass} hover:bg-blue-50/80 ${
                          isStepStart ? '[&>td]:border-t-2 [&>td]:border-t-[#2563EB]' : ''
                        }`}
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        {/* 1. Sequence Info: Column 1 is Step Name (Sticky left-0, matching row background) */}
                        <td
                          className={`py-1 px-2 text-center font-bold text-slate-900 border border-slate-400 sticky left-0 z-10 truncate max-w-[130px] shadow-xs ${nameCellBg} group-hover:bg-blue-50/80`}
                          title={`행 #${r.rowIndex.toLocaleString()} | ${r.stepName}`}
                        >
                          {r.stepName}
                        </td>
                        <td className="py-1 px-2 text-center text-slate-900 font-medium border border-slate-400 text-[11px] whitespace-nowrap">
                          {r.timeStr}
                        </td>
                        <td className="py-1 px-1 text-center text-[#2563EB] font-bold border border-slate-400">
                          {fmtNum(r.stepAllTime, 1)}s
                        </td>
                        <td className="py-1 px-1 text-center text-slate-700 font-bold border border-slate-400">
                          {fmtNum(r.stepTime, 1)}s
                        </td>
                        <td className="py-1 px-1 text-center text-[#2563EB] font-bold border border-slate-400">
                          {r.step.toLocaleString()}
                        </td>

                        {/* 6. Used Gases - 천자리 단위 콤마 적용 */}
                        {usedGases.map(g => (
                          <React.Fragment key={g.key}>
                            <td className="py-1 px-1 text-center text-slate-800 font-bold border border-slate-400">
                              {fmtNum(g.setGetter(r), 0)}
                            </td>
                            <td className="py-1 px-1 text-center font-bold text-[#C2410C] border border-slate-400">
                              {fmtNum(g.actGetter(r), 0)}
                            </td>
                          </React.Fragment>
                        ))}

                        {/* 5. Lift */}
                        <td className="py-1 px-1 text-center text-slate-800 font-bold border border-slate-400">
                          {fmtNum(r.liftSpacingSet, 0)}
                        </td>
                        <td className="py-1 px-1 text-center border border-slate-400 text-[#4338CA] font-bold">
                          {fmtNum(r.liftSpacing, 0)}
                        </td>
                        <td className="py-1 px-1 text-center border border-slate-400 text-slate-800 font-bold">
                          {hasLiftVel && r.liftVelocity !== null && r.liftVelocity !== undefined
                            ? fmtNum(r.liftVelocity, 0)
                            : <span className="text-slate-400 font-normal text-[10px]">-</span>}
                        </td>
                        <td className="py-1 px-1 text-center border border-slate-400 text-slate-800 font-bold">
                          {hasLiftAcc && r.liftAccDec !== null && r.liftAccDec !== undefined
                            ? fmtNum(r.liftAccDec, 0)
                            : <span className="text-slate-400 font-normal text-[10px]">-</span>}
                        </td>

                        {/* 4. T/V & Pressure */}
                        <td className="py-1 px-1 text-center text-slate-700 font-bold border border-slate-400 text-[11px]">
                          {r.tvCtrlModeSet || r.tvCtrlMode || '-'}
                        </td>
                        {/* T/V Active 제어 (공정 종합 분석과 동일한 TINT_GAS 계열 틴트) */}
                        <td className="py-1 px-1.5 text-center font-mono font-bold bg-[#F4E7CE]/40 group-hover:bg-[#F4E7CE]/70 border border-slate-400">
                          {renderActiveTVControl(r)}
                        </td>
                        <td className="py-1 px-1 text-center text-slate-800 font-bold border border-slate-400">
                          {fmtNum(r.tvPressureSet, 0)}
                        </td>
                        {/* Press Act: 소숫점 없이 정수 콤마 표시 */}
                        <td className="py-1 px-1 text-center text-[#9A3412] font-bold border border-slate-400">
                          {fmtNum(r.tvPressure, 0)}
                        </td>
                        <td className="py-1 px-1 text-center text-slate-800 font-bold border border-slate-400">
                          {fmtNum(r.tvPositionSet, 0)}
                        </td>
                        <td className="py-1 px-1 text-center text-[#9A3412] font-bold border border-slate-400">
                          {fmtNum(r.tvPosition, 1)}%
                        </td>

                        {/* 3. Matcher */}
                        <td className="py-1 px-1 text-center border border-slate-400 text-[#047857] font-bold">
                          {fmtNum(r.matcherLoad, 2)}
                        </td>
                        <td className="py-1 px-1 text-center border border-slate-400 text-[#047857] font-bold">
                          {fmtNum(r.matcherTune, 2)}
                        </td>
                        <td className="py-1 px-1 text-center border border-slate-400 text-[#047857] font-bold">
                          {fmtNum(r.matcherVpp, 1)}
                        </td>
                        <td className="py-1 px-1 text-center border border-slate-400 text-[#047857] font-bold">
                          {fmtNum(r.matcherIrms, 1)}
                        </td>
                        <td className="py-1 px-1 text-center font-bold text-[#047857] border border-slate-400">
                          {fmtNum(r.matcherDCBias, 1)}
                        </td>

                        {/* 2. RF */}
                        <td className="py-1 px-1 text-center border border-slate-400">
                          <span className={r.rfOn === 'On' ? 'text-[#2563EB] font-bold' : 'text-[#94A3B8] font-medium'}>
                            {r.rfOn}
                          </span>
                        </td>
                        <td className="py-1 px-1 text-center text-slate-800 font-bold border border-slate-400">
                          {fmtNum(r.rfForwardSetValue, 0)}
                        </td>
                        <td className="py-1 px-1 text-center text-slate-700 font-bold border border-slate-400">
                          {fmtNum(r.rfForwardSetValueAct, 0)}
                        </td>
                        <td className="py-1 px-1 text-center font-bold text-[#1D4ED8] border border-slate-400">
                          {fmtNum(r.rfForwardPowerAct, 0)}
                        </td>
                        <td className="py-1 px-1 text-center text-[#BE123C] font-bold border border-slate-400">
                          {fmtNum(r.rfReflectPower, 0)}
                        </td>

                        {/* 7. Dynamic Heater Zones - 천자리 단위 콤마 적용 */}
                        {activeHeaterZones.map(zone => {
                          const { setVal, actVal } = getZoneValues(r, zone);
                          return (
                            <React.Fragment key={zone.id || zone.name}>
                              <td className="py-1 px-1 text-center text-slate-800 font-bold border border-slate-400">
                                {setVal !== null && setVal !== undefined && !isNaN(setVal) && setVal > 0 ? (
                                  fmtNum(setVal, 0)
                                ) : (
                                  <span className="text-slate-400 font-normal text-[10px]">-</span>
                                )}
                              </td>
                              <td className="py-1 px-1 text-center text-[#B91C1C] font-bold border border-slate-400">
                                {actVal !== null && actVal !== undefined && !isNaN(actVal) && actVal > 0 ? (
                                  fmtNum(actVal, 1)
                                ) : (
                                  <span className="text-slate-400 font-normal text-[10px]">-</span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })
                )}

                {/* 3. Bottom Virtual Spacer */}
                {bottomSpacerHeight > 0 && (
                  <tr style={{ height: `${bottomSpacerHeight}px` }}>
                    <td colSpan={100} className="p-0 m-0 border-0 pointer-events-none" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
