import React from 'react';
import {
  Sliders,
  HelpCircle,
  RotateCcw,
  Zap,
  Activity,
  Gauge,
  Wind,
  Thermometer,
  Clock,
} from 'lucide-react';
import { AnalyzerSettings } from '../types/pecvd';
import { DEFAULT_SETTINGS } from '../utils/analyzer';

interface SidebarSettingsPanelProps {
  settings: AnalyzerSettings;
  onUpdateSettings: (newSettings: AnalyzerSettings) => void;
  onOpenGuide?: () => void;
}

export const SidebarSettingsPanel: React.FC<SidebarSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onOpenGuide,
}) => {
  const handleResetToDefault = () => {
    if (window.confirm('모든 분석 파라미터 및 EC 판정 기준을 기본값으로 초기화하시겠습니까?')) {
      onUpdateSettings(DEFAULT_SETTINGS);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2.5 scrollbar-thin text-xs text-[#0F172A] bg-[#F1F5F9]">
      {/* Header with Quick Guide Link & Reset */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="font-extrabold text-[#0F172A] text-xs">분석 기준 & 판정 설정</span>
        </div>
        <div className="flex items-center gap-1">
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[#2563EB] hover:bg-blue-100 bg-blue-50 rounded-lg border border-blue-200 font-bold cursor-pointer transition-colors shadow-2xs"
              title="설정값 상세 가이드 보기"
            >
              <HelpCircle className="w-3 h-3" />
              <span>설명서</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[#475569] hover:text-[#0F172A] bg-white hover:bg-slate-100 rounded-lg border border-slate-300 font-semibold cursor-pointer transition-colors shadow-2xs"
            title="기본값으로 복원"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>기본값</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Group 1: 일반 공정 분석 기준 파라미터 (시작시점 / 종료시점 가로 배치 압축) */}
      {/* ========================================================================= */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0F172A]">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
            <span>1. 공정 분석 기본 파라미터</span>
          </div>
          <span className="text-[9px] text-[#64748B] font-semibold">분석 구간 제어</span>
        </div>

        {/* 시작시점과 종료시점을 가로 2단 그리드로 배치하여 세로 크기 극대화 압축 */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* 1-1. 분석 구간 설정 (시작시점) - Ramping Up 실제 도달 기준 + n초 */}
          <div className="bg-white p-2 rounded-xl border border-slate-300 shadow-2xs flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#0F172A] truncate">구간 시작시점</span>
              <span className="text-[8.5px] font-bold text-[#2563EB] bg-blue-50 px-1 py-0.5 rounded border border-blue-200 shrink-0">
                실제 도달
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9.5px] font-medium text-[#475569] leading-tight">도달 후 버퍼:</span>
                <div className="relative w-16 shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={settings.rampUpPostOffsetSec ?? settings.rfStableTimeSec ?? 3.0}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateSettings({
                        ...settings,
                        rampUpPostOffsetSec: val,
                        rfStableTimeSec: val,
                        analysisIntervalMode: 'set_reached',
                      });
                    }}
                    className="w-full bg-white border border-slate-300 text-[#2563EB] font-bold rounded-lg pl-1.5 pr-4 py-0.5 text-[11px] text-center focus:outline-none focus:border-[#2563EB] shadow-2xs"
                    title="Ramping Up 실제 목표 도달 후 데이터 수집을 시작할 버퍼 시간(초)"
                  />
                  <span className="absolute right-1 top-0.5 text-[9px] text-[#2563EB] font-bold">초</span>
                </div>
              </div>

              <div className="text-[9px] text-[#64748B] leading-tight bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <div className="font-semibold text-[#1E40AF] truncate">• 목표(98%) 도달 기준</div>
                <div>+ {settings.rampUpPostOffsetSec ?? settings.rfStableTimeSec ?? 3.0}초 후 수집 시작</div>
              </div>
            </div>
          </div>

          {/* 1-2. 분석 구간 설정 (종료시점) - 종료 전 제외 버퍼 */}
          <div className="bg-white p-2 rounded-xl border border-slate-300 shadow-2xs flex flex-col justify-between space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#0F172A] truncate">구간 종료시점</span>
              <span className="text-[8.5px] font-semibold text-[#64748B] bg-slate-100 px-1 py-0.5 rounded border border-slate-200 shrink-0">
                종료 전 버퍼
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9.5px] font-medium text-[#475569] leading-tight">종료 전 버퍼:</span>
                <div className="relative w-16 shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={settings.rfRampDownTimeSec ?? 1.0}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateSettings({
                        ...settings,
                        rfRampDownTimeSec: val,
                        rsdPreOffsetSec: val,
                      });
                    }}
                    className="w-full bg-white border border-slate-300 text-[#2563EB] font-bold rounded-lg pl-1.5 pr-4 py-0.5 text-[11px] text-center focus:outline-none focus:border-[#2563EB] shadow-2xs"
                    title="공정 종료 전(RF Off 직전 또는 RSD 진입 직전) 제외할 버퍼 시간 (초)"
                  />
                  <span className="absolute right-1 top-0.5 text-[9px] text-[#2563EB] font-bold">초</span>
                </div>
              </div>

              <div className="text-[9px] text-[#64748B] leading-tight bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <div>• 일반: RF Off - {settings.rfRampDownTimeSec ?? 1.0}초</div>
                <div>• RSD: 진입 - {settings.rsdPreOffsetSec ?? 1.0}초</div>
              </div>

              <div className="flex items-center justify-between gap-1">
                <span className="text-[9.5px] font-medium text-[#475569] leading-tight" title="Fwd Act가 RSD Power ± 이 값 안에 있는 동안을 RSD 유지 시간으로 계산합니다">
                  RSD 판정 범위:
                </span>
                <div className="relative w-16 shrink-0">
                  <input
                    id="rsd-band-w"
                    type="number"
                    step="50"
                    min="0"
                    value={settings.rsdBandW ?? 300}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      onUpdateSettings({ ...settings, rsdBandW: Number.isFinite(val) && val >= 0 ? val : 300 });
                    }}
                    className="w-full bg-white border border-slate-300 text-[#2563EB] font-bold rounded-lg pl-3 pr-4 py-0.5 text-[11px] text-center focus:outline-none focus:border-[#2563EB] shadow-2xs"
                    title="RSD Power ± W (기본 300W)"
                  />
                  <span className="absolute left-1 top-0.5 text-[9px] text-[#2563EB] font-bold">±</span>
                  <span className="absolute right-1 top-0.5 text-[9px] text-[#2563EB] font-bold">W</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Group 2: 2. 항목별 Warning Alarm 판정 기준 */}
      {/* ========================================================================= */}
      <div className="space-y-1.5 pt-1 border-t border-slate-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#0F172A]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>2. 항목별 Warning Alarm 판정 기준</span>
          </div>
          <span className="text-[9px] text-[#64748B] font-semibold">주의 · 경보</span>
        </div>

        {/* Compact Legend Box */}
        <div className="px-2 py-0.5 rounded-md bg-slate-200/60 border border-slate-300 flex items-center justify-between text-[8.5px] text-[#475569]">
          <span className="font-semibold">입력 규격:</span>
          <div className="flex items-center gap-2 font-bold">
            <span className="text-amber-800">⚠️ 좌: 주의 (Warn)</span>
            <span className="text-slate-400">|</span>
            <span className="text-rose-800">🚨 우: 경보 (Alarm)</span>
          </div>
        </div>

        {/* Compact EC Parameter Cards: 한 열에 2행씩 배치하여 세로 크기 극대화 압축 */}
        <div className="space-y-1.5">
          {/* Card 1: RF Forward Power */}
          <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
            {/* Row 1: 항목명 + 판정 기준 */}
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-bold text-[#1E40AF] flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#2563EB]" />
                <span>RF Forward Power</span>
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">Set 편차 ±%</span>
            </div>
            {/* Row 2: 좌(주의) / 우(경보) 2행 입력 필드 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
                <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecRfForwardWarningPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecRfForwardWarningPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="2.0"
                  className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">%</span>
              </div>
              <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
                <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecRfForwardAlarmPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecRfForwardAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="3.0"
                  className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">%</span>
              </div>
            </div>
          </div>

          {/* Card 2: RF Reflect Power */}
          <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
            {/* Row 1 */}
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-bold text-purple-700 flex items-center gap-1">
                <Activity className="w-3 h-3 text-purple-600" />
                <span>RF Reflect Power</span>
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">구간 Max W</span>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
                <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
                <input
                  type="number"
                  step="10"
                  value={settings.ecRfReflectWarningW ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecRfReflectWarningW: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="100"
                  className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">W</span>
              </div>
              <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
                <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
                <input
                  type="number"
                  step="10"
                  value={settings.ecRfReflectAlarmW ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecRfReflectAlarmW: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="200"
                  className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">W</span>
              </div>
            </div>
          </div>

          {/* Card 3: Matcher (Vpp/Irms/DC Bias) */}
          <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
            {/* Row 1 */}
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-emerald-600" />
                <span>Matcher (Vpp/Irms/DC)</span>
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">Uniformity Max%</span>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
                <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecMatcherWarningPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecMatcherWarningPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="2.0"
                  className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">%</span>
              </div>
              <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
                <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecMatcherAlarmPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecMatcherAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="3.0"
                  className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">%</span>
              </div>
            </div>
          </div>

          {/* Card 4: T/V Pressure (압력) */}
          <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
            {/* Row 1 */}
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-bold text-amber-700 flex items-center gap-1">
                <Wind className="w-3 h-3 text-amber-600" />
                <span>T/V Pressure (압력)</span>
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">Set 편차 ±%</span>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
                <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecPressureWarningPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecPressureWarningPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="2.0"
                  className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">%</span>
              </div>
              <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
                <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecPressureAlarmPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecPressureAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="5.0"
                  className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">%</span>
              </div>
            </div>
          </div>

          {/* Card 5: T/V Position (개도율) */}
          <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
            {/* Row 1 */}
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-bold text-amber-700 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-amber-600" />
                <span>T/V Position (개도율)</span>
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">Uniformity Max%</span>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
                <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
                <input
                  type="number"
                  step="0.1"
                  value={settings.ecPositionWarningPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecPositionWarningPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="0.5"
                  className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">%</span>
              </div>
              <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
                <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
                <input
                  type="number"
                  step="0.1"
                  value={settings.ecPositionAlarmPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecPositionAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="1.0"
                  className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">%</span>
              </div>
            </div>
          </div>

          {/* Card 6: Gas Flow (전 종류) */}
          <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
            {/* Row 1 */}
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-bold text-orange-700 flex items-center gap-1">
                <Wind className="w-3 h-3 text-orange-600" />
                <span>Gas 유량 (전 종류)</span>
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">Set 편차 ±%</span>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
                <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecGasWarningPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecGasWarningPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="3.0"
                  className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">%</span>
              </div>
              <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
                <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.ecGasAlarmPct ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecGasAlarmPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="5.0"
                  className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">%</span>
              </div>
            </div>
          </div>

          {/* Card 7: Heater Zone (온도) */}
          <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
            {/* Row 1 */}
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-bold text-red-700 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-red-600" />
                <span>Heater Zone (온도)</span>
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">온도차 ±℃</span>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
                <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
                <input
                  type="number"
                  step="1"
                  value={settings.ecHeaterWarningC ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecHeaterWarningC: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="5"
                  className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">℃</span>
              </div>
              <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
                <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
                <input
                  type="number"
                  step="1"
                  value={settings.ecHeaterAlarmC ?? ''}
                  onChange={e =>
                    onUpdateSettings({
                      ...settings,
                      ecHeaterAlarmC: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  placeholder="10"
                  className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
                />
                <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">℃</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Group 3: 3. RF, Matcher & Gas Delay 기준 설정 (sec) */}
      {/* ========================================================================= */}
      <div className="space-y-1.5 pt-1 border-t border-slate-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#0F172A]">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>3. RF, Matcher & Gas Delay 기준 설정</span>
          </div>
          <span className="text-[9px] text-[#64748B] font-semibold">지연시간 (sec)</span>
        </div>

        {/* Card: Delay Warning & Alarm Inputs */}
        <div className="p-1.5 rounded-lg bg-white border border-slate-300 shadow-2xs hover:border-slate-400 transition-colors">
          {/* Row 1 */}
          <div className="flex items-center justify-between text-[10.5px] mb-1">
            <span className="font-bold text-orange-700 flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-600" />
              <span>Delay 초과 기준 (sec)</span>
            </span>
            <span className="text-[8.5px] text-[#64748B] font-mono bg-slate-100 px-1 py-0.5 rounded">상한 초과</span>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center bg-amber-50/70 border border-amber-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-amber-500 transition-colors">
              <span className="text-[9px] font-bold text-amber-800 shrink-0 mr-1">⚠️ 주의</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings.ecDelayWarningSec ?? ''}
                onChange={e =>
                  onUpdateSettings({
                    ...settings,
                    ecDelayWarningSec: e.target.value === '' ? null : parseFloat(e.target.value),
                  })
                }
                placeholder="0.3"
                className="w-full bg-transparent text-right font-bold text-amber-900 text-[11px] focus:outline-none"
              />
              <span className="text-[9px] font-bold text-amber-700 ml-0.5 shrink-0">초</span>
            </div>
            <div className="flex items-center bg-rose-50/70 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs focus-within:bg-white focus-within:border-rose-500 transition-colors">
              <span className="text-[9px] font-bold text-rose-800 shrink-0 mr-1">🚨 경보</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings.ecDelayAlarmSec ?? ''}
                onChange={e =>
                  onUpdateSettings({
                    ...settings,
                    ecDelayAlarmSec: e.target.value === '' ? null : parseFloat(e.target.value),
                  })
                }
                placeholder="0.5"
                className="w-full bg-transparent text-right font-bold text-rose-900 text-[11px] focus:outline-none"
              />
              <span className="text-[9px] font-bold text-rose-700 ml-0.5 shrink-0">초</span>
            </div>
          </div>

          <div className="mt-1 text-[8.5px] text-[#64748B] leading-tight bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <div>• {settings.ecDelayWarningSec ?? 0.3}초 초과 ➔ ⚠️ Warning (주의)</div>
            <div>• {settings.ecDelayAlarmSec ?? 0.5}초 초과 ➔ 🚨 Alarm (경보)</div>
            <div className="text-[8px] text-[#94A3B8] mt-0.5">(RF, Matcher & Gas MFC 7종 Delay 산출값 공통 적용)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
