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

/** 설정 한 줄: 왼쪽 항목 이름 + 설명, 오른쪽 숫자 입력 */
const SettingRow: React.FC<{ label: string; hint: string; title: string; children: React.ReactNode }> = ({
  label,
  hint,
  title,
  children,
}) => (
  <div className="flex items-center justify-between gap-1.5 whitespace-nowrap" title={title}>
    <span className="flex items-baseline gap-1 min-w-0">
      <span className="text-[10.5px] font-bold text-[#0F172A]">{label}</span>
      <span className="text-[9px] text-[#64748B] truncate">{hint}</span>
    </span>
    {children}
  </div>
);

const NumBox: React.FC<{ id: string; value: number; step: number; unit: string; onChange: (v: number) => void }> = ({
  id,
  value,
  step,
  unit,
  onChange,
}) => (
  <div className="relative w-[64px] shrink-0">
    <input
      id={id}
      type="number"
      step={step}
      min={0}
      value={value}
      onChange={e => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) && v >= 0 ? v : 0);
      }}
      className="w-full bg-white border border-slate-300 text-[#2563EB] font-bold rounded-md pl-1 pr-4 py-[1px] text-[11px] text-right focus:outline-none focus:border-[#2563EB] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
    <span className="absolute right-1 top-[2px] text-[9px] text-[#2563EB] font-bold pointer-events-none">{unit}</span>
  </div>
);

/** 주의/경보 숫자 칸 (빈칸 = 판정 안 함) */
const LevelBox: React.FC<{
  tone: 'warn' | 'alarm';
  value: number | null;
  step: number;
  unit: string;
  onChange: (v: number | null) => void;
}> = ({ tone, value, step, unit, onChange }) => {
  const c =
    tone === 'warn'
      ? 'bg-amber-50 border-amber-300 text-amber-900 focus:border-amber-500'
      : 'bg-rose-50 border-rose-300 text-rose-900 focus:border-rose-500';
  const u = tone === 'warn' ? 'text-amber-700' : 'text-rose-700';
  return (
    <span className="relative w-[58px] shrink-0" title={tone === 'warn' ? '주의 (Warning) 기준' : '경보 (Alarm) 기준'}>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={e => {
          const v = parseFloat(e.target.value);
          onChange(e.target.value === '' || !Number.isFinite(v) ? null : v);
        }}
        className={`w-full border rounded-md pl-1 pr-4 py-[1px] text-[11px] font-bold text-right focus:outline-none focus:bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${c}`}
      />
      <span className={`absolute right-1 top-[2px] text-[9px] font-bold pointer-events-none ${u}`}>{unit}</span>
    </span>
  );
};

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

        {/* 분석 구간: 한 카드에 한 줄씩 (시작 · 종료 · RSD 판정 범위) */}
        <div className="bg-white px-2 py-1.5 rounded-xl border border-slate-300 shadow-2xs space-y-1">
          <SettingRow
            label="구간 시작"
            hint="목표(98%) 도달 후"
            title="Ramping Up 실제 목표(98%) 도달 후 데이터 수집을 시작할 버퍼 시간(초)"
          >
            <NumBox
              id="set-start-buffer"
              value={settings.rampUpPostOffsetSec ?? settings.rfStableTimeSec ?? 3.0}
              step={0.5}
              unit="초"
              onChange={val =>
                onUpdateSettings({
                  ...settings,
                  rampUpPostOffsetSec: val,
                  rfStableTimeSec: val,
                  analysisIntervalMode: 'set_reached',
                })
              }
            />
          </SettingRow>
          <SettingRow
            label="구간 종료"
            hint="RF Off·RSD 진입 전"
            title="공정 종료 전(RF Off 직전 또는 RSD 진입 직전) 제외할 버퍼 시간(초)"
          >
            <NumBox
              id="set-end-buffer"
              value={settings.rfRampDownTimeSec ?? 1.0}
              step={0.5}
              unit="초"
              onChange={val => onUpdateSettings({ ...settings, rfRampDownTimeSec: val, rsdPreOffsetSec: val })}
            />
          </SettingRow>
          <SettingRow
            label="RSD 판정"
            hint="RSD Power ±"
            title="Fwd Act가 RSD Power ± 이 값 안에 있는 동안을 RSD 유지 시간으로 계산합니다 (기본 300W)"
          >
            <NumBox
              id="rsd-band-w"
              value={settings.rsdBandW ?? 300}
              step={50}
              unit="W"
              onChange={val => onUpdateSettings({ ...settings, rsdBandW: val })}
            />
          </SettingRow>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Group 2: 항목별 Warning · Alarm 판정 기준 (1번과 같은 한 줄 배치) */}
      {/* ========================================================================= */}
      <div className="space-y-1.5 pt-1 border-t border-slate-300">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0F172A]">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>2. 항목별 판정 기준</span>
          </div>
          <span className="flex items-center gap-1.5 text-[9px] font-semibold">
            <span className="flex items-center gap-0.5 text-amber-700">
              <span className="w-1.5 h-1.5 rounded-sm bg-amber-400" />주의
            </span>
            <span className="flex items-center gap-0.5 text-rose-700">
              <span className="w-1.5 h-1.5 rounded-sm bg-rose-500" />경보
            </span>
          </span>
        </div>

        <div className="bg-white px-2 py-1.5 rounded-xl border border-slate-300 shadow-2xs space-y-1">
          {(
            [
              { label: 'RF Forward', hint: 'Set ±', unit: '%', w: 'ecRfForwardWarningPct', a: 'ecRfForwardAlarmPct', step: 0.5, dot: 'bg-[#2563EB]' },
              { label: 'RF Reflect', hint: 'Max', unit: 'W', w: 'ecRfReflectWarningW', a: 'ecRfReflectAlarmW', step: 10, dot: 'bg-[#7C3AED]' },
              { label: 'Matcher', hint: 'Unif.', unit: '%', w: 'ecMatcherWarningPct', a: 'ecMatcherAlarmPct', step: 0.5, dot: 'bg-[#059669]' },
              { label: 'T/V Press', hint: 'Set ±', unit: '%', w: 'ecPressureWarningPct', a: 'ecPressureAlarmPct', step: 0.5, dot: 'bg-[#65750F]' },
              { label: 'T/V Pos.', hint: 'Unif.', unit: '%', w: 'ecPositionWarningPct', a: 'ecPositionAlarmPct', step: 0.5, dot: 'bg-[#65750F]' },
              { label: 'Gas 유량', hint: 'Set ±', unit: '%', w: 'ecGasWarningPct', a: 'ecGasAlarmPct', step: 0.5, dot: 'bg-[#D97706]' },
              { label: 'Heater', hint: '온도차 ±', unit: '℃', w: 'ecHeaterWarningC', a: 'ecHeaterAlarmC', step: 1, dot: 'bg-[#E11D48]' },
            ] as const
          ).map(row => (
            <div key={row.label} className="flex items-center justify-between gap-1 whitespace-nowrap">
              <span className="flex items-center gap-1 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.dot}`} />
                <span className="text-[10.5px] font-bold text-[#0F172A]">{row.label}</span>
                <span className="text-[9px] text-[#64748B] truncate">{row.hint}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <LevelBox
                  tone="warn"
                  value={(settings as any)[row.w] ?? null}
                  step={row.step}
                  unit={row.unit}
                  onChange={v => onUpdateSettings({ ...settings, [row.w]: v })}
                />
                <LevelBox
                  tone="alarm"
                  value={(settings as any)[row.a] ?? null}
                  step={row.step}
                  unit={row.unit}
                  onChange={v => onUpdateSettings({ ...settings, [row.a]: v })}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Group 3: RF, Matcher & Gas Delay 기준 */}
      {/* ========================================================================= */}
      <div className="space-y-1.5 pt-1 border-t border-slate-300">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0F172A]">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>3. Delay 판정 기준</span>
          </div>
          <span className="text-[9px] text-[#64748B] font-semibold">초과 시 표시</span>
        </div>
        <div className="bg-white px-2 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
          <div
            className="flex items-center justify-between gap-1 whitespace-nowrap"
            title="RF Delay, Matcher Delay, Gas MFC 5종 Delay에 공통 적용됩니다"
          >
            <span className="flex items-baseline gap-1 min-w-0">
              <span className="text-[10.5px] font-bold text-[#0F172A]">Delay</span>
              <span className="text-[9px] text-[#64748B] truncate">RF·Matcher·Gas 공통</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <LevelBox
                tone="warn"
                value={settings.ecDelayWarningSec ?? null}
                step={0.1}
                unit="초"
                onChange={v => onUpdateSettings({ ...settings, ecDelayWarningSec: v as any })}
              />
              <LevelBox
                tone="alarm"
                value={settings.ecDelayAlarmSec ?? null}
                step={0.1}
                unit="초"
                onChange={v => onUpdateSettings({ ...settings, ecDelayAlarmSec: v as any })}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
