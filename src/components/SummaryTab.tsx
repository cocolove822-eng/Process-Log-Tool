import React, { useState } from 'react';
import { Copy, Check, Layers } from 'lucide-react';
import { AnalysisFileResult, AnalyzerSettings } from '../types/pecvd';
import { copyTableToClipboard } from '../utils/exportUtils';

interface SummaryTabProps {
  results: AnalysisFileResult[];
  settings: AnalyzerSettings;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ results, settings }) => {
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-2xl border border-[#CBD5E1] shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mb-3.5 text-[#2563EB]">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#0F172A]">등록된 공정 Run이 없습니다</h3>
        <p className="text-xs text-[#64748B] mt-1.5 max-w-md leading-relaxed">
          상단의 <strong>'+ 파일 추가'</strong> 버튼을 통해 분석할 공정 Raw Log(CSV) 파일을 추가해주세요.
        </p>
      </div>
    );
  }

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

  const fmtInt = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    return Math.round(val).toLocaleString();
  };

  const renderAlarmSpan = (
    valStr: string,
    level: 'normal' | 'warning' | 'alarm' | undefined
  ) => {
    if (valStr === '-' || !level || level === 'normal') {
      return <span className="text-[#334155] font-mono">{valStr}</span>;
    }
    if (level === 'alarm') {
      return (
        <span className="bg-[#FEE2E2] text-[#DC2626] font-bold px-1.5 py-0.5 rounded-md border border-[#FECACA] text-[11px] font-mono shadow-xs inline-block">
          {valStr}
        </span>
      );
    }
    return (
      <span className="bg-[#FEF3C7] text-[#D97706] font-bold px-1.5 py-0.5 rounded-md border border-[#FDE68A] text-[11px] font-mono shadow-xs inline-block">
        {valStr}
      </span>
    );
  };

  const currentIntervalDesc = results.length > 0
    ? `${results[0].windowStart ?? 0}s ~ ${results[0].windowEnd ?? 0}s`
    : '-';
  const intervalModeBadge = settings.analysisIntervalMode === 'set_reached'
    ? 'Set 도달 기준'
    : 'RF On 기준';

  // 1. Process Data Set headers
  const setHeaders = [
    'No.', 'RCP Name', 'Step', 'E.Time', 'Date', 'PC',
    'Step Time Set', 'Dep Time (Stable)', 'Dep Time (Set 도달 후)', 'RF Offset (Home Spacing)',
    'RF Power', 'RF Ramp Up', 'RF Ramp Down',
    'RF Ramp Value Up', 'RF Ramp Time Up', 'T/V Pressure Set', 'Lift Spacing Set',
    'Oxy.NF3 Set', 'Oxy.Ar Set', 'Pyro.N2O Set', 'Pyro.NH3 Set', 'Pyro.Ar Set', 'Pyro.PN2 Set', 'Pyro.SiH4 Set', 'Pyro.H2 Set',
    'Gate In 1 Set', 'Gate Out 2 Set', 'Window In 3 Set', 'Window Out 4 Set', 'Side 1 In 5 Set'
  ];

  const setRows = results.map(r => {
    const p = r.processData;
    return [
      p.no, p.rcpName, p.step, p.eTime !== null ? fmt(p.eTime, 1) : '-', p.date, p.pc,
      fmtInt(p.stepTimeSet), fmt(p.depTimeStable, 1), fmt(p.depTimeSetReached, 1), fmtInt(p.rfOffsetHomeSpacing),
      fmtInt(p.rfForwardSetValue), p.rfRampUp !== null ? `(${fmt(p.rfRampUp, 1)})` : '-', fmt(p.rfRampDown, 1),
      fmtInt(p.rfRampValueUp), fmtInt(p.rfRampTimeUp), fmtInt(p.tvPressureSet), fmtInt(p.liftSpacingSet),
      fmtInt(p.oxyNF3Set), fmtInt(p.oxyArSet), fmtInt(p.pyroN2OSet), fmtInt(p.pyroNH3Set), fmtInt(p.pyroArSet), fmtInt(p.pyroPN2Set), fmtInt(p.pyroSiH4Set), fmtInt(p.pyroH2Set),
      fmtInt(p.gateIn1Set), fmtInt(p.gateOut2Set), fmtInt(p.windowIn3Set), fmtInt(p.windowOut4Set), fmtInt(p.side1In5Set)
    ];
  });

  // 2. Monitoring Data headers
  const monHeaders = [
    'No.', 'RCP Name', '구간', 'Stable Step', 'Depo Step', 'PL Step Start', 'PL Step End',
    'Max RF Reflect Power', 'T/V Position Avg', 'Matcher Load Avg', 'Matcher Tune Avg',
    'RF Ch. R (Ω)', 'RF Ch. X (Ω)', 'Matcher Vpp Avg', 'Matcher Irms Avg', 'Matcher DC Bias Avg'
  ];

  const monRows = results.map(r => {
    const m = r.monitoringData;
    return [
      m.no, m.rcpName, `${r.windowStart}s~${r.windowEnd}s`, m.stableStep ?? '-', m.depoStep, m.plStepStart ?? '-', m.plStepEnd ?? '-',
      m.rfReflectPowerMax !== null ? fmt(m.rfReflectPowerMax, 1) : '-',
      m.tvPositionAvg !== null ? `${fmt(m.tvPositionAvg, 1)}${m.tvPositionIsFullOpen ? ' (Full Open)' : ''}` : '-',
      m.matcherLoadAvg !== null ? fmt(m.matcherLoadAvg, 2) : '-',
      m.matcherTuneAvg !== null ? fmt(m.matcherTuneAvg, 2) : '-',
      m.rfChR !== null ? fmt(m.rfChR, 2) : '-',
      m.rfChX !== null ? fmt(m.rfChX, 2) : '-',
      m.matcherNoSignal ? '0.0 (신호없음)' : (m.matcherVppAvg !== null ? fmt(m.matcherVppAvg, 1) : '-'),
      m.matcherNoSignal ? '0.0 (신호없음)' : (m.matcherIrmsAvg !== null ? fmt(m.matcherIrmsAvg, 1) : '-'),
      m.matcherNoSignal ? '0.0 (신호없음)' : (m.matcherDCBiasAvg !== null ? fmt(m.matcherDCBiasAvg, 1) : '-')
    ];
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Table 1: [공정 Data] 공정 조건 Set 값 (Toss White Card) */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#0F172A]">
              [공정 Data] 공정 조건 Set 값
            </h3>
            <span className="text-[11px] text-[#64748B]">
              · 데이터 산출 시점: RF Off {settings.readOffsetSec}초
            </span>
          </div>

          <button
            onClick={() => handleCopy('set-table', setHeaders, setRows)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#E2E8F0] bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] shadow-xs transition-all active:scale-[0.98]"
          >
            {copiedTable === 'set-table' ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="text-[#16A34A] font-bold">복사 완료</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                <span>표 복사</span>
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto max-h-[380px] scrollbar-thin">
          <table className="w-full text-xs text-center border-collapse font-sans whitespace-nowrap">
            <thead className="bg-[#F1F5F9] text-[#475569] font-bold sticky top-0 z-10 border-b border-[#CBD5E1] text-[11px]">
              <tr>
                <th className="py-2 px-2.5 border-r border-[#CBD5E1] text-center">No.</th>
                <th className="py-2 px-3 border-r border-[#CBD5E1] text-center">RCP Name</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Step</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">E.Time</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Date</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">PC</th>
                <th className="py-2 px-2.5 border-r border-[#CBD5E1] text-center bg-[#EFF6FF] text-[#2563EB]">Step Time</th>
                <th className="py-2 px-2.5 border-r border-[#CBD5E1] text-center bg-[#EFF6FF] text-[#2563EB]">Dep Time (Stable)</th>
                <th className="py-2 px-2.5 border-r border-[#CBD5E1] text-center bg-[#EFF6FF] text-[#2563EB]">Dep Time (도달)</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">RF Offset</th>
                <th className="py-2 px-2.5 border-r border-[#CBD5E1] text-center font-bold text-[#2563EB]">RF Power</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Ramp Up</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Ramp Down</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">T/V Press Set</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Lift Spacing</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">N2O Set</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">NH3 Set</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Ar Set</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">PN2 Set</th>
                <th className="py-2 px-2.5 border-r border-[#CBD5E1] text-center font-bold text-[#D97706] bg-[#FFFBEB]">SiH4 Set</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">H2 Set</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Gate In 1</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Window In 3</th>
                <th className="py-2 px-2 border-r border-[#CBD5E1] text-center">Window Out 4</th>
                <th className="py-2 px-2 text-center">Side 1 In 5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs text-[#334155]">
              {results.map((r, idx) => {
                const p = r.processData;
                return (
                  <tr key={`${r.fileId || 'item'}_${idx}`} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-1.5 px-2.5 text-center text-[#64748B] border-r border-[#E2E8F0]">{p.no}</td>
                    <td className="py-1.5 px-3 font-sans font-bold text-[#0F172A] border-r border-[#E2E8F0] text-center">{p.rcpName}</td>
                    <td className="py-1.5 px-2 text-center text-[#2563EB] border-r border-[#E2E8F0] font-bold">{p.step}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(p.eTime, 1)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{p.date}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{p.pc}</td>
                    <td className="py-1.5 px-2.5 text-center text-[#2563EB] bg-[#EFF6FF]/60 border-r border-[#E2E8F0] font-semibold">{fmt(p.stepTimeSet, 1)}</td>
                    <td className="py-1.5 px-2.5 text-center text-[#2563EB] bg-[#EFF6FF]/60 border-r border-[#E2E8F0] font-semibold">{fmt(p.depTimeStable, 1)}</td>
                    <td className="py-1.5 px-2.5 text-center text-[#2563EB] bg-[#EFF6FF]/60 border-r border-[#E2E8F0] font-semibold">{fmt(p.depTimeSetReached, 1)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.rfOffsetHomeSpacing)}</td>
                    <td className="py-1.5 px-2.5 text-center font-bold text-[#2563EB] border-r border-[#E2E8F0]">{fmtInt(p.rfForwardSetValue)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{p.rfRampUp !== null ? `(${fmt(p.rfRampUp, 1)})` : '-'}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(p.rfRampDown, 1)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.tvPressureSet)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.liftSpacingSet)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.pyroN2OSet)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.pyroNH3Set)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.pyroArSet)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.pyroPN2Set)}</td>
                    <td className="py-1.5 px-2.5 text-center font-bold text-[#D97706] bg-[#FFFBEB] border-r border-[#E2E8F0]">{fmtInt(p.pyroSiH4Set)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.pyroH2Set)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.gateIn1Set)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.windowIn3Set)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmtInt(p.windowOut4Set)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B]">{fmtInt(p.side1In5Set)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: [Monitoring Data] 공정 조건 실제 값 */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#0F172A]">
              [Monitoring Data] 공정 조건 실제 값
            </h3>
            <span className="text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
              구간: {currentIntervalDesc} ({intervalModeBadge})
            </span>
            <span className="text-[10px] text-[#64748B]">
              · CTCL Matrix 2차원 보간
            </span>
          </div>

          <button
            onClick={() => handleCopy('mon-table', monHeaders, monRows)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#E2E8F0] bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] shadow-xs transition-all active:scale-[0.98]"
          >
            {copiedTable === 'mon-table' ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="text-[#16A34A] font-bold">복사 완료</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                <span>표 복사</span>
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto max-h-[460px] scrollbar-thin">
          <table className="w-full text-xs text-center border-collapse font-sans whitespace-nowrap">
            <thead className="bg-[#F1F5F9] text-[#475569] font-bold sticky top-0 z-10 border-b border-[#CBD5E1] text-[11px]">
              <tr>
                <th className="py-2 px-2 text-center border-r border-[#CBD5E1]">No.</th>
                <th className="py-2 px-3 border-r border-[#CBD5E1] text-center">RCP Name</th>
                <th className="py-2 px-2 text-center border-r border-[#CBD5E1]">구간</th>
                <th className="py-2 px-2 text-center border-r border-[#CBD5E1]">Stable</th>
                <th className="py-2 px-2 text-center text-[#2563EB] border-r border-[#CBD5E1] font-bold">Depo</th>
                <th className="py-2 px-2 text-center border-r border-[#CBD5E1]">PL S-E</th>
                <th className="py-2 px-2.5 text-center text-[#E11D48] font-bold border-r border-[#CBD5E1]" title="구간 Max (Warning: ≥100W, Alarm: ≥200W)">
                  Reflect Max(W)
                </th>
                <th className="py-2 px-2.5 text-center border-r border-[#CBD5E1]" title="평균 ≥ 100 시 Full Open 배지">
                  T/V Pos Avg
                </th>
                <th className="py-2 px-2 text-center border-r border-[#CBD5E1]">Load</th>
                <th className="py-2 px-2 text-center border-r border-[#CBD5E1]">Tune</th>
                <th className="py-2 px-2.5 text-center font-bold text-[#16A34A] bg-[#F0FDF4] border-r border-[#CBD5E1]">RF Ch. R</th>
                <th className="py-2 px-2.5 text-center font-bold text-[#16A34A] bg-[#F0FDF4] border-r border-[#CBD5E1]">RF Ch. X</th>
                <th className="py-2 px-2.5 text-center border-r border-[#CBD5E1]">Vpp Avg</th>
                <th className="py-2 px-2.5 text-center border-r border-[#CBD5E1]">Irms Avg</th>
                <th className="py-2 px-2.5 text-center">DC Bias Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs text-[#334155]">
              {results.map((r, idx) => {
                const m = r.monitoringData;
                return (
                  <tr key={`${r.fileId || 'item'}_${idx}`} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{m.no}</td>
                    <td className="py-1.5 px-3 font-sans font-bold text-[#0F172A] border-r border-[#E2E8F0] text-center">
                      {m.rcpName}
                    </td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0] text-[10px]">
                      {r.windowStart}s~{r.windowEnd}s
                    </td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{m.stableStep ?? '-'}</td>
                    <td className="py-1.5 px-2 text-center font-bold text-[#2563EB] border-r border-[#E2E8F0]">{m.depoStep}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">
                      {m.plStepStart ? `${m.plStepStart}-${m.plStepEnd}` : '-'}
                    </td>

                    {/* RF Reflect Power (구간 Max) */}
                    <td className="py-1.5 px-2.5 text-center border-r border-[#E2E8F0]">
                      {renderAlarmSpan(
                        m.rfReflectPowerMax !== null ? fmt(m.rfReflectPowerMax, 1) : '-',
                        m.rfReflectAlarmLevel
                      )}
                    </td>

                    {/* T/V Position Avg */}
                    <td className="py-1.5 px-2.5 text-center text-[#334155] border-r border-[#E2E8F0]">
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>{m.tvPositionAvg !== null ? fmt(m.tvPositionAvg, 1) : '-'}</span>
                        {m.tvPositionIsFullOpen && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                            Full Open
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(m.matcherLoadAvg, 2)}</td>
                    <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(m.matcherTuneAvg, 2)}</td>
                    <td className="py-1.5 px-2.5 text-center font-bold text-[#16A34A] bg-[#F0FDF4] border-r border-[#E2E8F0]">
                      {m.rfChR !== null ? `${fmt(m.rfChR, 2)}Ω` : '-'}
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-bold text-[#16A34A] bg-[#F0FDF4] border-r border-[#E2E8F0]">
                      {m.rfChX !== null ? `${fmt(m.rfChX, 2)}Ω` : '-'}
                    </td>

                    {/* Matcher Vpp, Irms, DC Bias */}
                    <td className={`py-1.5 px-2.5 text-center border-r border-[#E2E8F0] ${m.matcherNoSignal ? 'opacity-40 text-[#94A3B8]' : 'text-[#334155]'}`}>
                      {m.matcherNoSignal ? '0.0' : fmt(m.matcherVppAvg, 1)}
                    </td>
                    <td className={`py-1.5 px-2.5 text-center border-r border-[#E2E8F0] ${m.matcherNoSignal ? 'opacity-40 text-[#94A3B8]' : 'text-[#334155]'}`}>
                      {m.matcherNoSignal ? '0.0' : fmt(m.matcherIrmsAvg, 1)}
                    </td>
                    <td className={`py-1.5 px-2.5 text-center ${m.matcherNoSignal ? 'opacity-40 text-[#94A3B8]' : 'text-[#334155]'}`}>
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>{m.matcherNoSignal ? '0.0' : fmt(m.matcherDCBiasAvg, 1)}</span>
                        {m.matcherNoSignal && (
                          <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-1 py-0.2 rounded border border-[#CBD5E1]">
                            신호없음
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
