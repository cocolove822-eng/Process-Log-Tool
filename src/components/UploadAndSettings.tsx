import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Trash2,
  Settings2,
  FileCheck2,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Minus,
  Layers,
  Sliders,
} from 'lucide-react';
import {
  AnalyzerSettings,
  CriterionState,
  CTCLMatrixData,
  DepoStepCriteriaMap,
  ParsedLogFile,
} from '../types/pecvd';
import { normalizeCriteria } from '../utils/analyzer';

interface UploadAndSettingsProps {
  files: ParsedLogFile[];
  ctclMatrix: CTCLMatrixData | null;
  settings: AnalyzerSettings;
  isSettingsOpen: boolean;
  onClose?: () => void;
  onUpdateSettings: (newSettings: AnalyzerSettings) => void;
  onUploadRawFiles: (files: FileList | File[]) => void;
  onUploadCtclFile: (file: File) => void;
  onRemoveFile: (fileId: string) => void;
  onClearAllFiles: () => void;
  onChangeManualDepoStep: (fileId: string, step: number | null) => void;
  onSelectCtclSheet?: (sheetName: string) => void;
}

export const UploadAndSettings: React.FC<UploadAndSettingsProps> = ({
  files,
  ctclMatrix,
  settings,
  isSettingsOpen,
  onClose,
  onUpdateSettings,
  onUploadRawFiles,
  onUploadCtclFile,
  onRemoveFile,
  onClearAllFiles,
  onChangeManualDepoStep,
  onSelectCtclSheet,
}) => {
  const rawInputRef = useRef<HTMLInputElement>(null);
  const ctclInputRef = useRef<HTMLInputElement>(null);
  const [isFileListOpen, setIsFileListOpen] = useState<boolean>(false);

  if (!isSettingsOpen) {
    return null;
  }

  return (
    <div className="bg-[#F8FAFC] border-b border-[#CBD5E1] text-[#0F172A] relative z-30 animate-in fade-in duration-150">
      <div className="max-w-[1920px] mx-auto px-4 lg:px-7 py-3">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-extrabold text-[#0F172A]">공정 분석 기준 파라미터 & 판정 기준 설정</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#64748B] hidden sm:inline">변경 시 분석 데이터 및 판정 기준이 즉시 재계산됩니다.</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-200/70 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="설정 창 닫기"
              >
                <X className="w-3.5 h-3.5" />
                <span>닫기</span>
              </button>
            )}
          </div>
        </div>

              {/* General Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* Analysis Interval Mode (New) */}
                <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#CBD5E1]">
                  <label className="text-[11px] font-bold text-[#2563EB] flex items-center justify-between">
                    <span>분석 구간 기준</span>
                    <span className="text-[10px] text-[#64748B]">시작 시점</span>
                  </label>
                  <select
                    value={settings.analysisIntervalMode}
                    onChange={e => onUpdateSettings({ ...settings, analysisIntervalMode: e.target.value as 'rf_on' | 'set_reached' })}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] font-semibold rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="rf_on">RF On 기준 (t_on + Stable)</option>
                    <option value="set_reached">Set 도달 기준 (t_reach + Stable)</option>
                  </select>
                  <label className="flex items-center gap-1.5 cursor-pointer pt-1 border-t border-[#E2E8F0] mt-1">
                    <input
                      type="checkbox"
                      checked={settings.autoFilterRamp !== false}
                      onChange={e => onUpdateSettings({ ...settings, autoFilterRamp: e.target.checked })}
                      className="rounded border-[#CBD5E1] bg-white text-[#2563EB] focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-semibold text-[#0F172A]">Ramp 구간 자동 제외 (스마트 모드)</span>
                  </label>
                </div>

                {/* RF Tolerance & Stable */}
                <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#CBD5E1]">
                  <label className="text-[11px] font-semibold text-[#64748B] flex items-center justify-between">
                    <span>RF 오차율 / Stable Time</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.rfTolerancePct}
                        onChange={e => onUpdateSettings({ ...settings, rfTolerancePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                        title="도달 판정 허용 오차 (기본: 2%)"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-[#64748B]">%</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.rfStableTimeSec}
                        onChange={e => onUpdateSettings({ ...settings, rfStableTimeSec: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-[#CBD5E1] text-[#2563EB] font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                        title="RF Stable Time (시작 버퍼 시간, 기본: 3.0s)"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-[#2563EB]">s</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#64748B]">시작: RF On + Stable({settings.rfStableTimeSec}s)</div>
                </div>

                {/* Ramp Down & RSD Pre-Offset Time */}
                <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#CBD5E1]">
                  <label className="text-[11px] font-semibold text-[#64748B] flex items-center justify-between">
                    <span>Ramp Down / RSD 진입 전 Time</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.rfRampDownTimeSec}
                        onChange={e => onUpdateSettings({ ...settings, rfRampDownTimeSec: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                        title="일반 레시피 Ramp Down 종료 버퍼 (기본: 1.0s)"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-[#64748B]">s</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.rsdPreOffsetSec ?? 1.0}
                        onChange={e => onUpdateSettings({ ...settings, rsdPreOffsetSec: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-[#CBD5E1] text-[#2563EB] font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                        title="RSD 레시피 진입 전 버퍼 시간 (기본: 1.0s)"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-[#2563EB]">s</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#64748B]">종료: 일반(Off-Ramp) / RSD(진입-{settings.rsdPreOffsetSec ?? 1.0}s)</div>
                </div>

                {/* Depo / PL Gas */}
                <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#CBD5E1]">
                  <label className="text-[11px] font-semibold text-[#64748B]">Depo / PL 판별 가스</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={settings.depoGasCol}
                      onChange={e => onUpdateSettings({ ...settings, depoGasCol: e.target.value })}
                      className="bg-white border border-[#CBD5E1] text-[#0F172A] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                      title="Depo Gas (기본: Pyro.SiH4)"
                    />
                    <input
                      type="text"
                      value={settings.plGasCol}
                      onChange={e => onUpdateSettings({ ...settings, plGasCol: e.target.value })}
                      className="bg-white border border-[#CBD5E1] text-[#0F172A] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                      title="PL Gas (기본: Pyro.H2)"
                    />
                  </div>
                  <div className="text-[10px] text-[#64748B]">Step 감지용 컬럼</div>
                </div>

                {/* Depo Step 판정 조건 & 데이터 산출 시점 */}
                <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#CBD5E1]">
                  <label className="text-[11px] font-semibold text-[#64748B]">Depo Step 판정 조건 & 데이터 산출 시점</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(
                      [
                        { id: 'sih4', label: 'SiH4 Gas' },
                        { id: 'rf', label: 'RF Power' },
                        { id: 'ar', label: 'Ar Gas' },
                      ] as const
                    ).map(item => {
                      const criteria = normalizeCriteria(settings.depoStepCriteria);
                      const state = criteria[item.id];
                      const isInclude = state === 'include';
                      const isExclude = state === 'exclude';
                      const isIgnore = state === 'ignore';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            let next: CriterionState = 'include';
                            if (state === 'include') next = 'exclude';
                            else if (state === 'exclude') next = 'ignore';
                            else next = 'include';

                            const candidate: DepoStepCriteriaMap = { ...criteria, [item.id]: next };
                            if (candidate.sih4 === 'ignore' && candidate.rf === 'ignore' && candidate.ar === 'ignore') {
                              next = 'include';
                            }
                            onUpdateSettings({ ...settings, depoStepCriteria: { ...criteria, [item.id]: next } });
                          }}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-lg border transition-all cursor-pointer select-none active:scale-95 ${
                            isInclude
                              ? 'bg-[#3182F6]/10 text-[#3182F6] border-[#3182F6]/40 shadow-2xs font-semibold'
                              : isExclude
                              ? 'bg-[#FEE2E2]/70 text-[#DC2626] border-[#EF4444]/40 shadow-2xs font-semibold'
                              : 'bg-white text-[#8B95A1] border-slate-200 hover:border-slate-300 font-medium'
                          }`}
                          title={`${item.label}: ${
                            isInclude ? '필수 공급 (클릭 시 [제외 ✕]로 변경)' : isExclude ? '공급 금지 0 (클릭 시 [무관 -]으로 변경)' : '조건 무관 (클릭 시 [포함 ✓]으로 변경)'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center text-[9px] transition-colors ${
                              isInclude
                                ? 'bg-[#3182F6] border border-[#3182F6] text-white'
                                : isExclude
                                ? 'bg-[#DC2626] border border-[#DC2626] text-white'
                                : 'border border-slate-300 bg-white text-slate-400'
                            }`}
                          >
                            {isInclude && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            {isExclude && <X className="w-2.5 h-2.5 stroke-[3]" />}
                            {isIgnore && <Minus className="w-2 h-2 stroke-[2]" />}
                          </span>
                          <span>{item.label}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              isInclude
                                ? 'bg-[#3182F6]/15 text-[#3182F6]'
                                : isExclude
                                ? 'bg-[#EF4444]/15 text-[#DC2626]'
                                : 'bg-slate-100 text-[#8B95A1]'
                            }`}
                          >
                            {isInclude ? '포함' : isExclude ? '제외' : '무관'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E2E8F0]">
                    <span className="text-[11px] text-[#64748B]">데이터 산출 시점 (RF Off)</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-[#64748B]">RF Off</span>
                      <input
                        type="number"
                        step="1"
                        value={settings.readOffsetSec}
                        onChange={e => onUpdateSettings({ ...settings, readOffsetSec: parseFloat(e.target.value) || 0 })}
                        className="w-12 bg-white border border-[#CBD5E1] text-[#0F172A] rounded-lg px-1.5 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-[#2563EB]"
                      />
                      <span className="text-[11px] text-[#64748B]">초</span>
                    </div>
                  </div>
                </div>

                {/* Chamber & Threshold */}
                <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#CBD5E1]">
                  <label className="text-[11px] font-semibold text-[#64748B]">Chamber / On 임계값</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={settings.processChamber}
                      onChange={e => onUpdateSettings({ ...settings, processChamber: e.target.value })}
                      className="bg-white border border-[#CBD5E1] text-[#0F172A] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="A">Chamber A</option>
                      <option value="B">Chamber B</option>
                    </select>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.rfOnThresholdDepo}
                        onChange={e => onUpdateSettings({ ...settings, rfOnThresholdDepo: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#2563EB]"
                        title="RF On 판정 임계값 (기본: 300W)"
                      />
                      <span className="absolute right-1 top-1 text-[10px] text-[#64748B]">W</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#64748B]">Depo RF On 판정</div>
                </div>
              </div>

              {/* EC Criteria Table - 7대 파라미터 그룹 표준 색상 완벽 연동 */}
              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#CBD5E1] space-y-2">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#0F172A] text-xs">항목별 EC 판정 기준 (7대 파라미터 그룹 표준 색상 적용)</span>
                    <span className="text-[10px] text-[#64748B]">양방향: |값| ≥ 기준 / 상한: 값 ≥ 기준</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] font-semibold">
                      ⚠️ Warning (주의)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] font-bold">
                      🚨 Alarm (경보)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[11px]">
                  {/* 1. RF Forward: Sky Blue (Rule 1) */}
                  <div className="p-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] border-t-2 border-t-[#2563EB]">
                    <div className="font-bold text-[#1D4ED8]">RF Forward (Act)</div>
                    <div className="text-[10px] text-[#64748B]">Set 편차% · 양방향</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecRfForwardWarningPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecRfForwardWarningPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="2%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Warning %"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecRfForwardAlarmPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecRfForwardAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="3%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Alarm %"
                      />
                    </div>
                  </div>

                  {/* 2. RF Reflect: Purple / Violet (Rule 2) */}
                  <div className="p-2 rounded-lg bg-[#FAF5FF] border border-[#E9D5FF] border-t-2 border-t-[#7C3AED]">
                    <div className="font-bold text-[#6D28D9]">RF Reflect Power</div>
                    <div className="text-[10px] text-[#64748B]">구간 Max (W) · 상한</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        value={settings.ecRfReflectWarningW ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecRfReflectWarningW: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="100W"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Warning W"
                      />
                      <input
                        type="number"
                        value={settings.ecRfReflectAlarmW ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecRfReflectAlarmW: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="200W"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Alarm W"
                      />
                    </div>
                  </div>

                  {/* 3. Matcher Uniformity: Emerald / Mint (Rule 3) */}
                  <div className="p-2 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] border-t-2 border-t-[#16A34A]">
                    <div className="font-bold text-[#15803D]">Matcher (Vpp/Irms/DC)</div>
                    <div className="text-[10px] text-[#64748B]">Uniformity % · 상한</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecMatcherWarningPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecMatcherWarningPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="2%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Warning %"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecMatcherAlarmPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecMatcherAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="3%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Alarm %"
                      />
                    </div>
                  </div>

                  {/* 4. T/V Pressure: Lemon Yellow (Rule 4) */}
                  <div className="p-2 rounded-lg bg-[#FEFCE8] border border-[#FEF08A] border-t-2 border-t-[#CA8A04]">
                    <div className="font-bold text-[#854D0E]">T/V Pressure</div>
                    <div className="text-[10px] text-[#64748B]">Set 편차% · 양방향</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecPressureWarningPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecPressureWarningPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="2%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Warning %"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecPressureAlarmPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecPressureAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="5%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Alarm %"
                      />
                    </div>
                  </div>

                  {/* 4-B. T/V Position: Lemon Yellow (Rule 4) */}
                  <div className="p-2 rounded-lg bg-[#FEFCE8] border border-[#FEF08A] border-t-2 border-t-[#CA8A04]">
                    <div className="font-bold text-[#854D0E]">T/V Position</div>
                    <div className="text-[10px] text-[#64748B]">Uniformity % · 상한</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        step="0.1"
                        value={settings.ecPositionWarningPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecPositionWarningPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="0.5%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Warning %"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={settings.ecPositionAlarmPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecPositionAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="1.0%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Alarm %"
                      />
                    </div>
                  </div>

                  {/* 7. Lift Spacing: Indigo / Lavender (Rule 7) */}
                  <div className="p-2 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] border-t-2 border-t-[#4F46E5]">
                    <div className="font-bold text-[#4338CA]">Lift Spacing</div>
                    <div className="text-[10px] text-[#64748B]">Set 편차% · 미설정</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecLiftSpacingWarningPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecLiftSpacingWarningPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="미설정"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A] placeholder:text-[#94A3B8]"
                        title="Warning (비워두면 미설정)"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecLiftSpacingAlarmPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecLiftSpacingAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="미설정"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A] placeholder:text-[#94A3B8]"
                        title="Alarm (비워두면 미설정)"
                      />
                    </div>
                  </div>

                  {/* 5. Gas Flow: Warm Orange (Rule 5) */}
                  <div className="p-2 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] border-t-2 border-t-[#EA580C]">
                    <div className="font-bold text-[#C2410C]">Gas 유량 (전 종류)</div>
                    <div className="text-[10px] text-[#64748B]">Set 편차% · 양방향</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecGasWarningPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecGasWarningPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="3%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Warning %"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={settings.ecGasAlarmPct ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecGasAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="5%"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Alarm %"
                      />
                    </div>
                  </div>

                  {/* 6. Heater Zone: Rose / Crimson (Rule 6) */}
                  <div className="p-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] border-t-2 border-t-[#DC2626]">
                    <div className="font-bold text-[#B91C1C]">Heater Zone (℃)</div>
                    <div className="text-[10px] text-[#64748B]">온도차(℃) · 양방향</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        step="1"
                        value={settings.ecHeaterWarningC ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecHeaterWarningC: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="5℃"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Warning ℃"
                      />
                      <input
                        type="number"
                        step="1"
                        value={settings.ecHeaterAlarmC ?? ''}
                        onChange={e => onUpdateSettings({ ...settings, ecHeaterAlarmC: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="10℃"
                        className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-center text-[#0F172A]"
                        title="Alarm ℃"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
};
