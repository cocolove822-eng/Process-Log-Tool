import React, { useState, useRef, useMemo } from 'react';
import {
  Copy,
  Check,
  X,
  Minus,
  Plus,
  Trash2,
  FileSpreadsheet,
  Server,
  Layers,
  ChevronRight,
  Shield,
  Activity,
  Settings2,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import {
  AnalysisFileResult,
  AnalyzerSettings,
  CTCLMatrixData,
  CriterionState,
  DepoStepCriteriaMap,
  DeviationStat,
  HWControlStartRow,
  HWControlEndRFRow,
  MonitoringDataRow,
  ParsedLogFile,
} from '../types/pecvd';
import { copyTableToClipboard } from '../utils/exportUtils';
import { fmtHwStatus, hwBoundaryBadge, hwStatusOf, isBbEndRow } from '../utils/hwStatus';
import { normalizeCriteria } from '../utils/analyzer';
import { interpolateCTCL } from '../utils/ctclParser';
import { SequenceGanttVisualizer } from './SequenceGanttVisualizer';
import { SpcPanel } from './SpcPanel';
import { CompareBadge, CompareBar, CompareCard, COMPARE_TINTS, resultKey } from './ComparePanel';
import { useTheme } from '../context/ThemeContext';

export interface VariableDefinition {
  id: string;
  category: 'Gas' | 'RF' | 'Matcher' | 'Pressure' | 'Lift' | 'Heater';
  defaultRawName: string;
  candidateRawNames: string[];
  defaultDashboardName: string;
}

export const VARIABLE_DEFINITIONS: VariableDefinition[] = [
  // Gas (7종)
  { id: 'sih4', category: 'Gas', defaultRawName: 'Pyro.SiH4', candidateRawNames: ['Pyro.SiH4', 'Pyro SiH4', 'SiH4'], defaultDashboardName: 'SiH4' },
  { id: 'n2o', category: 'Gas', defaultRawName: 'Pyro.N2O', candidateRawNames: ['Pyro.N2O', 'Pyro N2O', 'N2O'], defaultDashboardName: 'N2O' },
  { id: 'nh3', category: 'Gas', defaultRawName: 'Pyro.NH3', candidateRawNames: ['Pyro.NH3', 'Pyro NH3', 'NH3'], defaultDashboardName: 'NH3' },
  { id: 'ar', category: 'Gas', defaultRawName: 'Pyro.Ar', candidateRawNames: ['Pyro.Ar', 'Oxy.Ar', 'Pyro Ar', 'Ar'], defaultDashboardName: 'Ar' },
  { id: 'pn2', category: 'Gas', defaultRawName: 'Pyro.PN2', candidateRawNames: ['Pyro.PN2', 'Pyro PN2', 'PN2'], defaultDashboardName: 'PN2' },
  { id: 'h2', category: 'Gas', defaultRawName: 'Pyro.H2', candidateRawNames: ['Pyro.H2', 'Pyro H2', 'H2'], defaultDashboardName: 'H2' },
  { id: 'nf3', category: 'Gas', defaultRawName: 'Oxy.NF3', candidateRawNames: ['Oxy.NF3', 'Oxy NF3', 'NF3'], defaultDashboardName: 'NF3' },

  // RF Generator
  { id: 'rf_power', category: 'RF', defaultRawName: 'RF Forward Power(Act)', candidateRawNames: ['RF Forward Power(Act)', 'RF Forward Act', 'RF Forward', 'RF Forward Power'], defaultDashboardName: 'Power' },
  { id: 'rf_reflect', category: 'RF', defaultRawName: 'RF Reflect Power', candidateRawNames: ['RF Reflect Power', 'RF Reflect', 'RF Ref Power'], defaultDashboardName: 'Ref.' },
  { id: 'rf_set', category: 'RF', defaultRawName: 'RF Forward SetValue', candidateRawNames: ['RF Forward SetValue', 'RF Forward Set'], defaultDashboardName: 'RF Power (Set)' },
  { id: 'rf_ramp_up', category: 'RF', defaultRawName: 'RF Ramp Value Up', candidateRawNames: ['RF Ramp Value Up', 'RF Ramp Up'], defaultDashboardName: 'Ramp Up' },
  { id: 'rf_ramp_down', category: 'RF', defaultRawName: 'RF Ramp Time Down', candidateRawNames: ['RF Ramp Time Down', 'RF Ramp Down'], defaultDashboardName: 'Ramp Down' },

  // Matcher
  { id: 'matcher_load', category: 'Matcher', defaultRawName: 'Matcher Load', candidateRawNames: ['Matcher Load', 'Generator Load', 'Load'], defaultDashboardName: 'Load' },
  { id: 'matcher_tune', category: 'Matcher', defaultRawName: 'Matcher Tune', candidateRawNames: ['Matcher Tune', 'Generator Tune', 'Tune'], defaultDashboardName: 'Tune' },
  { id: 'matcher_r', category: 'Matcher', defaultRawName: 'RF Ch R', candidateRawNames: ['RF Ch R', 'R', 'Matcher R'], defaultDashboardName: 'R' },
  { id: 'matcher_x', category: 'Matcher', defaultRawName: 'RF Ch X', candidateRawNames: ['RF Ch X', 'X', 'Matcher X'], defaultDashboardName: 'X' },
  { id: 'matcher_vpp', category: 'Matcher', defaultRawName: 'Matcher Vpp', candidateRawNames: ['Matcher Vpp', 'Vpp'], defaultDashboardName: 'Vpp' },
  { id: 'matcher_irms', category: 'Matcher', defaultRawName: 'Matcher Irms', candidateRawNames: ['Matcher Irms', 'Irms'], defaultDashboardName: 'Irms' },
  { id: 'matcher_vdc', category: 'Matcher', defaultRawName: 'Matcher DC Bias', candidateRawNames: ['Matcher DC Bias', 'DC Bias', 'Vdc'], defaultDashboardName: 'Vdc' },

  // Pressure & Throttle Valve
  { id: 'tv_press', category: 'Pressure', defaultRawName: 'T/V Pressure', candidateRawNames: ['T/V Pressure', 'TV Pressure', 'Pressure'], defaultDashboardName: 'Pres.' },
  { id: 'tv_pos', category: 'Pressure', defaultRawName: 'T/V Position', candidateRawNames: ['T/V Position', 'TV Position', 'Throttle Position'], defaultDashboardName: 'T/V Pos.' },
  { id: 'tv_mode', category: 'Pressure', defaultRawName: 'T/V Ctrl Mode Set', candidateRawNames: ['T/V Ctrl Mode Set', 'TV Mode Set', 'T/V Mode'], defaultDashboardName: 'T/V' },

  // Lift / Susceptor
  { id: 'lift_spacing', category: 'Lift', defaultRawName: 'Lift Spacing', candidateRawNames: ['Lift Spacing', 'Susceptor Spacing', 'Spacing'], defaultDashboardName: 'Spacing' },
  { id: 'lift_velocity', category: 'Lift', defaultRawName: 'Lift Velcovity', candidateRawNames: ['Lift Velcovity', 'Lift Velocity', 'Lift Vel', 'Lift Speed'], defaultDashboardName: 'Lift Vel' },
  { id: 'lift_acc_dec', category: 'Lift', defaultRawName: 'Lift Acc/Dec', candidateRawNames: ['Lift Acc/Dec', 'Lift Acc Dec', 'Lift Acc'], defaultDashboardName: 'Lift Acc' },

  // Heaters
  { id: 'gate_in_1', category: 'Heater', defaultRawName: 'Gate In 1', candidateRawNames: ['Gate In 1', 'GateIn1'], defaultDashboardName: 'Gate 1' },
  { id: 'window_in_3', category: 'Heater', defaultRawName: 'Window In 3', candidateRawNames: ['Window In 3', 'WindowIn3'], defaultDashboardName: 'Win In 3' },
  { id: 'window_out_4', category: 'Heater', defaultRawName: 'Window Out 4', candidateRawNames: ['Window Out 4', 'WindowOut4'], defaultDashboardName: 'Win Out 4' },
  { id: 'side_in_5', category: 'Heater', defaultRawName: 'Side 1 In 5', candidateRawNames: ['Side 1 In 5', 'Side1In5'], defaultDashboardName: 'Side 5' },
];

export const getDetectedRawName = (item: VariableDefinition, files: ParsedLogFile[] = []): { name: string; isMatched: boolean } => {
  if (files.length > 0) {
    for (const f of files) {
      if (f.headers && f.headers.length > 0) {
        for (const cand of item.candidateRawNames) {
          const found = f.headers.find(h => h.trim().toLowerCase() === cand.trim().toLowerCase());
          if (found) return { name: found, isMatched: true };
        }
      }
    }
  }
  return { name: item.defaultRawName, isMatched: false };
};

// ============================================================================
// [중요/절대규칙] 모든 표 공통 "No." 및 "RCP Name" 열너비 통일 상수
// "[Recipe Data] 공정 조건 Set 값" 표 기준: No. = 40px, RCP Name = 145px
// [절대 조건] 향후 어떤 패치나 기능 추가가 있더라도 '공정 종합 분석'의 모든 표는
// 무조건 아래의 통일된 열너비와 스타일을 사용하여 100% 동일하게 렌더링됩니다.
// ============================================================================
export const TABLE_COL_NO_WIDTH = '40px';
export const TABLE_COL_RCP_WIDTH = '145px';
export const TABLE_COL_STEP_WIDTH = '52px';
export const TABLE_COL_DATE_WIDTH = '90px'; // YYYY-MM-DD (e.g. 2026-07-29) 날짜가 겹치지 않고 넉넉하게 표시되는 너비

export const TABLE_COL_NO_STYLE: React.CSSProperties = {
  width: TABLE_COL_NO_WIDTH,
  minWidth: TABLE_COL_NO_WIDTH,
  maxWidth: TABLE_COL_NO_WIDTH,
};

export const TABLE_COL_RCP_STYLE: React.CSSProperties = {
  width: TABLE_COL_RCP_WIDTH,
  minWidth: TABLE_COL_RCP_WIDTH,
  maxWidth: TABLE_COL_RCP_WIDTH,
};

export const TABLE_COL_STEP_STYLE: React.CSSProperties = {
  width: TABLE_COL_STEP_WIDTH,
  minWidth: TABLE_COL_STEP_WIDTH,
  maxWidth: TABLE_COL_STEP_WIDTH,
};

export const TABLE_COL_DATE_STYLE: React.CSSProperties = {
  width: TABLE_COL_DATE_WIDTH,
  minWidth: TABLE_COL_DATE_WIDTH,
  maxWidth: TABLE_COL_DATE_WIDTH,
};

// [방안 C] 삼성/SK하이닉스 엔지니어링 실무 엑셀런트 그리드 스타일 상수
// 일관된 border-slate-400 테두리를 사용하여 모든 셀과 헤더에서 눈부심 없이 또렷한 엑셀 그리드를 제공합니다.
export const TABLE_TH_NO_CLASS =
  'text-[11px] font-bold font-sans py-1 px-0.5 text-center align-middle whitespace-nowrap border border-slate-400 bg-[#CBD5E1] text-[#0F172A]';
export const TABLE_TH_RCP_CLASS =
  'text-[11px] font-bold font-sans py-1 px-1 text-center align-middle truncate whitespace-nowrap border border-slate-400 bg-[#CBD5E1] text-[#0F172A]';

export const TABLE_TD_NO_CLASS =
  'text-[11px] font-bold font-sans py-1 px-0.5 text-center align-middle whitespace-nowrap border border-slate-400';
export const TABLE_TD_RCP_CLASS =
  'text-[11px] font-bold font-sans py-1 px-1.5 text-left align-middle truncate whitespace-nowrap border border-slate-400';
export const TABLE_TD_DATA_CLASS =
  'text-[11px] font-bold text-slate-900 font-sans tabular-nums py-1 px-0.5 text-center align-middle whitespace-nowrap border border-slate-400';
export const TABLE_TH_UNIT_CLASS =
  'text-[10px] font-semibold font-sans py-[1px] px-0.5 text-center align-middle whitespace-nowrap border border-slate-400 bg-[#E2E8F0] text-[#334155]';

// 1) 고정/일반 (No, RCP Name, Depo Step, Date, Depo. Time, 기본 정보) - 뉴트럴 쿨 슬레이트
export const TINT_FIXED_TH1 = 'py-1 px-1 border border-slate-400 bg-[#CBD5E1] text-[#0F172A] font-bold text-[11px] font-sans align-middle';
export const TINT_FIXED_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#DDE3EA] text-[#0F172A] font-bold text-[11px] font-sans align-middle';

// 2) RF Power 계통 (Power·RSD·Max Ref.·RF Delay) - 아이스 블루 틴트 (음영 밝기 조절로 또렷한 대비)
export const TINT_RF_TH1 = 'py-1 px-1 border border-slate-400 bg-[#C2D7EF] text-[#1E3A8A] font-bold text-[11px] font-sans align-middle';
export const TINT_RF_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#D7E5F4] text-[#1E3A8A] font-bold text-[11px] font-sans align-middle';

// 3) Pressure & Throttle Valve (Pres.·T/V Pos.) 계통 - 연두·올리브 틴트 (원본 로그 탭과 동일)
export const TINT_PRES_TH1 = 'py-1 px-1 border border-slate-400 bg-[#DCE3B0] text-[#4D5A0E] font-bold text-[11px] font-sans align-middle';
export const TINT_PRES_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#EAEFCC] text-[#4D5A0E] font-bold text-[11px] font-sans align-middle';

// 3-1) Lift / Spacing 계통 - 연보라 틴트 (원본 로그 탭 Lift Spacing과 동일)
export const TINT_LIFT_TH1 = 'py-1 px-1 border border-slate-400 bg-[#D9D7F1] text-[#3730A3] font-bold text-[11px] font-sans align-middle';
export const TINT_LIFT_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#EAE8F8] text-[#3730A3] font-bold text-[11px] font-sans align-middle';

// 3-2) Matcher 계통 (Load·Tune·R·X·Vpp·Irms·Vdc) - 민트 틴트 (원본 로그 탭 Matcher Parameter와 동일)
export const TINT_MATCHER_TH1 = 'py-1 px-1 border border-slate-400 bg-[#C1E2D4] text-[#065F46] font-bold text-[11px] font-sans align-middle';
export const TINT_MATCHER_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#D8EDE4] text-[#065F46] font-bold text-[11px] font-sans align-middle';

// 4) Gas MFC 계통 - 앰버/샌드 틴트
export const TINT_GAS_TH1 = 'py-1 px-1 border border-slate-400 bg-[#EEDBB8] text-[#78350F] font-bold text-[11px] font-sans align-middle';
export const TINT_GAS_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#F4E7CE] text-[#78350F] font-bold text-[11px] font-sans align-middle';

// 5) Wall Heater 계통 - 로즈 틴트
export const TINT_HEAT_TH1 = 'py-1 px-1 border border-slate-400 bg-[#F2CCD1] text-[#881337] font-bold text-[11px] font-sans align-middle';
export const TINT_HEAT_TH2 = 'py-0.5 px-0.5 border border-slate-400 bg-[#F7DEE2] text-[#881337] font-bold text-[11px] font-sans align-middle';

// 6) 단위 Row (Tier 3) - 정밀 엑셀 그리드 뉴트럴
export const TINT_UNIT_TH = 'py-[1px] px-0.5 border border-slate-400 bg-[#E2E8F0] text-[#334155] font-semibold text-[10px] font-sans align-middle';

interface IntegratedDashboardProps {
  results: AnalysisFileResult[];
  settings: AnalyzerSettings;
  files?: ParsedLogFile[];
  ctclMatrix?: CTCLMatrixData | null;
  selectedRunIdx?: number | null;
  onSelectRunIdx?: (idx: number | null) => void;
  /** 비교 선택 (A·B·C 순서의 Run 키) */
  compareKeys?: string[];
  onToggleCompare?: (key: string) => void;
  onClearCompare?: () => void;
  compareOnly?: boolean;
  onToggleCompareOnly?: (v: boolean) => void;
  compareNotice?: string | null;
  onUpdateSettings?: (newSettings: AnalyzerSettings) => void;
  onUploadRawFiles?: (files: FileList | File[]) => void;
  onRemoveFile?: (fileId: string) => void;
  onClearAllFiles?: () => void;
  onChangeManualDepoStep?: (fileId: string, step: number | null) => void;
  onChangeManualPlSteps?: (fileId: string, plStart: number | null, plEnd: number | null) => void;
  onNavigateToCtcl?: () => void;
}

/** 표 번호 칸: 눌러서 타임라인 보기 (마우스를 올리면 번호가 파랗게) */
const NO_CELL_LINK_CLASS = 'cursor-pointer hover:[&>span]:text-[#2563EB] hover:[&>span]:underline hover:[&>span]:underline-offset-2';

export const IntegratedDashboard: React.FC<IntegratedDashboardProps> = ({
  results,
  settings,
  files = [],
  ctclMatrix = null,
  selectedRunIdx = null,
  onSelectRunIdx,
  compareKeys = [],
  onToggleCompare,
  onClearCompare,
  compareOnly = false,
  onToggleCompareOnly,
  compareNotice = null,
  onUpdateSettings,
  onUploadRawFiles,
  onRemoveFile,
  onClearAllFiles,
  onChangeManualDepoStep,
  onChangeManualPlSteps,
  onNavigateToCtcl,
}) => {
  const { theme, themeMode } = useTheme();
  const [copiedTable, setCopiedTable] = useState<string | null>(null);
  // 표 번호 칸 클릭: 그 Recipe를 선택하고 공정 Sequence 타임라인을 펼쳐 보여줌
  const [ganttFocus, setGanttFocus] = useState<number>(0);
  const focusTimeline = (idx: number) => {
    onSelectRunIdx?.(idx);
    setGanttFocus(k => k + 1);
  };

  // 비교 선택: Run별 A·B·C 위치 (-1 = 비교 아님)
  const compareSlots = results.map(r => compareKeys.indexOf(resultKey(r)));
  const slotOf = (idx: number) => compareSlots[idx] ?? -1;
  const compareFilterOn = compareOnly && compareKeys.length > 0;
  /** '선택만 보기'일 때 비교에 없는 행은 숨김 */
  const hideRow = (idx: number) => compareFilterOn && slotOf(idx) < 0;
  /** 표 '데이터 복사'도 화면과 같은 행만 */
  const visRows = <T,>(rows: T[]): T[] => (compareFilterOn ? rows.filter((_, i) => slotOf(i) >= 0) : rows);
  /** 행 클릭: Ctrl(⌘) + 클릭 = 비교 추가·빼기, 그냥 클릭 = 지금처럼 선택 */
  const handleRowClick = (e: React.MouseEvent, idx: number, isSelected: boolean) => {
    if ((e.ctrlKey || e.metaKey) && onToggleCompare && results[idx]) {
      e.preventDefault();
      onToggleCompare(resultKey(results[idx]));
      return;
    }
    onSelectRunIdx?.(isSelected ? null : idx);
  };
  /** 비교 중인 행 배경 (선택 행은 기존 파란 강조 유지) */
  const rowTint = (idx: number, isSelected: boolean): React.CSSProperties | undefined =>
    !isSelected && slotOf(idx) >= 0 ? { backgroundColor: COMPARE_TINTS[slotOf(idx)] } : undefined;
  const [isDelaySettingsOpen, setIsDelaySettingsOpen] = useState<boolean>(false);
  const [activeDevTab, setActiveDevTab] = useState<'rfMatcher' | 'presLift' | 'gas' | 'heater' | 'all'>('rfMatcher');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic variable aliases mapping (Left = Detected Raw Row 6, Right = User Custom Dashboard Name)
  const [customAliases, setCustomAliases] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    VARIABLE_DEFINITIONS.forEach(item => {
      initial[item.id] = item.defaultDashboardName;
    });
    return initial;
  });

  const getAlias = (id: string, fallback: string): string => {
    const val = customAliases[id];
    return val !== undefined && val.trim().length > 0 ? val : fallback;
  };

  const handleUpdateAlias = (id: string, newName: string) => {
    setCustomAliases(prev => ({
      ...prev,
      [id]: newName,
    }));
  };

  const handleResetAliases = () => {
    const reset: Record<string, string> = {};
    VARIABLE_DEFINITIONS.forEach(item => {
      reset[item.id] = item.defaultDashboardName;
    });
    setCustomAliases(reset);
  };

  // Helper for TSV clipboard copy with user feedback
  const handleCopy = async (tableId: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
    const ok = await copyTableToClipboard(headers, rows);
    if (ok) {
      setCopiedTable(tableId);
      setTimeout(() => setCopiedTable(null), 2000);
    }
  };

  const fmt = (val: number | null | undefined, digits = 1): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  const fmtSigned = (val: number | null | undefined, digits = 1): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    const fixed = val.toFixed(digits);
    if (fixed === '0.0' || fixed === '-0.0' || Math.abs(val) < 1e-9) {
      return `+${(0).toFixed(digits)}`;
    }
    return val > 0 ? `+${fixed}` : fixed;
  };

  // Dedicated formatter for seconds: outputs clean numbers without trailing 's' (since header indicates unit)
  const fmtSec = (val: number | null | undefined, signed = false): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    return signed ? fmtSigned(val, 1) : fmt(val, 1);
  };

  const fmtInt = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    return Math.round(val).toLocaleString();
  };

  const fmtPct = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    const fixed = val.toFixed(1);
    const s = val > 0 ? `+${fixed}` : (fixed === '0.0' || fixed === '-0.0' ? '+0.0' : fixed);
    return `${s}%`;
  };

  // Date formatter to strict yyyy-mm-dd format (e.g. 2026-07-29)
  const formatYYYYMMDD = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const trimmed = dateStr.trim();
    const m = trimmed.match(/^(?:(20\d{2})|(\d{2}))[-/.]?(\d{2})[-/.]?(\d{2})$/);
    if (m) {
      const yyyy = m[1] ? m[1] : `20${m[2]}`;
      return `${yyyy}-${m[3]}-${m[4]}`;
    }
    const yMatch = trimmed.match(/\b(?:(20\d{2})|(\d{2}))[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (yMatch) {
      const yyyy = yMatch[1] ? yMatch[1] : `20${yMatch[2]}`;
      return `${yyyy}-${yMatch[3].padStart(2, '0')}-${yMatch[4].padStart(2, '0')}`;
    }
    return trimmed;
  };

  // Helper for 2nd Sub-Group Excel 3-Color Scale (Red - Yellow - Green) conditional formatting
  const get3ColorStyleForCell = (
    val: number | null | undefined,
    rowGroupVals: (number | null | undefined)[],
    overallBounds: { min: number; max: number }
  ): React.CSSProperties => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
      return {};
    }

    const validRowNums = rowGroupVals.filter(
      (v): v is number => typeof v === 'number' && !isNaN(v) && isFinite(v)
    );

    let min = overallBounds.min;
    let max = overallBounds.max;

    if (validRowNums.length > 1) {
      const rowMin = Math.min(...validRowNums);
      const rowMax = Math.max(...validRowNums);
      if (rowMin !== rowMax) {
        min = rowMin;
        max = rowMax;
      }
    }

    if (min === max) {
      return { backgroundColor: '#FFEB84', color: '#000000', fontWeight: 'bold' };
    }

    const mid = (min + max) / 2;

    let r = 255;
    let g = 235;
    let b = 132;

    if (val <= mid) {
      const range = mid - min;
      const t = range === 0 ? 0 : (val - min) / range;
      // Green (#63BE7B -> rgb(99, 190, 123)) to Yellow (#FFEB84 -> rgb(255, 235, 132))
      r = Math.round(99 + (255 - 99) * t);
      g = Math.round(190 + (235 - 190) * t);
      b = Math.round(123 + (132 - 123) * t);
    } else {
      const range = max - mid;
      const t = range === 0 ? 0 : (val - mid) / range;
      // Yellow (#FFEB84 -> rgb(255, 235, 132)) to Red (#F8696B -> rgb(248, 105, 107))
      r = Math.round(255 + (248 - 255) * t);
      g = Math.round(235 + (105 - 235) * t);
      b = Math.round(132 + (107 - 132) * t);
    }

    return {
      backgroundColor: `rgb(${r}, ${g}, ${b})`,
      color: '#000000',
      fontWeight: 'bold',
    };
  };

  // Selected Row Cell Styling Helper (모든 표 공통 고밀도 균일 2.5px 블루 테두리 및 음영)
  const getSelectedTdStyle = (
    isSelected: boolean,
    isFirst = false,
    isLast = false,
    baseStyle?: React.CSSProperties
  ): React.CSSProperties => {
    if (!isSelected) {
      return baseStyle || {};
    }

    const borderColor = '#2563EB'; // 삼성/토스 정밀 블루
    const borderWidth = '2.5px';

    const shadows: string[] = [
      `inset 0 ${borderWidth} 0 0 ${borderColor}`,
      `inset 0 -${borderWidth} 0 0 ${borderColor}`,
    ];
    if (isFirst) {
      shadows.push(`inset ${borderWidth} 0 0 0 ${borderColor}`);
    }
    if (isLast) {
      shadows.push(`inset -${borderWidth} 0 0 0 ${borderColor}`);
    }

    const merged: React.CSSProperties = {
      ...baseStyle,
      position: 'relative',
      zIndex: 5,
      borderTop: `${borderWidth} solid ${borderColor}`,
      borderBottom: `${borderWidth} solid ${borderColor}`,
      boxShadow: shadows.join(', '),
    };

    if (isFirst) {
      merged.borderLeft = `${borderWidth} solid ${borderColor}`;
    }
    if (isLast) {
      merged.borderRight = `${borderWidth} solid ${borderColor}`;
    }

    if (baseStyle?.backgroundColor) {
      // 조건부 서식(Heat-map) 셀의 경우 기존 색상을 명확히 유지하면서 세련된 블루 틴트 오버레이 적용
      merged.backgroundColor = baseStyle.backgroundColor;
      merged.backgroundImage = 'linear-gradient(rgba(37, 99, 235, 0.20), rgba(37, 99, 235, 0.20))';
    } else {
      // 일반 셀 및 비어있는 셀의 경우 깔끔한 연파랑 음영(#DBEAFE) 적용
      merged.backgroundColor = '#DBEAFE';
    }

    return merged;
  };

  // 2차 서브 그룹 구획별 min/max 독립적 산출
  // H/W Control Start: 'Depo Stable' + 'Depo'(Power) -> 1개 구획(7열), 'PL Stable' + 'PL Step'(Power) -> 1개 구획(4열)
  const hwSubGroupStats = useMemo(() => {
    const startDepo: number[] = []; // Start: Depo. Stable (6 cols) + Depo. Power (1 col)
    const startPL: number[] = [];   // Start: PL Stable (3 cols) + PL Step Power (1 col)
    const g5: number[] = [];        // End Depo. Step (7 cols)
    const g6: number[] = [];        // End PL Step (4 cols)

    const pushValid = (arr: number[], v: number | null | undefined) => {
      if (v !== null && v !== undefined && !isNaN(v) && isFinite(v)) {
        arr.push(v);
      }
    };

    results.forEach(r => {
      const s = r.hwStart;
      const e = r.hwEndRF;

      // Group 1: Start Depo (Depo Stable 6 cols + Depo Power 1 col = 7 cols)
      pushValid(startDepo, s.depoStable_pyroN2O);
      pushValid(startDepo, s.depoStable_pyroNH3);
      pushValid(startDepo, s.depoStable_pyroPN2);
      pushValid(startDepo, s.depoStable_pyroH2);
      pushValid(startDepo, s.depoStable_pyroSiH4);
      pushValid(startDepo, s.depoStable_tvCtrlMode);
      pushValid(startDepo, s.depo_rfForwardAct);

      // Group 2: Start PL (PL Stable 3 cols + PL Step Power 1 col = 4 cols)
      pushValid(startPL, s.plStable_pyroAr);
      pushValid(startPL, s.plStable_pyroH2);
      pushValid(startPL, s.plStable_tvCtrlMode);
      pushValid(startPL, s.pl_rfForwardAct);

      // Group 5: End Depo. Step (8 cols: Power, T/V, SiH4, Ar, N2O, NH3, PN2, H2)
      pushValid(g5, e.depo_rfForwardAct);
      pushValid(g5, e.depo_tvCtrlMode);
      pushValid(g5, e.depo_pyroSiH4);
      pushValid(g5, e.depo_pyroAr);
      pushValid(g5, e.depo_pyroN2O);
      pushValid(g5, e.depo_pyroNH3);
      pushValid(g5, e.depo_pyroPN2);
      pushValid(g5, e.depo_pyroH2);

      // Group 6: End PL Step (4 cols)
      pushValid(g6, e.pl_rfForwardAct);
      pushValid(g6, e.pl_tvCtrlMode);
      pushValid(g6, e.pl_pyroAr);
      pushValid(g6, e.pl_pyroH2);
    });

    const getBounds = (arr: number[]) => ({
      min: arr.length > 0 ? Math.min(...arr) : 0,
      max: arr.length > 0 ? Math.max(...arr) : 0,
    });

    const startDepoBounds = getBounds(startDepo);
    const startPLBounds = getBounds(startPL);

    return {
      startDepo: startDepoBounds,
      startPL: startPLBounds,
      g1: startDepoBounds,
      g2: startDepoBounds,
      g3: startPLBounds,
      g4: startPLBounds,
      g5: getBounds(g5),
      g6: getBounds(g6),
    };
  }, [results]);

  // Total raw lines across all uploaded files
  const totalRawRows = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.rows?.length || 0), 0);
  }, [files]);

  // Helper for detecting active start reaction gas (순서: Ar, N2O, NH3, PN2, H2)
  const getStartReactionGas = (s: HWControlStartRow) => {
    if (s.depoStable_pyroAr !== null && s.depoStable_pyroAr !== undefined) {
      return { name: 'Ar', val: s.depoStable_pyroAr };
    }
    if (s.depoStable_pyroN2O !== null && s.depoStable_pyroN2O !== undefined) {
      return { name: 'N2O', val: s.depoStable_pyroN2O };
    }
    if (s.depoStable_pyroNH3 !== null && s.depoStable_pyroNH3 !== undefined) {
      return { name: 'NH3', val: s.depoStable_pyroNH3 };
    }
    if (s.depoStable_pyroPN2 !== null && s.depoStable_pyroPN2 !== undefined) {
      return { name: 'PN2', val: s.depoStable_pyroPN2 };
    }
    if (s.depoStable_pyroH2 !== null && s.depoStable_pyroH2 !== undefined) {
      return { name: 'H2', val: s.depoStable_pyroH2 };
    }
    return null;
  };

  // Helper for detecting active end purge/reaction gas (순서: Ar, N2O, NH3, PN2, H2)
  const getEndReactionGas = (e: HWControlEndRFRow) => {
    if (e.depo_pyroAr !== null && e.depo_pyroAr !== undefined) {
      return { name: 'Ar', val: e.depo_pyroAr };
    }
    if (e.depo_pyroN2O !== null && e.depo_pyroN2O !== undefined) {
      return { name: 'N2O', val: e.depo_pyroN2O };
    }
    if (e.depo_pyroNH3 !== null && e.depo_pyroNH3 !== undefined) {
      return { name: 'NH3', val: e.depo_pyroNH3 };
    }
    if (e.depo_pyroPN2 !== null && e.depo_pyroPN2 !== undefined) {
      return { name: 'PN2', val: e.depo_pyroPN2 };
    }
    if (e.depo_pyroH2 !== null && e.depo_pyroH2 !== undefined) {
      return { name: 'H2', val: e.depo_pyroH2 };
    }
    return null;
  };

  const renderGasBadgeTag = (name: string) => {
    const colorMap: Record<string, string> = {
      N2O: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 border-blue-200 dark:border-blue-800',
      NH3: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
      H2: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200 border-purple-200 dark:border-purple-800',
      PN2: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800',
      Ar: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200 dark:border-amber-800',
    };
    const cls = colorMap[name] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200';
    return (
      <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold border ${cls}`}>
        {name}
      </span>
    );
  };

  // Industrial Titanium Signature Highlight Tints (Toss Dark Style):
  // 1. Stable Gas: Theme-aware font color
  const renderStableGasBadge = (valStr: string) => {
    if (valStr === '-') return <span className="text-slate-400 font-sans tabular-nums text-[11px]">-</span>;
    return (
      <span className={`${theme.tableCellTextColor} font-bold font-sans tabular-nums text-[11px]`}>
        {valStr}
      </span>
    );
  };

  // 2. T/V Mode: Theme-aware font color
  const renderTVModeBadge = (valStr: string) => {
    if (valStr === '-') return <span className="text-slate-400 font-sans tabular-nums text-[11px]">-</span>;
    return (
      <span className={`${theme.tableCellTextColor} font-bold font-sans tabular-nums text-[11px]`}>
        {valStr}
      </span>
    );
  };

  // 3. RF Power On / Reached: Theme-aware font color
  const renderRFPowerBadge = (valStr: string) => {
    if (valStr === '-') return <span className="text-slate-400 font-sans tabular-nums text-[11px]">-</span>;
    return (
      <span className={`${theme.tableCellTextColor} font-bold font-sans tabular-nums text-[11px]`}>
        {valStr}
      </span>
    );
  };

  // 4. EC Alarm/Warning Cell: Crisp Toss White mode alarm & warning badges
  const renderAlarmSpan = (
    valStr: string,
    level: 'normal' | 'warning' | 'alarm' | undefined
  ) => {
    if (valStr === '-' || !level || level === 'normal') {
      return <span className={`${theme.tableCellTextColor} font-bold font-sans tabular-nums text-[11px]`}>{valStr}</span>;
    }
    if (level === 'alarm') {
      return (
        <span className="inline-flex items-center justify-center text-[#991B1B] font-bold font-sans tabular-nums text-[11px] px-1.5 py-0.5 rounded bg-[#FECACA] border border-[#F87171] shadow-2xs leading-none">
          {valStr}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center text-[#92400E] font-bold font-sans tabular-nums text-[11px] px-1.5 py-0.5 rounded bg-[#FDE68A] border border-[#F59E0B] shadow-2xs leading-none">
        {valStr}
      </span>
    );
  };

  const renderDelayCell = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
      return <span className="text-slate-400 font-sans tabular-nums text-[11px]">-</span>;
    }
    const valStr = fmtSigned(val, 1);
    const warnSec = settings.ecDelayWarningSec ?? 0.3;
    const alarmSec = settings.ecDelayAlarmSec ?? 0.5;

    let level: 'normal' | 'warning' | 'alarm' = 'normal';
    if (alarmSec !== null && alarmSec !== undefined && val > alarmSec) {
      level = 'alarm';
    } else if (warnSec !== null && warnSec !== undefined && val > warnSec) {
      level = 'warning';
    }

    return renderAlarmSpan(valStr, level);
  };

  const renderDevCell = (stat: DeviationStat, type: 'min' | 'max') => {
    if (stat.isReflectW) {
      const val = type === 'min' ? stat.minDev : stat.maxDev;
      const level = type === 'min' ? stat.minAlarmLevel : stat.maxAlarmLevel;
      if (val === null || val === undefined) return <span className="text-slate-400 font-sans tabular-nums text-[11px]">-</span>;
      const fixed = val.toFixed(1);
      const str = val > 0 ? `+${fixed}` : (fixed === '0.0' || fixed === '-0.0' ? '+0.0' : fixed);
      return renderAlarmSpan(str, level);
    }

    if (stat.isHeaterC) {
      const val = type === 'min' ? stat.minDev : stat.maxDev;
      const level = type === 'min' ? stat.minAlarmLevel : stat.maxAlarmLevel;
      if (val === null || val === undefined) return <span className="text-slate-400 font-sans tabular-nums text-[11px]">-</span>;
      const fixed = val.toFixed(1);
      const str = val > 0 ? `+${fixed}` : (fixed === '0.0' || fixed === '-0.0' ? '+0.0' : fixed);
      return renderAlarmSpan(str, level);
    }

    const valPct = type === 'min' ? stat.minDevPct : stat.maxDevPct;
    const level = type === 'min' ? stat.minAlarmLevel : stat.maxAlarmLevel;
    if (valPct === null || valPct === undefined) return <span className="text-slate-400 font-sans tabular-nums text-[11px]">-</span>;
    const fixed = valPct.toFixed(1);
    const str = valPct > 0 ? `+${fixed}` : (fixed === '0.0' || fixed === '-0.0' ? '+0.0' : fixed);
    return renderAlarmSpan(str, level);
  };

  const renderMinMaxDevCells = (stat: DeviationStat) => {
    if (stat.isReflectW) {
      if (stat.minDev === null || stat.minDev === undefined || stat.maxDev === null || stat.maxDev === undefined) {
        return <span className="text-[#9CA3AF] font-sans tabular-nums text-[11px]">-</span>;
      }
      const minStr = `${stat.minDev > 0 ? '+' : ''}${stat.minDev.toFixed(1)}`;
      const maxStr = `${stat.maxDev > 0 ? '+' : ''}${stat.maxDev.toFixed(1)}`;
      return (
        <span className="inline-flex items-center justify-center gap-1 font-sans tabular-nums text-[11px]">
          {renderAlarmSpan(minStr, stat.minAlarmLevel)}
          <span className="text-[#6B7280]">~</span>
          {renderAlarmSpan(maxStr, stat.maxAlarmLevel)}
        </span>
      );
    }

    if (stat.isHeaterC) {
      if (stat.minDev === null || stat.minDev === undefined || stat.maxDev === null || stat.maxDev === undefined) {
        return <span className="text-[#9CA3AF] font-sans tabular-nums text-[11px]">-</span>;
      }
      const minStr = `${stat.minDev > 0 ? '+' : ''}${stat.minDev.toFixed(1)}`;
      const maxStr = `${stat.maxDev > 0 ? '+' : ''}${stat.maxDev.toFixed(1)}`;
      return (
        <span className="inline-flex items-center justify-center gap-1 font-sans tabular-nums text-[11px]">
          {renderAlarmSpan(minStr, stat.minAlarmLevel)}
          <span className="text-[#6B7280]">~</span>
          {renderAlarmSpan(maxStr, stat.maxAlarmLevel)}
        </span>
      );
    }

    if (stat.minDevPct === null || stat.minDevPct === undefined || stat.maxDevPct === null || stat.maxDevPct === undefined) {
      return <span className="text-[#9CA3AF] font-sans tabular-nums text-[11px]">-</span>;
    }
    const minStr = `${stat.minDevPct > 0 ? '+' : ''}${stat.minDevPct.toFixed(1)}`;
    const maxStr = `${stat.maxDevPct > 0 ? '+' : ''}${stat.maxDevPct.toFixed(1)}`;
    return (
      <span className="inline-flex items-center justify-center gap-1 font-sans tabular-nums text-[11px]">
        {renderAlarmSpan(minStr, stat.minAlarmLevel)}
        <span className="text-[#6B7280]">~</span>
        {renderAlarmSpan(maxStr, stat.maxAlarmLevel)}
      </span>
    );
  };

  // Dynamic discovery of all unique heater zones across loaded files (strictly excluding TV1, TV2, RPSC)
  const allHeaterZones = useMemo(() => {
    const zoneMap = new Map<string, { id: string; name: string }>();
    const isExcluded = (name: string) => {
      const l = name.toLowerCase().trim();
      return /\b(tv\d*|t\/v\d*|throttle|rpsc)\b/i.test(l) || l.startsWith('tv') || l.includes('rpsc') || l.includes('throttle');
    };

    // If a run is selected, prioritize its heater definitions first
    const targetResults = (selectedRunIdx !== null && selectedRunIdx !== undefined && results[selectedRunIdx])
      ? [results[selectedRunIdx], ...results.filter((_, idx) => idx !== selectedRunIdx)]
      : results;

    targetResults.forEach(r => {
      if (r.dynamicHeaterDefs && r.dynamicHeaterDefs.length > 0) {
        r.dynamicHeaterDefs.forEach(def => {
          if (!isExcluded(def.name) && !zoneMap.has(def.name)) {
            zoneMap.set(def.name, { id: def.id, name: def.name });
          }
        });
      }
    });
    if (zoneMap.size === 0) {
      return [
        { id: 'gate_in_1', name: 'Gate 1' },
        { id: 'window_in_3', name: 'Win In 3' },
        { id: 'window_out_4', name: 'Win Out 4' },
        { id: 'side_in_5', name: 'Side 5' },
      ];
    }
    return Array.from(zoneMap.values());
  }, [results, selectedRunIdx]);

  const [isHeaterExpanded, setIsHeaterExpanded] = useState<boolean>(false);
  const displayedHeaterZones = useMemo(() => {
    return isHeaterExpanded ? allHeaterZones : allHeaterZones.slice(0, 4);
  }, [isHeaterExpanded, allHeaterZones]);

  // Monitoring Data 신뢰성 분석 표 전용 Heater 요약/전체 토글 상태
  const [isMonHeaterExpanded, setIsMonHeaterExpanded] = useState<boolean>(false);
  const monDisplayedHeaterZones = useMemo(() => {
    return isMonHeaterExpanded ? allHeaterZones : allHeaterZones.slice(0, 4);
  }, [isMonHeaterExpanded, allHeaterZones]);

  // 1. Process Data Set Headers & Rows for copy (Table 1 with dynamic heaters)
  const setHeaders = [
    'No.',
    'RCP Name',
    'Depo. Step',
    'Date',
    'Depo. Time: Set(sec)',
    'Depo. Time: Ramp Up 포함 Time(sec)',
    'Lift: Home Spacing(mils)',
    'RF Power(W)',
    'RF Ramping: Up(W/sec)',
    'RF Ramping: Down(W/sec)',
    getAlias('tv_press', 'Pres.(mTorr)'),
    getAlias('lift_spacing', 'Spacing(mils)'),
    getAlias('n2o', 'N2O(sccm)'),
    getAlias('nh3', 'NH3(sccm)'),
    getAlias('ar', 'Ar(sccm)'),
    getAlias('pn2', 'PN2(sccm)'),
    getAlias('sih4', 'SiH4(sccm)'),
    getAlias('h2', 'H2(sccm)'),
    ...displayedHeaterZones.map(z => `${z.name}(℃)`)
  ];
  const setRows = results.map(r => {
    const p = r.processData;
    const heaterVals = displayedHeaterZones.map(zone => {
      let val: number | null | undefined = p.dynamicHeaters?.[zone.name];
      if (val === undefined || val === null || val === 0) {
        const monAct = r.monitoringData?.dynamicHeaterActs?.[zone.name];
        if (monAct !== null && monAct !== undefined && monAct > 0) {
          val = monAct;
        } else if (zone.id === 'gate_in_1') {
          val = p.gateIn1Set;
        } else if (zone.id === 'window_in_3') {
          val = p.windowIn3Set;
        } else if (zone.id === 'window_out_4') {
          val = p.windowOut4Set;
        } else if (zone.id === 'side_in_5') {
          val = p.side1In5Set;
        }
      }
      return val !== null && val !== undefined && val > 0 ? fmt(val, 1) : '-';
    });

    return [
      p.no,
      p.rcpName,
      p.step,
      formatYYYYMMDD(p.date),
      p.stepTimeSet !== null ? fmt(p.stepTimeSet, 1) : '-',
      p.depTimeWithRampUp !== null && p.depTimeWithRampUp !== undefined ? fmt(p.depTimeWithRampUp, 1) : (p.depTimeSetReached !== null ? fmt(p.depTimeSetReached, 1) : '-'),
      p.rfOffsetHomeSpacing !== null ? fmtInt(p.rfOffsetHomeSpacing) : '-',
      p.rfForwardSetValue !== null ? fmtInt(p.rfForwardSetValue) : '-',
      p.rfRampUp !== null ? fmt(p.rfRampUp, 1) : (p.rfRampValueUp !== null ? fmt(p.rfRampValueUp, 1) : '-'),
      p.rfRampDown !== null ? fmt(p.rfRampDown, 1) : '-',
      fmtInt(p.tvPressureSet),
      fmtInt(p.liftSpacingSet),
      fmtInt(p.pyroN2OSet),
      fmtInt(p.pyroNH3Set),
      fmtInt(p.pyroArSet),
      fmtInt(p.pyroPN2Set),
      fmtInt(p.pyroSiH4Set),
      fmtInt(p.pyroH2Set),
      ...heaterVals,
    ];
  });

  // 2. Monitoring Actual Data Headers & Rows (Delays separated to section 5)
  const monHeaders = [
    'No.',
    'RCP Name',
    `Max: ${getAlias('rf_reflect', 'Ref.')}(W)`,
    `Average: ${getAlias('tv_pos', 'T/V Pos.')}(%)`,
    'RSD: Power(W)',
    'RSD: Time(sec)',
    `Average: ${getAlias('matcher_load', 'Load')}(%)`,
    `Average: ${getAlias('matcher_tune', 'Tune')}(%)`,
    `Average: ${getAlias('matcher_r', 'R')}(Ω)`,
    `Average: ${getAlias('matcher_x', 'X')}(Ω)`,
    `Average: ${getAlias('matcher_vpp', 'Vpp')}(V)`,
    `Average: ${getAlias('matcher_irms', 'Irms')}(A)`,
    `Average: ${getAlias('matcher_vdc', 'Vdc')}(V)`
  ];

  // Helper to dynamically resolve Matcher R and X with CTCL Matrix fallback
  const getMatcherRX = (m: MonitoringDataRow) => {
    let rVal = m.rfChR;
    let xVal = m.rfChX;
    if ((rVal === null || xVal === null) && ctclMatrix && m.matcherLoadAvg !== null && m.matcherTuneAvg !== null && (m.matcherLoadAvg > 0 || m.matcherTuneAvg > 0)) {
      const interp = interpolateCTCL(ctclMatrix, m.matcherLoadAvg, m.matcherTuneAvg);
      if (interp) {
        rVal = interp.r;
        xVal = interp.x;
      }
    }
    return { r: rVal, x: xVal };
  };

  const monRows = results.map(r => {
    const m = r.monitoringData;
    const { r: rVal, x: xVal } = getMatcherRX(m);
    return [
      m.no,
      m.rcpName,
      m.rfReflectPowerMax !== null ? fmt(m.rfReflectPowerMax, 1) : '-',
      m.tvPositionAvg !== null ? `${fmt(m.tvPositionAvg, 1)}${m.tvPositionIsFullOpen ? ' (Full Open)' : ''}` : '-',
      (m.rsdPower !== null && m.rsdPower !== undefined)
        ? fmtInt(m.rsdPower)
        : (r.processData?.rsdPower !== null && r.processData?.rsdPower !== undefined ? fmtInt(r.processData.rsdPower) : '-'),
      (m.rsdTime !== null && m.rsdTime !== undefined)
        ? fmt(m.rsdTime, 1)
        : (r.processData?.rsdTime !== null && r.processData?.rsdTime !== undefined ? fmt(r.processData.rsdTime, 1) : '-'),
      m.matcherLoadAvg !== null ? fmt(m.matcherLoadAvg, 1) : '-',
      m.matcherTuneAvg !== null ? fmt(m.matcherTuneAvg, 1) : '-',
      rVal !== null ? fmt(rVal, 2) : '-',
      xVal !== null ? fmt(xVal, 2) : '-',
      m.matcherNoSignal ? '0' : (m.matcherVppAvg !== null ? fmtInt(m.matcherVppAvg) : '-'),
      m.matcherNoSignal ? '0' : (m.matcherIrmsAvg !== null ? fmtInt(m.matcherIrmsAvg) : '-'),
      m.matcherNoSignal ? '0' : (m.matcherDCBiasAvg !== null ? fmt(m.matcherDCBiasAvg, 1) : '-')
    ];
  });

  // 3. HW Timing (Start & End) Headers & Rows
  const hwTimingHeaders = [
    'No.',
    'RCP Name',
    // Start (12 cols)
    `Start Depo. Stable: ${getAlias('ar', 'Ar')}`,
    `Start Depo. Stable: ${getAlias('n2o', 'N2O')}`,
    `Start Depo. Stable: ${getAlias('nh3', 'NH3')}`,
    `Start Depo. Stable: ${getAlias('pn2', 'PN2')}`,
    `Start Depo. Stable: ${getAlias('h2', 'H2')}`,
    `Start Depo. Stable: ${getAlias('sih4', 'SiH4')}`,
    `Start Depo. Stable: ${getAlias('tv_mode', 'T/V')}`,
    `Start Depo.: ${getAlias('rf_power', 'Power')}`,
    `Start PL Stable: ${getAlias('ar', 'Ar')}`,
    `Start PL Stable: ${getAlias('h2', 'H2')}`,
    `Start PL Stable: ${getAlias('tv_mode', 'T/V')}`,
    `Start PL: ${getAlias('rf_power', 'Power')}`,
    // End (12 cols)
    `End Depo.: ${getAlias('rf_power', 'Power')}`,
    `End Depo.: ${getAlias('tv_mode', 'T/V')}`,
    `End Depo.: ${getAlias('sih4', 'SiH4')}`,
    `End Depo.: ${getAlias('ar', 'Ar')}`,
    `End Depo.: ${getAlias('n2o', 'N2O')}`,
    `End Depo.: ${getAlias('nh3', 'NH3')}`,
    `End Depo.: ${getAlias('pn2', 'PN2')}`,
    `End Depo.: ${getAlias('h2', 'H2')}`,
    `End PL: ${getAlias('rf_power', 'Power')}`,
    `End PL: ${getAlias('tv_mode', 'T/V')}`,
    `End PL: ${getAlias('ar', 'Ar')}`,
    `End PL: ${getAlias('h2', 'H2')}`,
    'End 기준 (0.0sec)'
  ];
  /** H/W Control 칸 문자열: '유지' / '전환 x.x' / 일반 값 */
  const hwTxt = (
    row: { cellStatus?: Partial<Record<string, 'keep' | 'trans'>> } | null | undefined,
    field: string,
    val: number | null | undefined,
    signed = true
  ): string => {
    const st = hwStatusOf(row, field);
    return st ? fmtHwStatus(st, val) : fmtSec(val, signed);
  };
  const hwTimingRows = results.map(r => {
    const s = r.hwStart;
    const e = r.hwEndRF;
    return [
      s.no,
      s.rcpName,
      hwTxt(s, 'depoStable_pyroAr', s.depoStable_pyroAr),
      hwTxt(s, 'depoStable_pyroN2O', s.depoStable_pyroN2O),
      hwTxt(s, 'depoStable_pyroNH3', s.depoStable_pyroNH3),
      hwTxt(s, 'depoStable_pyroPN2', s.depoStable_pyroPN2),
      hwTxt(s, 'depoStable_pyroH2', s.depoStable_pyroH2),
      hwTxt(s, 'depoStable_pyroSiH4', s.depoStable_pyroSiH4),
      hwTxt(s, 'depoStable_tvCtrlMode', s.depoStable_tvCtrlMode),
      hwTxt(s, 'depo_rfForwardAct', s.depo_rfForwardAct),
      hwTxt(s, 'plStable_pyroAr', s.plStable_pyroAr),
      hwTxt(s, 'plStable_pyroH2', s.plStable_pyroH2),
      hwTxt(s, 'plStable_tvCtrlMode', s.plStable_tvCtrlMode),
      hwTxt(s, 'pl_rfForwardAct', s.pl_rfForwardAct),
      hwTxt(e, 'depo_rfForwardAct', e.depo_rfForwardAct),
      hwTxt(e, 'depo_tvCtrlMode', e.depo_tvCtrlMode),
      hwTxt(e, 'depo_pyroSiH4', e.depo_pyroSiH4),
      hwTxt(e, 'depo_pyroAr', e.depo_pyroAr),
      hwTxt(e, 'depo_pyroN2O', e.depo_pyroN2O),
      hwTxt(e, 'depo_pyroNH3', e.depo_pyroNH3),
      hwTxt(e, 'depo_pyroPN2', e.depo_pyroPN2),
      hwTxt(e, 'depo_pyroH2', e.depo_pyroH2),
      hwTxt(e, 'pl_rfForwardAct', e.pl_rfForwardAct),
      hwTxt(e, 'pl_tvCtrlMode', e.pl_tvCtrlMode),
      hwTxt(e, 'pl_pyroAr', e.pl_pyroAr),
      hwTxt(e, 'pl_pyroH2', e.pl_pyroH2),
      isBbEndRow(e) ? 'Step 전환(BB)' : 'RF Off'
    ];
  });

  // 3. 편차 & Uniformity 판정 Headers & Rows
  const ecHeaders = [
    'No.', 'RCP Name',
    `${getAlias('rf_power', 'Power')} Min(W)`, `${getAlias('rf_power', 'Power')} ΔMin(%)`, `${getAlias('rf_power', 'Power')} Max(W)`, `${getAlias('rf_power', 'Power')} ΔMax(%)`,
    `${getAlias('matcher_vpp', 'Vpp')} Min(V)`, `${getAlias('matcher_vpp', 'Vpp')} Max(V)`, `${getAlias('matcher_vpp', 'Vpp')} Unif.(%)`,
    `${getAlias('matcher_irms', 'Irms')} Min(A)`, `${getAlias('matcher_irms', 'Irms')} Max(A)`, `${getAlias('matcher_irms', 'Irms')} Unif.(%)`,
    `${getAlias('matcher_vdc', 'DC Bias')} Min(V)`, `${getAlias('matcher_vdc', 'DC Bias')} Max(V)`, `${getAlias('matcher_vdc', 'DC Bias')} Max-Min(V)`,
    `${getAlias('tv_press', 'Pres.')} Min(mTorr)`, `${getAlias('tv_press', 'Pres.')} ΔMin(%)`, `${getAlias('tv_press', 'Pres.')} Max(mTorr)`, `${getAlias('tv_press', 'Pres.')} ΔMax(%)`,
    `${getAlias('tv_pos', 'T/V')} Min(%)`, `${getAlias('tv_pos', 'T/V')} Max(%)`, `${getAlias('tv_pos', 'T/V')} Max-Min(%)`,
    `${getAlias('lift_spacing', 'Spacing')} Min(mm)`, `${getAlias('lift_spacing', 'Spacing')} ΔMin(%)`, `${getAlias('lift_spacing', 'Spacing')} Max(mm)`, `${getAlias('lift_spacing', 'Spacing')} ΔMax(%)`,
    `${getAlias('ar', 'Ar')} Min(sccm)`, `${getAlias('ar', 'Ar')} ΔMin(%)`, `${getAlias('ar', 'Ar')} Max(sccm)`, `${getAlias('ar', 'Ar')} ΔMax(%)`,
    `${getAlias('sih4', 'SiH4')} Min(sccm)`, `${getAlias('sih4', 'SiH4')} ΔMin(%)`, `${getAlias('sih4', 'SiH4')} Max(sccm)`, `${getAlias('sih4', 'SiH4')} ΔMax(%)`,
    `${getAlias('n2o', 'N2O')} Min(sccm)`, `${getAlias('n2o', 'N2O')} ΔMin(%)`, `${getAlias('n2o', 'N2O')} Max(sccm)`, `${getAlias('n2o', 'N2O')} ΔMax(%)`,
    `${getAlias('nh3', 'NH3')} Min(sccm)`, `${getAlias('nh3', 'NH3')} ΔMin(%)`, `${getAlias('nh3', 'NH3')} Max(sccm)`, `${getAlias('nh3', 'NH3')} ΔMax(%)`,
    `${getAlias('pn2', 'PN2')} Min(sccm)`, `${getAlias('pn2', 'PN2')} ΔMin(%)`, `${getAlias('pn2', 'PN2')} Max(sccm)`, `${getAlias('pn2', 'PN2')} ΔMax(%)`,
    `${getAlias('h2', 'H2')} Min(sccm)`, `${getAlias('h2', 'H2')} ΔMin(%)`, `${getAlias('h2', 'H2')} Max(sccm)`, `${getAlias('h2', 'H2')} ΔMax(%)`,
    ...monDisplayedHeaterZones.flatMap(z => [
      `${z.name} Min(℃)`, `${z.name} ΔMin(℃)`, `${z.name} Max(℃)`, `${z.name} ΔMax(℃)`
    ])
  ];
  const ecRows = results.map(r => {
    const d = r.deviation;
    return [
      d.no, d.rcpName,
      fmtInt(d.rfForward.min), fmtPct(d.rfForward.minDevPct), fmtInt(d.rfForward.max), fmtPct(d.rfForward.maxDevPct),
      fmtInt(d.matcherVpp.min), fmtInt(d.matcherVpp.max), fmtPct(d.matcherVpp.uniformityPct),
      fmtInt(d.matcherIrms.min), fmtInt(d.matcherIrms.max), fmtPct(d.matcherIrms.uniformityPct),
      fmtInt(d.matcherDCBias.min), fmtInt(d.matcherDCBias.max), fmt(d.matcherDCBias.range, 1),
      fmtInt(d.tvPressure.min), fmtPct(d.tvPressure.minDevPct), fmtInt(d.tvPressure.max), fmtPct(d.tvPressure.maxDevPct),
      fmt(d.tvPosition.min), fmt(d.tvPosition.max), fmt(d.tvPosition.range, 1),
      fmtInt(d.liftSpacing.min), fmtPct(d.liftSpacing.minDevPct), fmtInt(d.liftSpacing.max), fmtPct(d.liftSpacing.maxDevPct),
      fmtInt(d.pyroAr.min), fmtPct(d.pyroAr.minDevPct), fmtInt(d.pyroAr.max), fmtPct(d.pyroAr.maxDevPct),
      fmtInt(d.pyroSiH4.min), fmtPct(d.pyroSiH4.minDevPct), fmtInt(d.pyroSiH4.max), fmtPct(d.pyroSiH4.maxDevPct),
      fmtInt(d.pyroN2O.min), fmtPct(d.pyroN2O.minDevPct), fmtInt(d.pyroN2O.max), fmtPct(d.pyroN2O.maxDevPct),
      fmtInt(d.pyroNH3.min), fmtPct(d.pyroNH3.minDevPct), fmtInt(d.pyroNH3.max), fmtPct(d.pyroNH3.maxDevPct),
      fmtInt(d.pyroPN2.min), fmtPct(d.pyroPN2.minDevPct), fmtInt(d.pyroPN2.max), fmtPct(d.pyroPN2.maxDevPct),
      fmtInt(d.pyroH2.min), fmtPct(d.pyroH2.minDevPct), fmtInt(d.pyroH2.max), fmtPct(d.pyroH2.maxDevPct),
      ...monDisplayedHeaterZones.flatMap(zone => {
        const stat: DeviationStat =
          d.dynamicHeaterDevs?.[zone.name] ??
          (zone.id === 'gate_in_1'
            ? d.gateIn1
            : zone.id === 'window_in_3'
            ? d.windowIn3
            : zone.id === 'window_out_4'
            ? d.windowOut4
            : zone.id === 'side_in_5'
            ? d.side1In5
            : { min: null, max: null, isHeaterC: true, minAlarmLevel: 'normal', maxAlarmLevel: 'normal', alarmLevel: 'normal' });
        return [
          fmt(stat.min),
          stat.minDev !== null && stat.minDev !== undefined ? fmtSigned(stat.minDev) : '-',
          fmt(stat.max),
          stat.maxDev !== null && stat.maxDev !== undefined ? fmtSigned(stat.maxDev) : '-'
        ];
      })
    ];
  });

  // 4. Delays Headers & Rows (RF Delay, Matcher Delay, NF3, Ar, N2O, NH3, PN2, SiH4, H2)
  const delayHeaders = [
    'No.', 'RCP Name',
    `${getAlias('rf_power', 'RF')} Delay(sec)`,
    'Matcher Delay(sec)',
    getAlias('nf3', 'NF3'),
    getAlias('ar', 'Ar'),
    getAlias('n2o', 'N2O'),
    getAlias('nh3', 'NH3'),
    getAlias('pn2', 'PN2'),
    getAlias('sih4', 'SiH4'),
    getAlias('h2', 'H2')
  ];
  const delayRows = results.map(r => {
    const d = r.delays;
    return [
      d.no,
      d.rcpName,
      fmtSec(d.rfDelay, true),
      fmtSec(d.matcherDelay, true),
      fmtSec(d.gasDelay_oxyNF3, true),
      fmtSec(d.gasDelay_pyroAr, true),
      fmtSec(d.gasDelay_pyroN2O, true),
      fmtSec(d.gasDelay_pyroNH3, true),
      fmtSec(d.gasDelay_pyroPN2, true),
      fmtSec(d.gasDelay_pyroSiH4, true),
      fmtSec(d.gasDelay_pyroH2, true),
    ];
  });

  // 5. HW End Step Headers & Rows
  const hwEndStepHeaders = [
    'No.',
    'Total Step: Depo.', 'Total Step: PL',
    'Depo: RF Off', `Depo: ${getAlias('rf_power', 'Power')}`, `Depo: ${getAlias('tv_mode', 'T/V')}`, `Depo: ${getAlias('sih4', 'SiH4')}`, `Depo: ${getAlias('ar', 'Ar')}`, `Depo: ${getAlias('n2o', 'N2O')}`, `Depo: ${getAlias('nh3', 'NH3')}`, `Depo: ${getAlias('pn2', 'PN2')}`, `Depo: ${getAlias('h2', 'H2')}`,
    'PL: RF Off', `PL: ${getAlias('rf_power', 'Power')}`, `PL: ${getAlias('tv_mode', 'T/V')}`, `PL: ${getAlias('ar', 'Ar')}`, `PL: ${getAlias('h2', 'H2')}`
  ];
  // HW End Step Rows
  const hwEndStepRows = results.map(r => {
    const s = r.hwEndStep;
    return [
      s.no,
      fmtSec(s.totalStepTimeDepo), fmtSec(s.totalStepTimePL),
      fmtSec(s.depo_rfOffTime), hwTxt(s, 'depo_rfForwardAct', s.depo_rfForwardAct, false), hwTxt(s, 'depo_tvCtrlMode', s.depo_tvCtrlMode, false),
      hwTxt(s, 'depo_pyroSiH4', s.depo_pyroSiH4, false), hwTxt(s, 'depo_pyroAr', s.depo_pyroAr, false), hwTxt(s, 'depo_pyroN2O', s.depo_pyroN2O, false), hwTxt(s, 'depo_pyroNH3', s.depo_pyroNH3, false), hwTxt(s, 'depo_pyroPN2', s.depo_pyroPN2, false), hwTxt(s, 'depo_pyroH2', s.depo_pyroH2, false),
      fmtSec(s.pl_rfOffTime), fmtSec(s.pl_rfForwardAct), fmtSec(s.pl_tvCtrlMode),
      fmtSec(s.pl_pyroAr), fmtSec(s.pl_pyroH2)
    ];
  });

  // Depo Step 판정 조건 2-State (SiH4 Gas, RF Power: 포함 include, 제외 exclude)
  const criteria: DepoStepCriteriaMap = normalizeCriteria(settings.depoStepCriteria);

  const toggleDepoCriterion = (id: 'sih4' | 'rf') => {
    if (!onUpdateSettings) return;
    const current = criteria[id];
    // 토글 시 '포함' <-> '제외' 2가지 선택지만 전환
    const next: CriterionState = current === 'include' ? 'exclude' : 'include';

    onUpdateSettings({
      ...settings,
      depoStepCriteria: { ...criteria, [id]: next },
    });
  };

  return (
    <div className="w-full space-y-2 font-sans text-xs">
      {/* ========================================================= */}
      {/* 메인 작업 영역 (Excel 1:1 구조 1단 / 2단 / 3단 / 4단 100% Full Width) */}
      {/* ========================================================= */}
      <main className="w-full space-y-2">
        {/* 비교 선택 막대 + [비교] 카드 (2개 이상 고르면) */}
        <CompareBar
          results={results}
          compareKeys={compareKeys}
          compareOnly={compareOnly}
          onToggleCompareOnly={v => onToggleCompareOnly?.(v)}
          onRemove={k => onToggleCompare?.(k)}
          onClear={() => onClearCompare?.()}
          notice={compareNotice}
        />
        <CompareCard
          results={results}
          compareKeys={compareKeys}
          sections={[
            { title: 'Recipe', headers: setHeaders, rows: setRows, skipCols: [0, 1] },
            { title: 'Monitoring', headers: monHeaders, rows: monRows, skipCols: [0, 1] },
            { title: 'H/W Control', headers: hwTimingHeaders, rows: hwTimingRows, skipCols: [0, 1], unit: 'sec' },
            { title: '신뢰성', headers: ecHeaders, rows: ecRows, skipCols: [0, 1] },
          ]}
        />

        {/* --------------------------------------------------------- */}
        {/* 공정 시퀀스 인터랙티브 간트 타임라인 (Gantt Visualizer) */}
        {/* 맨 위 배치 & 기본 접힘 상태 */}
        {/* --------------------------------------------------------- */}
        <SequenceGanttVisualizer
          results={results}
          settings={settings}
          files={files}
          externalSelectedRunIdx={selectedRunIdx}
          onSelectRunIdx={onSelectRunIdx}
          focusSignal={ganttFocus}
        />

        {/* --------------------------------------------------------- */}
        {/* ① 1단: [공정 조건 Set 값 테이블] */}
        {/* Toss Dark Style & Category Accent System */}
        {/* --------------------------------------------------------- */}
        <section className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} transition-colors`}>
          <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs shrink-0" />
              <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>
                [Recipe Data] 공정 조건 Set 값
              </h3>

              {/* 구분선 */}
              <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:inline-block" />

              {/* Depo Step 판정 조건 2-State 토글 선택 (한줄 배치: SiH4 Gas, RF Power) */}
              <div className="flex items-center gap-1.5 flex-nowrap">
                <span className="text-[11px] font-semibold text-[#6B7684] dark:text-[#94A3B8] whitespace-nowrap">
                  Depo 판정:
                </span>
                {(
                  [
                    { id: 'sih4', label: 'SiH4 Gas' },
                    { id: 'rf', label: 'RF Power' },
                  ] as const
                ).map(item => {
                  const state = criteria[item.id];
                  const isInclude = state !== 'exclude'; // 기본: 포함 ('include')
                  const isExclude = state === 'exclude';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleDepoCriterion(item.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] rounded-lg border transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap ${
                        isInclude
                          ? 'bg-[#3182F6]/10 text-[#3182F6] border-[#3182F6]/40 dark:bg-[#3182F6]/20 dark:text-[#60A5FA] dark:border-[#3182F6]/50 shadow-2xs font-semibold'
                          : 'bg-[#FEE2E2]/70 text-[#DC2626] border-[#EF4444]/40 dark:bg-[#EF4444]/20 dark:text-[#F87171] dark:border-[#EF4444]/50 shadow-2xs font-semibold'
                      }`}
                      title={`${item.label}: ${
                        isInclude
                          ? '포함 (클릭 시 [제외 ✕]로 변경)'
                          : '제외 (클릭 시 [포함 ✓]로 변경)'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center text-[9px] transition-colors ${
                          isInclude
                            ? 'bg-[#3182F6] border border-[#3182F6] text-white'
                            : 'bg-[#DC2626] border border-[#DC2626] text-white'
                        }`}
                      >
                        {isInclude ? (
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        ) : (
                          <X className="w-2.5 h-2.5 stroke-[3]" />
                        )}
                      </span>
                      <span>{item.label}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          isInclude
                            ? 'bg-[#3182F6]/15 text-[#3182F6] dark:text-[#60A5FA]'
                            : 'bg-[#EF4444]/15 text-[#DC2626] dark:text-[#F87171]'
                        }`}
                      >
                        {isInclude ? '포함' : '제외'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 구분선 */}
              <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:inline-block" />

              {/* 데이터 산출 시점 (기존 Depo Step RF Off 설정값 개명 및 조화로운 스타일) */}
              <div className={`flex items-center gap-1.5 text-[11px] ${theme.cardTitleColor} ${theme.navPillBg} px-2.5 py-0.5 rounded-lg border ${theme.navPillBorder} whitespace-nowrap`}>
                <span className="font-semibold text-[#6B7684] dark:text-[#94A3B8]">데이터 산출 시점:</span>
                <span className="font-mono text-[11px] text-[#4E5968] dark:text-[#CBD5E1]">RF Off</span>
                <input
                  type="number"
                  step="1"
                  value={settings.readOffsetSec}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (onUpdateSettings && !isNaN(val)) {
                      onUpdateSettings({ ...settings, readOffsetSec: val });
                    }
                  }}
                  className={`w-11 px-1 py-0.5 text-center font-mono font-bold bg-white dark:bg-slate-800 border ${theme.cardBorder} ${theme.cardTitleColor} rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]`}
                  title="Depo Step 데이터 산출 시점 RF Off 오프셋 초(s) 수정"
                />
                <span className="text-[#4E5968] dark:text-[#CBD5E1]">초</span>
              </div>
            </div>

            <button
              onClick={() => handleCopy('set-table', setHeaders, visRows(setRows))}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${theme.btnSecondary} rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer`}
            >
              {copiedTable === 'set-table' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#059669]" />
                  <span className="text-[#059669]">복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#8B95A1]" />
                  <span>데이터 복사</span>
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto max-h-[360px] scrollbar-thin">
              <table className={`pd-grid w-full min-w-[1340px] text-center border-collapse font-sans whitespace-nowrap text-[11px] border ${theme.tableBorder} table-fixed`} style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={TABLE_COL_NO_STYLE} />
                  <col style={TABLE_COL_RCP_STYLE} />
                  <col style={TABLE_COL_STEP_STYLE} />
                  <col style={TABLE_COL_DATE_STYLE} />
                  {/* 나머지 파라미터 열 균등 분할 (14개 파라미터 열 + 동적 히터 열) */}
                  {Array.from({ length: 14 + displayedHeaterZones.length }).map((_, i) => (
                    <col key={i} style={{ width: `${100 / (14 + displayedHeaterZones.length)}%`, minWidth: '48px' }} />
                  ))}
                </colgroup>
                <thead className={`sticky top-0 z-30 border-b border-slate-400 text-[11px] font-bold font-sans`}>
                  {/* Tier 1 Header - Samsung/SK hynix Subtle 3% Tint Matrix */}
                  <tr className="border-b border-slate-400">
                    <th rowSpan={3} style={TABLE_COL_NO_STYLE} className={TABLE_TH_NO_CLASS}>No.</th>
                    <th rowSpan={3} style={TABLE_COL_RCP_STYLE} className={TABLE_TH_RCP_CLASS}>RCP Name</th>
                    <th rowSpan={3} style={TABLE_COL_STEP_STYLE} className={TINT_FIXED_TH1}>
                      <div className="leading-tight">Depo.<br />Step</div>
                    </th>
                    <th rowSpan={3} style={TABLE_COL_DATE_STYLE} className={TINT_FIXED_TH1}>Date</th>

                    {/* Depo. Time (2 cols) - Neutral Slate */}
                    <th colSpan={2} className={TINT_FIXED_TH1}>
                      Depo. Time
                    </th>

                    {/* Lift (1 col) - Sage/Teal 3% */}
                    <th colSpan={1} className={TINT_LIFT_TH1}>
                      Lift
                    </th>

                    {/* RF Power (1 col, rowSpan=2) - Blue 3% */}
                    <th rowSpan={2} className={TINT_RF_TH1}>
                      <div>RF Power</div>
                    </th>

                    {/* RF Ramping (2 cols) - Blue 3% */}
                    <th colSpan={2} className={TINT_RF_TH1}>
                      RF Ramping
                    </th>

                    {/* Pressure (1 col) - Sage/Teal 3% */}
                    <th rowSpan={2} className={TINT_PRES_TH1}>
                      <div>{getAlias('tv_press', 'Pres.')}</div>
                    </th>

                    {/* Lift Spacing (1 col) - Sage/Teal 3% */}
                    <th rowSpan={2} className={TINT_LIFT_TH1}>
                      <div>{getAlias('lift_spacing', 'Spacing')}</div>
                    </th>

                    {/* Gas MFC (6 cols) - Amber/Sand 3% */}
                    <th colSpan={6} className={TINT_GAS_TH1}>
                      Gas MFC
                    </th>

                    {/* Heaters (방안 A: 동적 히터 스마트 매핑 및 토글 확장) */}
                    <th colSpan={displayedHeaterZones.length} className={TINT_HEAT_TH1}>
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Heater</span>
                        {allHeaterZones.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setIsHeaterExpanded(!isHeaterExpanded)}
                            className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 cursor-pointer transition-all shadow-2xs"
                            title={isHeaterExpanded ? '4개 대표 존으로 요약' : `전체 ${allHeaterZones.length}개 존 펼쳐보기`}
                          >
                            {isHeaterExpanded ? '요약 ▴' : `전체 (${allHeaterZones.length}존) ▾`}
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>

                  {/* Tier 2 Header - Subtle Parameter Sub-headers */}
                  <tr className="border-b border-slate-400 text-[11px] font-sans font-semibold text-[#1E293B]">
                    {/* Depo. Time Sub-headers */}
                    <th className={TINT_FIXED_TH2}>Set</th>
                    <th className={`${TINT_FIXED_TH2} leading-tight`}>
                      <div>Ramp Up</div>
                      <div>포함 Time</div>
                    </th>

                    {/* Lift Sub-header */}
                    <th className={`${TINT_LIFT_TH2} leading-tight`}>
                      <div>Home</div>
                      <div>Spacing</div>
                    </th>

                    {/* RF Ramping Sub-headers */}
                    <th className={TINT_RF_TH2}>Up</th>
                    <th className={TINT_RF_TH2}>Down</th>

                    {/* Gas MFC Sub-headers */}
                    <th className={TINT_GAS_TH2}>{getAlias('n2o', 'N2O')}</th>
                    <th className={TINT_GAS_TH2}>{getAlias('nh3', 'NH3')}</th>
                    <th className={TINT_GAS_TH2}>{getAlias('ar', 'Ar')}</th>
                    <th className={TINT_GAS_TH2}>{getAlias('pn2', 'PN2')}</th>
                    <th className={TINT_GAS_TH2}>{getAlias('sih4', 'SiH4')}</th>
                    <th className={TINT_GAS_TH2}>{getAlias('h2', 'H2')}</th>

                    {/* Heaters Sub-headers (동적 히터 명칭) */}
                    {displayedHeaterZones.map(zone => (
                      <th key={zone.name} className={`${TINT_HEAT_TH2} truncate max-w-[85px]`} title={zone.name}>
                        {zone.name}
                      </th>
                    ))}
                  </tr>

                  {/* Tier 3 Units Row - Compact Neutral Light Slate */}
                  <tr className="bg-[#E2E8F0] font-sans text-[10px] font-semibold border-b border-slate-400 text-[#334155]">
                    {/* Depo. Time Units */}
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>

                    {/* Lift Unit */}
                    <th className={TINT_UNIT_TH}>(mils)</th>

                    {/* RF Power Unit */}
                    <th className={TINT_UNIT_TH}>(W)</th>

                    {/* RF Ramping Units */}
                    <th className={TINT_UNIT_TH}>(W/sec)</th>
                    <th className={TINT_UNIT_TH}>(W/sec)</th>

                    {/* Pressure Unit */}
                    <th className={TINT_UNIT_TH}>(mTorr)</th>

                    {/* Lift Spacing Unit */}
                    <th className={TINT_UNIT_TH}>(mils)</th>

                    {/* Gas MFC Units */}
                    <th className={TINT_UNIT_TH}>(sccm)</th>
                    <th className={TINT_UNIT_TH}>(sccm)</th>
                    <th className={TINT_UNIT_TH}>(sccm)</th>
                    <th className={TINT_UNIT_TH}>(sccm)</th>
                    <th className={TINT_UNIT_TH}>(sccm)</th>
                    <th className={TINT_UNIT_TH}>(sccm)</th>

                    {/* Heaters Units */}
                    {displayedHeaterZones.map(zone => (
                      <th key={zone.name} className={TINT_UNIT_TH}>(℃)</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`font-sans tabular-nums text-[11px] ${theme.tableCellTextColor}`}>
                  {results.map((r, idx) => {
                    const p = r.processData;
                    const isMulti = r.totalDepoStepsInFile && r.totalDepoStepsInFile > 1;
                    const isSelected = selectedRunIdx === idx;
                    if (hideRow(idx)) return null;
                    return (
                      <tr
                        key={r.resultId || `${r.fileId}_${r.depoStep}_${idx}`}
                        onClick={e => handleRowClick(e, idx, isSelected)}
                        style={rowTint(idx, isSelected)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#DBEAFE]'
                            : isMulti
                              ? theme.subRowBg
                              : (idx % 2 === 0 ? theme.tableRowBg : theme.tableRowAltBg)
                        } ${theme.tableRowHover}`}
                      >
                        <td style={getSelectedTdStyle(isSelected, true, false, TABLE_COL_NO_STYLE)} className={`${TABLE_TD_NO_CLASS} ${NO_CELL_LINK_CLASS}`} data-no-cell onClick={e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && onToggleCompare) { onToggleCompare(resultKey(r)); return; } focusTimeline(idx); }} title="눌러서 이 Recipe의 공정 Sequence 타임라인 보기 · Ctrl + 클릭 = 비교에 추가·빼기">
                          {isMulti ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded ${theme.subRowBadge} font-mono font-bold text-[10px]`}>
                              {p.no}
                            </span>
                          ) : (
                            <span className="font-bold">{p.no}</span>
                          )}
                        </td>
                        <td style={getSelectedTdStyle(isSelected, false, false, TABLE_COL_RCP_STYLE)} className={TABLE_TD_RCP_CLASS} title={p.rcpName}>
                          <div className="flex items-center gap-1 justify-start text-left truncate px-0.5"><CompareBadge slot={slotOf(idx)} />
                            <span className="truncate">{p.rcpName}</span>
                            {isMulti && (
                              <span className={`text-[9px] px-1 py-0.2 rounded ${theme.subRowBadge} font-mono font-medium shrink-0`}>
                                {criteria.sih4 === 'exclude' ? (r.depoStepName && !r.depoStepName.startsWith('Step ') ? r.depoStepName : `Step ${p.step}`) : `Depo ${r.subIndex}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={getSelectedTdStyle(isSelected, false, false, TABLE_COL_STEP_STYLE)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : 'border-slate-400'} font-bold text-[11px] font-sans text-center align-middle tabular-nums`}>
                          {isMulti ? (
                            <span className="text-slate-900 font-bold">{p.step}</span>
                          ) : (
                            p.step
                          )}
                        </td>
                        <td style={getSelectedTdStyle(isSelected, false, false, TABLE_COL_DATE_STYLE)} className={`py-1 px-1.5 border ${isSelected ? 'border-[#2563EB]' : 'border-slate-400'} font-bold text-slate-900 text-[11px] font-sans text-center align-middle whitespace-nowrap`}>
                          {formatYYYYMMDD(p.date)}
                        </td>
                        {/* Depo. Time */}
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{p.stepTimeSet !== null ? fmt(p.stepTimeSet, 1) : '-'}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{p.depTimeWithRampUp !== null && p.depTimeWithRampUp !== undefined ? fmt(p.depTimeWithRampUp, 1) : (p.depTimeSetReached !== null ? fmt(p.depTimeSetReached, 1) : '-')}</td>
                        {/* Lift Home Spacing */}
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{p.rfOffsetHomeSpacing !== null ? fmtInt(p.rfOffsetHomeSpacing) : '-'}</td>
                        {/* RF Power */}
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{p.rfForwardSetValue !== null ? fmtInt(p.rfForwardSetValue) : '-'}</td>
                        {/* RF Ramping */}
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{p.rfRampUp !== null ? fmt(p.rfRampUp, 1) : (p.rfRampValueUp !== null ? fmt(p.rfRampValueUp, 1) : '-')}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{p.rfRampDown !== null ? fmt(p.rfRampDown, 1) : '-'}</td>
                        {/* Pressure & Spacing */}
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.tvPressureSet)}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.liftSpacingSet)}</td>
                        {/* Gas MFC 6종 */}
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.pyroN2OSet)}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.pyroNH3Set)}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.pyroArSet)}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.pyroPN2Set)}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.pyroSiH4Set)}</td>
                        <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}>{fmtInt(p.pyroH2Set)}</td>
                        {/* Heaters (방안 A: 동적 히터 반응형 확장 렌더링) */}
                        {displayedHeaterZones.map((zone, zIdx) => {
                          const isLast = zIdx === displayedHeaterZones.length - 1;
                          let val: number | null | undefined = p.dynamicHeaters?.[zone.name];
                          if (val === undefined || val === null || val === 0) {
                            const monAct = r.monitoringData?.dynamicHeaterActs?.[zone.name];
                            if (monAct !== null && monAct !== undefined && monAct > 0) {
                              val = monAct;
                            } else if (zone.id === 'gate_in_1') {
                              val = p.gateIn1Set;
                            } else if (zone.id === 'window_in_3') {
                              val = p.windowIn3Set;
                            } else if (zone.id === 'window_out_4') {
                              val = p.windowOut4Set;
                            } else if (zone.id === 'side_in_5') {
                              val = p.side1In5Set;
                            }
                          }
                          return (
                            <td
                              key={zone.name}
                              style={getSelectedTdStyle(isSelected, false, isLast)}
                              className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-[11px] font-sans text-center align-middle tabular-nums`}
                              title={`${zone.name}: ${val !== null && val !== undefined && val > 0 ? `${fmt(val, 1)} ℃` : '미설정 / 데이터 없음'}`}
                            >
                              {val !== null && val !== undefined && val > 0 ? fmt(val, 1) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </section>

        {/* --------------------------------------------------------- */}
        {/* ② [Monitoring Data] 공정 조건 실제값 */}
        {/* Toss Tech Slate Theme */}
        {/* --------------------------------------------------------- */}
        <section className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} transition-colors`}>
          <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs" />
              <div className="flex items-center gap-2">
                <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor}`}>
                  [Monitoring Data] 공정 중 실제 값
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy('mon-table', monHeaders, visRows(monRows))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${theme.btnSecondary} rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer`}
              >
                {copiedTable === 'mon-table' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[#059669]">복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8B95A1]" />
                    <span>데이터 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto scrollbar-thin max-h-[460px]">
            <table className={`pd-grid w-full text-center border-collapse font-sans whitespace-nowrap text-[11px] border ${theme.tableBorder} table-fixed`} style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={TABLE_COL_NO_STYLE} />
                <col style={TABLE_COL_RCP_STYLE} />
                {/* 나머지 11개 열 전부 균등 분할 */}
                {Array.from({ length: 11 }).map((_, i) => (
                  <col key={i} style={{ width: `${100 / 11}%`, minWidth: '56px' }} />
                ))}
              </colgroup>
              <thead className={`sticky top-0 z-30 border-b border-slate-400 text-[11px] font-bold font-sans`}>
                {/* Top Level Category Row 0 */}
                <tr className="border-b border-slate-400">
                  <th colSpan={2} style={{ width: '185px' }} className={TINT_FIXED_TH1}>
                    기본 정보
                  </th>
                  <th colSpan={11} className={TINT_FIXED_TH1}>
                    <div className="text-[11px] font-bold font-sans tracking-tight text-[#0F172A]">[Monitoring Data] 공정 조건 실제값</div>
                    <div className="text-[10px] text-[#475569] font-medium font-sans tracking-tight">Depo Step (RF Stable Time 후 ~ RF Ramp Down 전)</div>
                  </th>
                </tr>

                {/* Tier 1 Header: Group Badges (Cell Merged) */}
                <tr className="border-b border-slate-400">
                  <th rowSpan={3} style={TABLE_COL_NO_STYLE} className={TABLE_TH_NO_CLASS}>No.</th>
                  <th rowSpan={3} style={TABLE_COL_RCP_STYLE} className={TABLE_TH_RCP_CLASS}>RCP Name</th>
                  {/* Max Ref: merged (RF 계통 - Blue 3%) */}
                  <th rowSpan={2} className={TINT_RF_TH1}>
                    <div>Max</div>
                    <div>{getAlias('rf_reflect', 'Ref.')}</div>
                  </th>
                  {/* T/V Pos: merged (Pres/Valve 계통 - Sage/Teal 3%) */}
                  <th rowSpan={2} className={TINT_PRES_TH1}>
                    <div>{getAlias('tv_pos', 'T/V Pos.')}</div>
                  </th>
                  {/* RSD (2 cols: Power, Time - Blue 3%) */}
                  <th colSpan={2} className={TINT_RF_TH1}>
                    RSD
                  </th>
                  {/* Matcher 7 (Blue 3%) */}
                  <th colSpan={7} className={TINT_MATCHER_TH1}>Matcher</th>
                </tr>

                {/* Tier 2 Header: Matcher Sub-headers */}
                <tr className="border-b border-slate-400 text-[11px] font-sans font-semibold text-[#1E293B]">
                  {/* RSD Sub-headers */}
                  <th className={TINT_RF_TH2}>Power</th>
                  <th className={TINT_RF_TH2}>Time</th>
                  {/* Matcher Sub-headers */}
                  <th className={TINT_MATCHER_TH2}>{getAlias('matcher_load', 'Load')}</th>
                  <th className={TINT_MATCHER_TH2}>{getAlias('matcher_tune', 'Tune')}</th>
                  <th className={TINT_MATCHER_TH2}>{getAlias('matcher_r', 'R')}</th>
                  <th className={TINT_MATCHER_TH2}>{getAlias('matcher_x', 'X')}</th>
                  <th className={TINT_MATCHER_TH2}>{getAlias('matcher_vpp', 'Vpp')}</th>
                  <th className={TINT_MATCHER_TH2}>{getAlias('matcher_irms', 'Irms')}</th>
                  <th className={TINT_MATCHER_TH2}>{getAlias('matcher_vdc', 'Vdc')}</th>
                </tr>

                {/* Tier 3 Header with Units */}
                <tr className="bg-[#E2E8F0] font-sans text-[10px] font-semibold border-b border-slate-400 text-[#334155]">
                  {/* Max: Ref */}
                  <th className={TINT_UNIT_TH}>(W)</th>
                  {/* T/V Pos */}
                  <th className={TINT_UNIT_TH}>(%)</th>
                  {/* RSD Units */}
                  <th className={TINT_UNIT_TH}>(W)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  {/* Matcher 7 */}
                  <th className={TINT_UNIT_TH}>(%)</th>
                  <th className={TINT_UNIT_TH}>(%)</th>
                  <th className={TINT_UNIT_TH}>(Ω)</th>
                  <th className={TINT_UNIT_TH}>(Ω)</th>
                  <th className={TINT_UNIT_TH}>(V)</th>
                  <th className={TINT_UNIT_TH}>(A)</th>
                  <th className={TINT_UNIT_TH}>(V)</th>
                </tr>
              </thead>
              <tbody className={`font-sans tabular-nums text-[11px] ${theme.tableCellTextColor}`}>
                {results.map((r, idx) => {
                  const m = r.monitoringData;
                  const isMulti = r.totalDepoStepsInFile && r.totalDepoStepsInFile > 1;
                  const isSelected = selectedRunIdx === idx;
                    if (hideRow(idx)) return null;
                  return (
                    <tr
                      key={r.resultId || `${r.fileId}_${r.depoStep}_${idx}`}
                      onClick={e => handleRowClick(e, idx, isSelected)}
                        style={rowTint(idx, isSelected)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#DBEAFE]'
                          : isMulti
                            ? theme.subRowBg
                            : (idx % 2 === 0 ? theme.tableRowBg : theme.tableRowAltBg)
                      } ${theme.tableRowHover}`}
                    >
                      <td style={getSelectedTdStyle(isSelected, true, false, TABLE_COL_NO_STYLE)} className={`${TABLE_TD_NO_CLASS} ${NO_CELL_LINK_CLASS}`} data-no-cell onClick={e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && onToggleCompare) { onToggleCompare(resultKey(r)); return; } focusTimeline(idx); }} title="눌러서 이 Recipe의 공정 Sequence 타임라인 보기 · Ctrl + 클릭 = 비교에 추가·빼기">
                        {isMulti ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded ${theme.subRowBadge} font-mono font-bold text-[10px]`}>
                            {m.no}
                          </span>
                        ) : (
                          <span className="font-bold">{m.no}</span>
                        )}
                      </td>
                      <td style={getSelectedTdStyle(isSelected, false, false, TABLE_COL_RCP_STYLE)} className={TABLE_TD_RCP_CLASS} title={m.rcpName}>
                        <div className="flex items-center gap-1 justify-start text-left truncate px-0.5"><CompareBadge slot={slotOf(idx)} />
                          <span className="truncate">{m.rcpName}</span>
                          {isMulti && (
                            <span className={`text-[9px] px-1 py-0.2 rounded ${theme.subRowBadge} font-mono font-medium shrink-0`}>
                              Depo {r.subIndex}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Max Ref */}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>
                        {renderAlarmSpan(m.rfReflectPowerMax !== null ? fmt(m.rfReflectPowerMax, 1) : '-', m.rfReflectAlarmLevel)}
                      </td>
                      {/* T/V Position */}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`} title={m.tvPositionIsFullOpen ? 'Full Open (100% 이상)' : undefined}>
                        <div className="inline-flex items-center justify-center gap-0.5">
                          <span className="font-bold">{m.tvPositionAvg !== null ? fmt(m.tvPositionAvg, 1) : '-'}</span>
                          {m.tvPositionIsFullOpen && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" title="Full Open" />
                          )}
                        </div>
                      </td>
                      {/* RSD Power & Time */}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-center align-middle font-sans tabular-nums text-[11px]`}>
                        {(m.rsdPower !== null && m.rsdPower !== undefined)
                          ? fmtInt(m.rsdPower)
                          : (r.processData?.rsdPower !== null && r.processData?.rsdPower !== undefined ? fmtInt(r.processData.rsdPower) : '-')}
                      </td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} font-bold text-slate-900 text-center align-middle font-sans tabular-nums text-[11px]`}>
                        {(m.rsdTime !== null && m.rsdTime !== undefined)
                          ? fmt(m.rsdTime, 1)
                          : (r.processData?.rsdTime !== null && r.processData?.rsdTime !== undefined ? fmt(r.processData.rsdTime, 1) : '-')}
                      </td>
                      {/* Matcher 7 */}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900`}>{m.matcherLoadAvg !== null ? fmt(m.matcherLoadAvg, 1) : '-'}</td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900`}>{m.matcherTuneAvg !== null ? fmt(m.matcherTuneAvg, 1) : '-'}</td>
                      {(() => {
                        const { r: rVal, x: xVal } = getMatcherRX(m);
                        return (
                          <>
                            <td
                              style={getSelectedTdStyle(isSelected)}
                              className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900 ${onNavigateToCtcl ? 'cursor-pointer hover:bg-blue-100/70 group' : ''}`}
                              title={rVal !== null ? `Matcher R (저항): ${fmt(rVal, 2)} Ω (클릭 시 원본 Log Data 탭의 CTCL 패널로 이동)` : 'CTCL Matrix 미연결'}
                              onClick={onNavigateToCtcl ? (e) => { e.stopPropagation(); onSelectRunIdx?.(idx); onNavigateToCtcl(); } : undefined}
                            >
                              <span className={onNavigateToCtcl && rVal !== null ? 'group-hover:text-[#2563EB] group-hover:underline' : ''}>
                                {rVal !== null ? fmt(rVal, 2) : '-'}
                              </span>
                            </td>
                            <td
                              style={getSelectedTdStyle(isSelected)}
                              className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900 ${onNavigateToCtcl ? 'cursor-pointer hover:bg-blue-100/70 group' : ''}`}
                              title={xVal !== null ? `Matcher X (리액턴스): ${fmt(xVal, 2)} Ω (클릭 시 원본 Log Data 탭의 CTCL 패널로 이동)` : 'CTCL Matrix 미연결'}
                              onClick={onNavigateToCtcl ? (e) => { e.stopPropagation(); onSelectRunIdx?.(idx); onNavigateToCtcl(); } : undefined}
                            >
                              <span className={onNavigateToCtcl && xVal !== null ? 'group-hover:text-[#2563EB] group-hover:underline' : ''}>
                                {xVal !== null ? fmt(xVal, 2) : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900`}>{m.matcherNoSignal ? '0' : (m.matcherVppAvg !== null ? fmtInt(m.matcherVppAvg) : '-')}</td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900`}>{m.matcherNoSignal ? '0' : (m.matcherIrmsAvg !== null ? fmtInt(m.matcherIrmsAvg) : '-')}</td>
                      <td style={getSelectedTdStyle(isSelected, false, true)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900`}>{m.matcherNoSignal ? '0' : (m.matcherDCBiasAvg !== null ? fmt(m.matcherDCBiasAvg, 1) : '-')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* --------------------------------------------------------- */}
        {/* ③ 중간단: [H/W Control 시점 분석 종합표] (Start & End) */}
        {/* Industrial Deep Slate & Titanium Metal Theme */}
        {/* --------------------------------------------------------- */}
        <section className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} transition-colors`}>
          <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs" />
              <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor}`}>
                [Monitoring Data] H/W Control 시점 분석
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy('hw-timing-table', hwTimingHeaders, visRows(hwTimingRows))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${theme.btnSecondary} rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer`}
              >
                {copiedTable === 'hw-timing-table' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[#059669]">복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8B95A1]" />
                    <span>데이터 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>



          {/* ============================================================== */}
          {/* 전체 채널 상세 뷰 (24열) - [Monitoring Data] 공정 중 실제 값과 디자인 100% 동일 */}
          {/* ============================================================== */}
          <div className="w-full overflow-x-auto scrollbar-thin max-h-[460px]">
              <table className={`pd-grid w-full text-center border-collapse font-sans whitespace-nowrap text-[11px] border ${theme.tableBorder} table-fixed`} style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={TABLE_COL_NO_STYLE} />
                  <col style={TABLE_COL_RCP_STYLE} />
                  {/* 나머지 24개 열 전부 균등 분할 */}
                  {Array.from({ length: 24 }).map((_, idx) => (
                    <col key={idx} style={{ width: `${100 / 24}%`, minWidth: '44px' }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-30 border-b border-slate-400 text-[11px] font-bold font-sans">
                  {/* Top Level Category Row 0 */}
                  <tr className="border-b border-slate-400">
                    <th colSpan={2} style={{ width: '185px' }} className={TINT_FIXED_TH1}>
                      기본 정보
                    </th>
                    <th colSpan={12} className={TINT_RF_TH1}>
                      <div className="text-[11px] font-bold font-sans tracking-tight text-[#1E3A8A]">H/W Control Start 시점 <span className="text-[10px] text-[#475569] font-normal">(sec)</span></div>
                      <div className="text-[10px] text-[#475569] font-medium font-sans tracking-tight">(0.0sec = Step 시작)</div>
                    </th>
                    <th colSpan={12} className={TINT_HEAT_TH1}>
                      <div className="text-[11px] font-bold font-sans tracking-tight text-[#9F1239]">H/W Control End 시점 <span className="text-[10px] text-[#475569] font-normal">(sec)</span></div>
                      <div className="text-[10px] text-[#475569] font-medium font-sans tracking-tight">
                        (0.0sec = RF Power Off{results.some(r => isBbEndRow(r.hwEndRF)) ? ' · BB 행은 Step 전환 시점' : ''})
                      </div>
                    </th>
                  </tr>

                  {/* Tier 1 Header */}
                  <tr className="border-b border-slate-400">
                    <th rowSpan={3} style={TABLE_COL_NO_STYLE} className={TABLE_TH_NO_CLASS}>No.</th>
                    <th rowSpan={3} style={TABLE_COL_RCP_STYLE} className={TABLE_TH_RCP_CLASS}>RCP Name</th>
                    {/* Start: Depo. Stable (7 cols) */}
                    <th colSpan={7} className={TINT_RF_TH1}>Depo. Stable</th>
                    {/* Start: Depo. Power (1 col) */}
                    <th colSpan={1} className={TINT_RF_TH1}>Depo.</th>
                    {/* Start: PL Stable (3 cols) */}
                    <th colSpan={3} className={TINT_RF_TH1}>PL Stable</th>
                    {/* Start: PL Power (1 col) */}
                    <th colSpan={1} className={TINT_RF_TH1}>PL Step</th>
                    {/* End: Depo. (8 cols) */}
                    <th colSpan={8} className={TINT_HEAT_TH1}>Depo. Step</th>
                    {/* End: PL (4 cols) */}
                    <th colSpan={4} className={TINT_HEAT_TH1}>PL Step</th>
                  </tr>

                  {/* Tier 2 Header - Subtle Parameter Sub-headers */}
                  <tr className="border-b border-slate-400 text-[11px] font-sans font-semibold text-[#1E293B]">
                    {/* Start Depo. Stable */}
                    <th className={TINT_RF_TH2}>{getAlias('ar', 'Ar')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('n2o', 'N2O')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('nh3', 'NH3')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('pn2', 'PN2')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('h2', 'H2')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('sih4', 'SiH4')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('tv_mode', 'T/V')}</th>
                    {/* Start Depo. Power */}
                    <th className={`${TINT_RF_TH2} font-bold text-[#1E3A8A]`}>{getAlias('rf_power', 'Power')}</th>
                    {/* Start PL Stable */}
                    <th className={TINT_RF_TH2}>{getAlias('ar', 'Ar')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('h2', 'H2')}</th>
                    <th className={TINT_RF_TH2}>{getAlias('tv_mode', 'T/V')}</th>
                    {/* Start PL Power */}
                    <th className={`${TINT_RF_TH2} font-bold text-[#1E3A8A]`}>{getAlias('rf_power', 'Power')}</th>
                    {/* End Depo. */}
                    <th className={`${TINT_HEAT_TH2} font-bold text-[#9F1239]`}>{getAlias('rf_power', 'Power')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('tv_mode', 'T/V')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('sih4', 'SiH4')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('ar', 'Ar')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('n2o', 'N2O')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('nh3', 'NH3')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('pn2', 'PN2')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('h2', 'H2')}</th>
                    {/* End PL */}
                    <th className={`${TINT_HEAT_TH2} font-bold text-[#9F1239]`}>{getAlias('rf_power', 'Power')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('tv_mode', 'T/V')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('ar', 'Ar')}</th>
                    <th className={TINT_HEAT_TH2}>{getAlias('h2', 'H2')}</th>
                  </tr>

                  {/* Tier 3 Header with Units */}
                  <tr className="bg-[#E2E8F0] font-sans text-[10px] font-semibold border-b border-slate-400 text-[#334155]">
                    {/* Start Depo. Stable Units */}
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    {/* Start Depo. Power Unit */}
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    {/* Start PL Stable Units */}
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    {/* Start PL Power Unit */}
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    {/* End Depo. Units */}
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    {/* End PL Units */}
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                    <th className={TINT_UNIT_TH}>(sec)</th>
                  </tr>
                </thead>
                <tbody className={`font-sans tabular-nums text-[11px] ${theme.tableCellTextColor}`}>
                  {results.map((r, idx) => {
                    const s = r.hwStart;
                    const e = r.hwEndRF;
                    const bbBadge = hwBoundaryBadge(s, e);
                    const isMulti = r.totalDepoStepsInFile && r.totalDepoStepsInFile > 1;
                    const isSelected = selectedRunIdx === idx;
                    if (hideRow(idx)) return null;

                    const renderCleanTd = (
                      val: number | null | undefined,
                      isLast = false,
                      isAlarm = false,
                      isWarn = false,
                      status?: 'keep' | 'trans',
                      actReach?: number | null
                    ) => {
                      const formatted = fmtSec(val, true);
                      const cellStyle = getSelectedTdStyle(isSelected, false, isLast);

                      // BB / 연속 Depo: '유지'·'전환' 칸은 주의·경보 판정 제외
                      if (status) {
                        return (
                          <td
                            className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] whitespace-nowrap`}
                            style={cellStyle}
                            title={
                              status === 'keep'
                                ? '다른 Step으로 끊기지 않고 이어짐 (판정 제외)'
                                : `Act 도달 ${actReach !== null && actReach !== undefined && isFinite(actReach) ? actReach.toFixed(1) : '-'}초`
                            }
                          >
                            <span
                              className={`inline-flex items-center justify-center px-1 py-[1px] rounded border text-[10px] font-semibold leading-none ${
                                status === 'keep'
                                  ? 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300'
                                  : 'bg-sky-50 border-sky-300 text-sky-800 dark:bg-sky-900/40 dark:border-sky-600 dark:text-sky-200'
                              }`}
                            >
                              {fmtHwStatus(status, val)}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td
                          className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px] font-bold text-slate-900 whitespace-nowrap`}
                          style={cellStyle}
                        >
                          {isAlarm || isWarn ? (
                            renderAlarmSpan(formatted, isAlarm ? 'alarm' : 'warning')
                          ) : (
                            <span className="font-bold font-sans text-slate-900 dark:text-slate-100">{formatted}</span>
                          )}
                        </td>
                      );
                    };

                    return (
                      <tr
                        key={r.resultId || `${r.fileId}_${r.depoStep}_${idx}`}
                        onClick={e => handleRowClick(e, idx, isSelected)}
                        style={rowTint(idx, isSelected)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#DBEAFE]'
                            : isMulti
                              ? theme.subRowBg
                              : (idx % 2 === 0 ? theme.tableRowBg : theme.tableRowAltBg)
                        } ${theme.tableRowHover}`}
                      >
                        <td style={getSelectedTdStyle(isSelected, true, false, TABLE_COL_NO_STYLE)} className={`${TABLE_TD_NO_CLASS} ${NO_CELL_LINK_CLASS}`} data-no-cell onClick={e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && onToggleCompare) { onToggleCompare(resultKey(r)); return; } focusTimeline(idx); }} title="눌러서 이 Recipe의 공정 Sequence 타임라인 보기 · Ctrl + 클릭 = 비교에 추가·빼기">
                          {isMulti ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded ${theme.subRowBadge} font-mono font-bold text-[10px]`}>
                              {s.no}
                            </span>
                          ) : (
                            <span className="font-bold">{s.no}</span>
                          )}
                        </td>
                        <td style={getSelectedTdStyle(isSelected, false, false, TABLE_COL_RCP_STYLE)} className={TABLE_TD_RCP_CLASS} title={s.rcpName}>
                          <div className="flex items-center gap-1 justify-start text-left truncate px-0.5"><CompareBadge slot={slotOf(idx)} />
                            <span className="truncate">{s.rcpName}</span>
                            {isMulti && (
                              <span className={`text-[9px] px-1 py-0.2 rounded ${theme.subRowBadge} font-mono font-medium shrink-0`}>
                                Depo {r.subIndex}
                              </span>
                            )}
                            {bbBadge && (
                              <span
                                title={bbBadge.title}
                                className="text-[9px] px-1 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-900/50 dark:text-sky-200 dark:border-sky-600 font-mono font-bold shrink-0 cursor-help"
                              >
                                {bbBadge.label}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Start Depo. Stable (7 cols) */}
                        {renderCleanTd(s.depoStable_pyroAr, false, false, false, hwStatusOf(s, 'depoStable_pyroAr'))}
                        {renderCleanTd(s.depoStable_pyroN2O, false, false, false, hwStatusOf(s, 'depoStable_pyroN2O'))}
                        {renderCleanTd(s.depoStable_pyroNH3, false, false, false, hwStatusOf(s, 'depoStable_pyroNH3'))}
                        {renderCleanTd(s.depoStable_pyroPN2, false, false, false, hwStatusOf(s, 'depoStable_pyroPN2'))}
                        {renderCleanTd(s.depoStable_pyroH2, false, false, false, hwStatusOf(s, 'depoStable_pyroH2'))}
                        {renderCleanTd(s.depoStable_pyroSiH4, false, false, false, hwStatusOf(s, 'depoStable_pyroSiH4'))}
                        {renderCleanTd(s.depoStable_tvCtrlMode, false, false, false, hwStatusOf(s, 'depoStable_tvCtrlMode'))}
                        {/* Start Depo. Power (1 col) */}
                        {renderCleanTd(s.depo_rfForwardAct, false, false, false, hwStatusOf(s, 'depo_rfForwardAct'))}
                        {/* Start PL Stable (3 cols) */}
                        {renderCleanTd(s.plStable_pyroAr)}
                        {renderCleanTd(s.plStable_pyroH2)}
                        {renderCleanTd(s.plStable_tvCtrlMode)}
                        {/* Start PL Power (1 col) */}
                        {renderCleanTd(s.pl_rfForwardAct)}
                        {/* End Depo. Step (8 cols) */}
                        {renderCleanTd(e.depo_rfForwardAct, false, false, false, hwStatusOf(e, 'depo_rfForwardAct'), e.actReach?.depo_rfForwardAct)}
                        {renderCleanTd(e.depo_tvCtrlMode, false, false, e.depo_tvCtrlMode !== null && e.depo_tvCtrlMode > 3.0, hwStatusOf(e, 'depo_tvCtrlMode'), e.actReach?.depo_tvCtrlMode)}
                        {renderCleanTd(e.depo_pyroSiH4, false, e.depo_pyroSiH4 !== null && e.depo_pyroSiH4 > 0.1, false, hwStatusOf(e, 'depo_pyroSiH4'))}
                        {renderCleanTd(e.depo_pyroAr, false, false, false, hwStatusOf(e, 'depo_pyroAr'))}
                        {renderCleanTd(e.depo_pyroN2O, false, false, false, hwStatusOf(e, 'depo_pyroN2O'))}
                        {renderCleanTd(e.depo_pyroNH3, false, false, false, hwStatusOf(e, 'depo_pyroNH3'))}
                        {renderCleanTd(e.depo_pyroPN2, false, false, false, hwStatusOf(e, 'depo_pyroPN2'))}
                        {renderCleanTd(e.depo_pyroH2, false, false, false, hwStatusOf(e, 'depo_pyroH2'))}
                        {/* End PL Step (4 cols) */}
                        {renderCleanTd(e.pl_rfForwardAct)}
                        {renderCleanTd(e.pl_tvCtrlMode, false, false, e.pl_tvCtrlMode !== null && e.pl_tvCtrlMode > 5.0)}
                        {renderCleanTd(e.pl_pyroAr)}
                        {renderCleanTd(e.pl_pyroH2, true)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </section>

        {/* --------------------------------------------------------- */}
        {/* --------------------------------------------------------- */}
        {/* ④ 4단: [편차 & Uniformity 판정] (100% Full Width) */}
        {/* Toss Tech Slate Theme - 표 1, 2, 3과 양식 100% 통일 */}
        {/* --------------------------------------------------------- */}
        <section className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} transition-colors flex flex-col`}>
          <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#7C3AED] shadow-xs" />
              <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor}`}>
                [Monitoring Data] 공정 Parameter 신뢰성 분석
              </h3>
            </div>

            <div className="flex items-center gap-3">
              {/* 계통별 탭 선택기 (RF & Matcher와 Pres & Lift 탭 분리 적용) */}
              <div className={`flex items-center ${theme.navPillBg} p-0.5 rounded-xl border ${theme.navPillBorder} text-xs`}>
                <button
                  type="button"
                  onClick={() => setActiveDevTab('rfMatcher')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    activeDevTab === 'rfMatcher'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : `${theme.appMutedText} hover:text-[#0F172A]`
                  }`}
                  title="RF Power, RF Ref., Matcher Vpp, Irms, DC Bias"
                >
                  RF & Matcher
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDevTab('presLift')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    activeDevTab === 'presLift'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : `${theme.appMutedText} hover:text-[#0F172A]`
                  }`}
                  title="Chamber Pressure, T/V Pos., Lift Spacing"
                >
                  Pres & Spacing
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDevTab('gas')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    activeDevTab === 'gas'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : `${theme.appMutedText} hover:text-[#0F172A]`
                  }`}
                  title="SiH4, N2O, NH3, PN2, H2 Gas MFC"
                >
                  Gas MFC (5종)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDevTab('heater')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    activeDevTab === 'heater'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : `${theme.appMutedText} hover:text-[#0F172A]`
                  }`}
                  title={monDisplayedHeaterZones.map(z => z.name).join(', ')}
                >
                  {monDisplayedHeaterZones.length > 0
                    ? `Heater (${monDisplayedHeaterZones.length}구역)`
                    : 'Wall Heater (4구역)'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDevTab('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    activeDevTab === 'all'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : `${theme.appMutedText} hover:text-[#0F172A]`
                  }`}
                  title="전체 공정 변수 모두 표시 (가로 스크롤)"
                >
                  전체 보기
                </button>
              </div>

              <button
                onClick={() => handleCopy('dev-table', ecHeaders, visRows(ecRows))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${theme.btnSecondary} rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer`}
              >
                {copiedTable === 'dev-table' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[#059669]">복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8B95A1]" />
                    <span>데이터 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] scrollbar-thin flex-1">
            <table className={`pd-grid w-full text-center border-collapse font-sans whitespace-nowrap text-[11px] border ${theme.tableBorder} table-fixed`} style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={TABLE_COL_NO_STYLE} />
                <col style={TABLE_COL_RCP_STYLE} />
                {/* 나머지 열 전부 균등 분할 */}
                {(() => {
                  const heaterColCount = monDisplayedHeaterZones.length * 4;
                  const remCount =
                    (activeDevTab === 'rfMatcher' ? 13 : 0) +
                    (activeDevTab === 'presLift' ? 11 : 0) +
                    (activeDevTab === 'gas' ? 20 : 0) +
                    (activeDevTab === 'heater' ? heaterColCount : 0) +
                    (activeDevTab === 'all' ? 44 + heaterColCount : 0);
                  return Array.from({ length: remCount }).map((_, i) => (
                    <col key={i} style={{ width: `${100 / remCount}%`, minWidth: '44px' }} />
                  ));
                })()}
              </colgroup>
              <thead className="sticky top-0 z-30 border-b border-slate-400 text-[11px] font-bold font-sans">
                {/* Tier 1 Header: Major Variable Groups - Subtle 3% Tint Matrix */}
                <tr className="border-b border-slate-400">
                  <th rowSpan={3} style={TABLE_COL_NO_STYLE} className={TABLE_TH_NO_CLASS}>No.</th>
                  <th rowSpan={3} style={TABLE_COL_RCP_STYLE} className={TABLE_TH_RCP_CLASS}>RCP Name</th>

                  {/* 1) RF & Matcher - Subtle 3% Ice Blue */}
                  {(activeDevTab === 'rfMatcher' || activeDevTab === 'all') && (
                    <>
                      {/* RF Power */}
                      <th colSpan={4} className={TINT_RF_TH1}>{getAlias('rf_power', 'Power')}</th>
                      {/* Matcher Vpp, Irms, Vdc */}
                      <th colSpan={3} className={TINT_MATCHER_TH1}>{getAlias('matcher_vpp', 'Vpp')}</th>
                      <th colSpan={3} className={TINT_MATCHER_TH1}>{getAlias('matcher_irms', 'Irms')}</th>
                      <th colSpan={3} className={TINT_MATCHER_TH1}>{getAlias('matcher_vdc', 'DC Bias')}</th>
                    </>
                  )}

                  {/* 2) Pres & Spacing (Lift) - Subtle 3% Sage/Teal */}
                  {(activeDevTab === 'presLift' || activeDevTab === 'all') && (
                    <>
                      {/* Pressure & T/V */}
                      <th colSpan={4} className={TINT_PRES_TH1}>{getAlias('tv_press', 'Pres.')}</th>
                      <th colSpan={3} className={TINT_PRES_TH1}>{getAlias('tv_pos', 'T/V Pos.')}</th>
                      {/* Lift Spacing */}
                      <th colSpan={4} className={TINT_LIFT_TH1}>{getAlias('lift_spacing', 'Spacing')}</th>
                    </>
                  )}

                  {/* 3) Gas MFC 계통 - Subtle 3% Amber/Sand */}
                  {(activeDevTab === 'gas' || activeDevTab === 'all') && (
                    <>
                      <th colSpan={4} className={TINT_GAS_TH1}>{getAlias('ar', 'Ar')}</th>
                      <th colSpan={4} className={TINT_GAS_TH1}>{getAlias('sih4', 'SiH4')}</th>
                      <th colSpan={4} className={TINT_GAS_TH1}>{getAlias('n2o', 'N2O')}</th>
                      <th colSpan={4} className={TINT_GAS_TH1}>{getAlias('nh3', 'NH3')}</th>
                      <th colSpan={4} className={TINT_GAS_TH1}>{getAlias('pn2', 'PN2')}</th>
                      <th colSpan={4} className={TINT_GAS_TH1}>{getAlias('h2', 'H2')}</th>
                    </>
                  )}

                  {/* 4) Heater 계통 - Subtle 3% Soft Rose (요약 / 전체 토글 지원) */}
                  {(activeDevTab === 'heater' || activeDevTab === 'all') &&
                    monDisplayedHeaterZones.map((zone, zIdx) => (
                      <th key={zone.name} colSpan={4} className={TINT_HEAT_TH1} title={zone.name}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{zone.name}</span>
                          {zIdx === 0 && allHeaterZones.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setIsMonHeaterExpanded(!isMonHeaterExpanded)}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 cursor-pointer transition-all shadow-2xs"
                              title={isMonHeaterExpanded ? '4개 대표 존으로 요약' : `전체 ${allHeaterZones.length}개 존 펼쳐보기`}
                            >
                              {isMonHeaterExpanded ? '요약 ▴' : `전체 (${allHeaterZones.length}존) ▾`}
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                </tr>

                {/* Tier 2 Header: Column Sub-names */}
                <tr className="border-b border-slate-400 text-[11px] font-sans font-semibold text-[#1E293B]">
                  {(activeDevTab === 'rfMatcher' || activeDevTab === 'all') && (
                    <>
                      {/* Power */}
                      <th className={TINT_RF_TH2}>Min</th>
                      <th className={TINT_RF_TH2}>ΔMin</th>
                      <th className={TINT_RF_TH2}>Max</th>
                      <th className={TINT_RF_TH2}>ΔMax</th>

                      {/* Matcher Vpp */}
                      <th className={TINT_MATCHER_TH2}>Min</th>
                      <th className={TINT_MATCHER_TH2}>Max</th>
                      <th className={TINT_MATCHER_TH2}>Unif.</th>

                      {/* Matcher Irms */}
                      <th className={TINT_MATCHER_TH2}>Min</th>
                      <th className={TINT_MATCHER_TH2}>Max</th>
                      <th className={TINT_MATCHER_TH2}>Unif.</th>

                      {/* Matcher DC Bias: 판정 = Max − Min (V) */}
                      <th className={TINT_MATCHER_TH2}>Min</th>
                      <th className={TINT_MATCHER_TH2}>Max</th>
                      <th className={TINT_MATCHER_TH2}>Max−Min</th>
                    </>
                  )}

                  {(activeDevTab === 'presLift' || activeDevTab === 'all') && (
                    <>
                      {/* Pres */}
                      <th className={TINT_PRES_TH2}>Min</th>
                      <th className={TINT_PRES_TH2}>ΔMin</th>
                      <th className={TINT_PRES_TH2}>Max</th>
                      <th className={TINT_PRES_TH2}>ΔMax</th>

                      {/* T/V: 판정 = Max − Min (%) */}
                      <th className={TINT_PRES_TH2}>Min</th>
                      <th className={TINT_PRES_TH2}>Max</th>
                      <th className={TINT_PRES_TH2}>Max−Min</th>

                      {/* Spacing */}
                      <th className={TINT_LIFT_TH2}>Min</th>
                      <th className={TINT_LIFT_TH2}>ΔMin</th>
                      <th className={TINT_LIFT_TH2}>Max</th>
                      <th className={TINT_LIFT_TH2}>ΔMax</th>
                    </>
                  )}

                  {(activeDevTab === 'gas' || activeDevTab === 'all') && (
                    <>
                      {/* Ar */}
                      <th className={TINT_GAS_TH2}>Min</th>
                      <th className={TINT_GAS_TH2}>ΔMin</th>
                      <th className={TINT_GAS_TH2}>Max</th>
                      <th className={TINT_GAS_TH2}>ΔMax</th>

                      {/* SiH4 */}
                      <th className={TINT_GAS_TH2}>Min</th>
                      <th className={TINT_GAS_TH2}>ΔMin</th>
                      <th className={TINT_GAS_TH2}>Max</th>
                      <th className={TINT_GAS_TH2}>ΔMax</th>

                      {/* N2O */}
                      <th className={TINT_GAS_TH2}>Min</th>
                      <th className={TINT_GAS_TH2}>ΔMin</th>
                      <th className={TINT_GAS_TH2}>Max</th>
                      <th className={TINT_GAS_TH2}>ΔMax</th>

                      {/* NH3 */}
                      <th className={TINT_GAS_TH2}>Min</th>
                      <th className={TINT_GAS_TH2}>ΔMin</th>
                      <th className={TINT_GAS_TH2}>Max</th>
                      <th className={TINT_GAS_TH2}>ΔMax</th>

                      {/* PN2 */}
                      <th className={TINT_GAS_TH2}>Min</th>
                      <th className={TINT_GAS_TH2}>ΔMin</th>
                      <th className={TINT_GAS_TH2}>Max</th>
                      <th className={TINT_GAS_TH2}>ΔMax</th>

                      {/* H2 */}
                      <th className={TINT_GAS_TH2}>Min</th>
                      <th className={TINT_GAS_TH2}>ΔMin</th>
                      <th className={TINT_GAS_TH2}>Max</th>
                      <th className={TINT_GAS_TH2}>ΔMax</th>
                    </>
                  )}

                  {(activeDevTab === 'heater' || activeDevTab === 'all') &&
                    monDisplayedHeaterZones.map(zone => (
                      <React.Fragment key={zone.name}>
                        <th className={TINT_HEAT_TH2}>Min</th>
                        <th className={TINT_HEAT_TH2}>ΔMin</th>
                        <th className={TINT_HEAT_TH2}>Max</th>
                        <th className={TINT_HEAT_TH2}>ΔMax</th>
                      </React.Fragment>
                    ))}
                </tr>

                {/* Tier 3 Header: Dedicated Units Row */}
                <tr className="bg-[#E2E8F0] font-sans text-[10px] font-semibold border-b border-slate-400 text-[#334155]">
                  {(activeDevTab === 'rfMatcher' || activeDevTab === 'all') && (
                    <>
                      {/* Power */}
                      <th className={TINT_UNIT_TH}>(W)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(W)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* Matcher Vpp */}
                      <th className={TINT_UNIT_TH}>(V)</th>
                      <th className={TINT_UNIT_TH}>(V)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* Matcher Irms */}
                      <th className={TINT_UNIT_TH}>(A)</th>
                      <th className={TINT_UNIT_TH}>(A)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* Matcher DC Bias */}
                      <th className={TINT_UNIT_TH}>(V)</th>
                      <th className={TINT_UNIT_TH}>(V)</th>
                      <th className={TINT_UNIT_TH}>(V)</th>
                    </>
                  )}

                  {(activeDevTab === 'presLift' || activeDevTab === 'all') && (
                    <>
                      {/* Pres */}
                      <th className={TINT_UNIT_TH}>(mTorr)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(mTorr)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* T/V */}
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* Spacing */}
                      <th className={TINT_UNIT_TH}>(mils)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(mils)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                    </>
                  )}

                  {(activeDevTab === 'gas' || activeDevTab === 'all') && (
                    <>
                      {/* Ar */}
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* SiH4 */}
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* N2O */}
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* NH3 */}
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* PN2 */}
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>

                      {/* H2 */}
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                      <th className={TINT_UNIT_TH}>(sccm)</th>
                      <th className={TINT_UNIT_TH}>(%)</th>
                    </>
                  )}

                  {(activeDevTab === 'heater' || activeDevTab === 'all') &&
                    monDisplayedHeaterZones.map(zone => (
                      <React.Fragment key={zone.name}>
                        <th className={TINT_UNIT_TH}>(℃)</th>
                        <th className={TINT_UNIT_TH}>(℃)</th>
                        <th className={TINT_UNIT_TH}>(℃)</th>
                        <th className={TINT_UNIT_TH}>(℃)</th>
                      </React.Fragment>
                    ))}
                </tr>
              </thead>

              <tbody className={`font-sans tabular-nums text-[11px] ${theme.tableCellTextColor}`}>
                {results.map((r, idx) => {
                  const d = r.deviation;
                  const isMulti = r.totalDepoStepsInFile && r.totalDepoStepsInFile > 1;
                  const isSelected = selectedRunIdx === idx;
                    if (hideRow(idx)) return null;
                  const TD_DEV_BOLD = 'py-1 px-0.5 border text-center align-middle font-bold text-slate-900 font-sans tabular-nums text-[11px]';
                  const TD_DEV_NORMAL = 'py-1 px-0.5 border text-center align-middle font-sans tabular-nums text-[11px]';
                  return (
                    <tr
                      key={r.resultId || `${r.fileId}_${r.depoStep}_${idx}`}
                      onClick={e => handleRowClick(e, idx, isSelected)}
                        style={rowTint(idx, isSelected)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#DBEAFE]'
                          : isMulti
                            ? theme.subRowBg
                            : (idx % 2 === 0 ? theme.tableRowBg : theme.tableRowAltBg)
                      } ${theme.tableRowHover}`}
                    >
                      <td style={getSelectedTdStyle(isSelected, true, false, TABLE_COL_NO_STYLE)} className={`${TABLE_TD_NO_CLASS} ${NO_CELL_LINK_CLASS}`} data-no-cell onClick={e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && onToggleCompare) { onToggleCompare(resultKey(r)); return; } focusTimeline(idx); }} title="눌러서 이 Recipe의 공정 Sequence 타임라인 보기 · Ctrl + 클릭 = 비교에 추가·빼기">
                        {isMulti ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded ${theme.subRowBadge} font-mono font-bold text-[10px]`}>
                            {d.no}
                          </span>
                        ) : (
                          <span className="font-bold">{d.no}</span>
                        )}
                      </td>
                      <td style={getSelectedTdStyle(isSelected, false, false, TABLE_COL_RCP_STYLE)} className={TABLE_TD_RCP_CLASS} title={d.rcpName}>
                        <div className="flex items-center gap-1 justify-start text-left truncate px-0.5"><CompareBadge slot={slotOf(idx)} />
                          <span className="truncate">{d.rcpName}</span>
                          {isMulti && (
                            <span className={`text-[9px] px-1 py-0.2 rounded ${theme.subRowBadge} font-mono font-medium shrink-0`}>
                              Depo {r.subIndex}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 1) RF & Matcher 계통 Data */}
                      {(activeDevTab === 'rfMatcher' || activeDevTab === 'all') && (
                        <>
                          {/* RF Power: Min, Min 편차, Max, Max 편차 */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.rfForward.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.rfForward, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.rfForward.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.rfForward, 'max')}</td>

                          {/* Matcher Vpp: Min, Max, Unif. */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.matcherVpp.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.matcherVpp.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderAlarmSpan(fmt(d.matcherVpp.uniformityPct, 1), d.matcherVpp.alarmLevel)}</td>

                          {/* Matcher Irms: Min, Max, Unif. */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.matcherIrms.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.matcherIrms.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderAlarmSpan(fmt(d.matcherIrms.uniformityPct, 1), d.matcherIrms.alarmLevel)}</td>

                          {/* Matcher DC Bias: Min, Max, Max−Min (rfMatcher 탭 시 마지막 컬럼) */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.matcherDCBias.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.matcherDCBias.max)}</td>
                          <td style={getSelectedTdStyle(isSelected, false, activeDevTab === 'rfMatcher')} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderAlarmSpan(fmt(d.matcherDCBias.range, 1), d.matcherDCBias.alarmLevel)}</td>
                        </>
                      )}

                      {/* 2) Pres & Lift 계통 Data */}
                      {(activeDevTab === 'presLift' || activeDevTab === 'all') && (
                        <>
                          {/* T/V Press: Min, Min 편차, Max, Max 편차 */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.tvPressure.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.tvPressure, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.tvPressure.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.tvPressure, 'max')}</td>

                          {/* T/V Pos: Min, Max, Max−Min */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmt(d.tvPosition.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmt(d.tvPosition.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderAlarmSpan(fmt(d.tvPosition.range, 1), d.tvPosition.alarmLevel)}</td>

                          {/* Lift Spacing: Min, Min 편차, Max, Max 편차 (presLift 탭 시 마지막 컬럼) */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.liftSpacing.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.liftSpacing, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.liftSpacing.max)}</td>
                          <td style={getSelectedTdStyle(isSelected, false, activeDevTab === 'presLift')} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.liftSpacing, 'max')}</td>
                        </>
                      )}

                      {/* 3) Gas MFC 계통 Data */}
                      {(activeDevTab === 'gas' || activeDevTab === 'all') && (
                        <>
                          {/* Ar: Min, Min 편차, Max, Max 편차 */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroAr.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroAr, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroAr.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroAr, 'max')}</td>

                          {/* SiH4: Min, Min 편차, Max, Max 편차 */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroSiH4.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroSiH4, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroSiH4.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroSiH4, 'max')}</td>

                          {/* N2O: Min, Min 편차, Max, Max 편차 */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroN2O.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroN2O, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroN2O.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroN2O, 'max')}</td>

                          {/* NH3: Min, Min 편차, Max, Max 편차 */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroNH3.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroNH3, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroNH3.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroNH3, 'max')}</td>

                          {/* PN2: Min, Min 편차, Max, Max 편차 */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroPN2.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroPN2, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroPN2.max)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroPN2, 'max')}</td>

                          {/* H2: Min, Min 편차, Max, Max 편차 (gas 탭 시 마지막 컬럼) */}
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroH2.min)}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroH2, 'min')}</td>
                          <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmtInt(d.pyroH2.max)}</td>
                          <td style={getSelectedTdStyle(isSelected, false, activeDevTab === 'gas')} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(d.pyroH2, 'max')}</td>
                        </>
                      )}

                      {/* 4) Heater 계통 Data */}
                      {(activeDevTab === 'heater' || activeDevTab === 'all') &&
                        monDisplayedHeaterZones.map((zone, zIdx) => {
                          const isLastHeater = zIdx === monDisplayedHeaterZones.length - 1;
                          const isTableEnd = isLastHeater && (activeDevTab === 'heater' || activeDevTab === 'all');
                          const stat: DeviationStat =
                            d.dynamicHeaterDevs?.[zone.name] ??
                            (zone.id === 'gate_in_1'
                              ? d.gateIn1
                              : zone.id === 'window_in_3'
                              ? d.windowIn3
                              : zone.id === 'window_out_4'
                              ? d.windowOut4
                              : zone.id === 'side_in_5'
                              ? d.side1In5
                              : { min: null, max: null, isHeaterC: true, minAlarmLevel: 'normal', maxAlarmLevel: 'normal', alarmLevel: 'normal' });

                          return (
                            <React.Fragment key={zone.name}>
                              {/* Min */}
                              <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmt(stat.min)}</td>
                              {/* ΔMin */}
                              <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(stat, 'min')}</td>
                              {/* Max */}
                              <td style={getSelectedTdStyle(isSelected)} className={`${TD_DEV_BOLD} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{fmt(stat.max)}</td>
                              {/* ΔMax */}
                              <td style={getSelectedTdStyle(isSelected, false, isTableEnd)} className={`${TD_DEV_NORMAL} ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder}`}>{renderDevCell(stat, 'max')}</td>
                            </React.Fragment>
                          );
                        })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* --------------------------------------------------------- */}
        {/* ⑤ 맨하단: [RF & Gas Delay 산출] (단독 카드 분리) */}
        {/* --------------------------------------------------------- */}
        <section className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} transition-colors`}>
          <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-[#F97316] shadow-xs" />
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor}`}>
                  [Monitoring Data] RF·Matcher & Gas Delay 산출
                </h3>
                <span className="text-[11px] text-[#475569] font-medium font-sans">
                  (① RF Delay: RF On ➔ Act ≥ 10W | ② Matcher Delay: Act ≥ 10W ➔ Vdc ≤ -10V)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy('delay-table', delayHeaders, visRows(delayRows))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${theme.btnSecondary} rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer`}
              >
                {copiedTable === 'delay-table' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[#059669]">복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8B95A1]" />
                    <span>데이터 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto scrollbar-thin max-h-[460px]">
            <table className={`pd-grid w-full text-center border-collapse font-sans whitespace-nowrap text-[11px] border ${theme.tableBorder} table-fixed`} style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={TABLE_COL_NO_STYLE} />
                <col style={TABLE_COL_RCP_STYLE} />
                {/* 9개 열: RF Delay, Matcher Delay, Gas Delay 7종 */}
                {Array.from({ length: 9 }).map((_, i) => (
                  <col key={i} style={{ width: `${100 / 9}%`, minWidth: '46px' }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-30 border-b border-slate-300 text-[11px] font-bold font-sans">
                {/* Top Level Category Row 0 */}
                <tr className="border-b border-slate-300">
                  <th colSpan={2} style={{ width: '185px' }} className={TINT_FIXED_TH1}>
                    기본 정보
                  </th>
                  <th colSpan={9} className={TINT_FIXED_TH1}>
                    <div className="text-[11px] font-bold font-sans tracking-tight text-[#0F172A]">[Monitoring Data] RF·Matcher & Gas Delay 산출</div>
                  </th>
                </tr>

                {/* Tier 1 Header: Group Badges (Cell Merged) */}
                <tr className="border-b border-slate-300">
                  <th rowSpan={3} style={TABLE_COL_NO_STYLE} className={TABLE_TH_NO_CLASS}>No.</th>
                  <th rowSpan={3} style={TABLE_COL_RCP_STYLE} className={TABLE_TH_RCP_CLASS}>RCP Name</th>
                  {/* RF & Matcher Delay: 2 cols */}
                  <th colSpan={2} className={TINT_RF_TH1}>
                    RF & Matcher Delay
                  </th>
                  {/* Gas Delay: 7 cols */}
                  <th colSpan={7} className={TINT_GAS_TH1}>
                    Gas Delay
                  </th>
                </tr>

                {/* Tier 2 Header: Sub-headers */}
                <tr className="border-b border-slate-300 text-[11px] font-sans font-semibold text-[#1E293B]">
                  <th className={TINT_RF_TH2} title="① RF On ➔ RF FWD Act ≥ 10W 소요시간">RF Delay</th>
                  <th className={TINT_RF_TH2} title="② RF FWD Act ≥ 10W ➔ Matcher Vdc ≤ -10V 소요시간">Matcher Delay</th>
                  <th className={TINT_GAS_TH2}>{getAlias('nf3', 'NF3')}</th>
                  <th className={TINT_GAS_TH2}>{getAlias('ar', 'Ar')}</th>
                  <th className={TINT_GAS_TH2}>{getAlias('n2o', 'N2O')}</th>
                  <th className={TINT_GAS_TH2}>{getAlias('nh3', 'NH3')}</th>
                  <th className={TINT_GAS_TH2}>{getAlias('pn2', 'PN2')}</th>
                  <th className={TINT_GAS_TH2}>{getAlias('sih4', 'SiH4')}</th>
                  <th className={TINT_GAS_TH2}>{getAlias('h2', 'H2')}</th>
                </tr>

                {/* Tier 3 Header with Units */}
                <tr className="bg-[#F8FAFC] font-sans text-[10px] font-medium border-b border-slate-300 text-[#475569]">
                  {/* RF & Matcher Delay Units */}
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  {/* Gas Delay Units */}
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                  <th className={TINT_UNIT_TH}>(sec)</th>
                </tr>
              </thead>
              <tbody className={`font-sans tabular-nums text-[11px] ${theme.tableCellTextColor}`}>
                {results.map((r, idx) => {
                  const d = r.delays;
                  const isMulti = r.totalDepoStepsInFile && r.totalDepoStepsInFile > 1;
                  const isSelected = selectedRunIdx === idx;
                    if (hideRow(idx)) return null;
                  return (
                    <tr
                      key={r.resultId || `${r.fileId}_${r.depoStep}_${idx}`}
                      onClick={e => handleRowClick(e, idx, isSelected)}
                        style={rowTint(idx, isSelected)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#DBEAFE]'
                          : isMulti
                            ? theme.subRowBg
                            : (idx % 2 === 0 ? theme.tableRowBg : theme.tableRowAltBg)
                      } ${theme.tableRowHover}`}
                    >
                      <td style={getSelectedTdStyle(isSelected, true, false, TABLE_COL_NO_STYLE)} className={`${TABLE_TD_NO_CLASS} ${NO_CELL_LINK_CLASS}`} data-no-cell onClick={e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && onToggleCompare) { onToggleCompare(resultKey(r)); return; } focusTimeline(idx); }} title="눌러서 이 Recipe의 공정 Sequence 타임라인 보기 · Ctrl + 클릭 = 비교에 추가·빼기">
                        {isMulti ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded ${theme.subRowBadge} font-mono font-bold text-[10px]`}>
                            {d.no}
                          </span>
                        ) : (
                          <span className="font-bold">{d.no}</span>
                        )}
                      </td>
                      <td style={getSelectedTdStyle(isSelected, false, false, TABLE_COL_RCP_STYLE)} className={TABLE_TD_RCP_CLASS} title={d.rcpName}>
                        <div className="flex items-center gap-1 justify-start text-left truncate px-0.5"><CompareBadge slot={slotOf(idx)} />
                          <span className="truncate">{d.rcpName}</span>
                          {isMulti && (
                            <span className={`text-[9px] px-1 py-0.2 rounded ${theme.subRowBadge} font-mono font-medium shrink-0`}>
                              Depo {r.subIndex}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* ① RF Delay */}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.rfDelay)}</td>
                      {/* ② Matcher Delay */}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.matcherDelay)}</td>
                      {/* Gas Delay 7종 */}
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.gasDelay_oxyNF3)}</td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.gasDelay_pyroAr)}</td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.gasDelay_pyroN2O)}</td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.gasDelay_pyroNH3)}</td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.gasDelay_pyroPN2)}</td>
                      <td style={getSelectedTdStyle(isSelected)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.gasDelay_pyroSiH4)}</td>
                      <td style={getSelectedTdStyle(isSelected, false, true)} className={`py-1 px-0.5 border ${isSelected ? 'border-[#2563EB]' : theme.tableCellBorder} text-center align-middle font-sans tabular-nums text-[11px]`}>{renderDelayCell(d.gasDelay_pyroH2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* --------------------------------------------------------- */}
        {/* ⑥ [SPC] Run별 추세 관리도 */}
        {/* --------------------------------------------------------- */}
        <SpcPanel results={results} files={files} selectedRunIdx={selectedRunIdx} onSelectRunIdx={onSelectRunIdx} />
      </main>
    </div>
  );
};
