import React, { useState } from 'react';
import { Copy, Check, ShieldAlert, Layers } from 'lucide-react';
import { AnalysisFileResult, AnalyzerSettings, DeviationStat } from '../types/pecvd';
import { copyTableToClipboard } from '../utils/exportUtils';

interface DeviationTabProps {
  results: AnalysisFileResult[];
  settings: AnalyzerSettings;
}

export const DeviationTab: React.FC<DeviationTabProps> = ({ results, settings }) => {
  const [copiedTable, setCopiedTable] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'rf_matcher' | 'pressure_lift'>('rf_matcher');

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

  const fmtPct = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    return `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
  };

  // Alarm cell renderer without redundant units (units are in header)
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

  const renderDevCell = (stat: DeviationStat, type: 'min' | 'max') => {
    if (stat.isHeaterC) {
      const val = type === 'min' ? stat.minDev : stat.maxDev;
      const level = type === 'min' ? stat.minAlarmLevel : stat.maxAlarmLevel;
      if (val === null || val === undefined) return <span className="text-[#94A3B8] font-mono">-</span>;
      const str = `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
      return renderAlarmSpan(str, level);
    }

    const valPct = type === 'min' ? stat.minDevPct : stat.maxDevPct;
    const level = type === 'min' ? stat.minAlarmLevel : stat.maxAlarmLevel;
    if (valPct === null || valPct === undefined) return <span className="text-[#94A3B8] font-mono">-</span>;
    const str = `${valPct > 0 ? '+' : ''}${valPct.toFixed(1)}`;
    return renderAlarmSpan(str, level);
  };

  const currentIntervalDesc = results.length > 0
    ? `${results[0].windowStart ?? 0}s ~ ${results[0].windowEnd ?? 0}s`
    : '-';
  const intervalModeBadge = settings.analysisIntervalMode === 'set_reached'
    ? 'Set 도달 기준'
    : 'RF On 기준';

  // Table A: RF & Matcher Headers & Rows
  const tRfHeaders = [
    'No.', 'RCP Name', '구간',
    'RF Fwd Min', 'RF Fwd Max', 'RF Fwd Min편차', 'RF Fwd Max편차',
    'Reflect Min', 'Reflect Max', 'Forward 대비 비율',
    'Vpp Min', 'Vpp Max', 'Vpp Unif.',
    'Irms Min', 'Irms Max', 'Irms Unif.',
    'DC Bias Min', 'DC Bias Max', 'DC Bias Unif.'
  ];

  const tRfRows = results.map(r => {
    const d = r.deviation;
    return [
      d.no, d.rcpName, `${r.windowStart}s~${r.windowEnd}s`,
      fmt(d.rfForward.min), fmt(d.rfForward.max), fmtPct(d.rfForward.minDevPct), fmtPct(d.rfForward.maxDevPct),
      fmt(d.rfReflect.min), fmt(d.rfReflect.max), d.rfReflect.ratioToForwardPct !== null && d.rfReflect.ratioToForwardPct !== undefined ? `${d.rfReflect.ratioToForwardPct.toFixed(1)}` : '-',
      fmt(d.matcherVpp.min), fmt(d.matcherVpp.max), fmtPct(d.matcherVpp.uniformityPct),
      fmt(d.matcherIrms.min), fmt(d.matcherIrms.max), fmtPct(d.matcherIrms.uniformityPct),
      fmt(d.matcherDCBias.min), fmt(d.matcherDCBias.max), fmtPct(d.matcherDCBias.uniformityPct),
    ];
  });

  // Table B: Pressure & Lift Spacing Headers & Rows
  const tPressLiftHeaders = [
    'No.', 'RCP Name', '구간',
    'Press Min', 'Press Max', 'Press Min편차', 'Press Max편차',
    'Pos Min', 'Pos Max', 'Pos Unif.',
    'Lift Min', 'Lift Max', 'Lift Min편차', 'Lift Max편차'
  ];

  const tPressLiftRows = results.map(r => {
    const d = r.deviation;
    return [
      d.no, d.rcpName, `${r.windowStart}s~${r.windowEnd}s`,
      fmt(d.tvPressure.min), fmt(d.tvPressure.max), fmtPct(d.tvPressure.minDevPct), fmtPct(d.tvPressure.maxDevPct),
      fmt(d.tvPosition.min), fmt(d.tvPosition.max), fmtPct(d.tvPosition.uniformityPct),
      fmt(d.liftSpacing.min), fmt(d.liftSpacing.max), fmtPct(d.liftSpacing.minDevPct), fmtPct(d.liftSpacing.maxDevPct),
    ];
  });

  return (
    <div className="space-y-4 text-xs">
      {/* EC Criteria Reference Card */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
              <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#0F172A]">
                EC 관리 기준표 (Engineering Criteria)
              </h3>
              <span className="text-[10px] text-[#64748B]">
                양방향: |값| ≥ 기준 / 상한: 값 ≥ 기준 · 미설정 항목은 판정 제외
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 bg-[#FEF3C7] border border-[#FDE68A] px-2.5 py-0.5 rounded-full">
              <span className="text-[#B45309] font-bold text-[11px]">⚠️ Warning (주의)</span>
            </span>
            <span className="flex items-center gap-1.5 bg-[#FEE2E2] border border-[#FECACA] px-2.5 py-0.5 rounded-full">
              <span className="text-[#DC2626] font-bold text-[11px]">🚨 Alarm (경보)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#2563EB]">
            <div className="text-[10px] font-bold text-[#1D4ED8]">RF Forward (Act)</div>
            <div className="font-mono text-[#1D4ED8] font-bold text-xs mt-0.5">
              ±{settings.ecRfForwardWarningPct ?? 2}% / ±{settings.ecRfForwardAlarmPct ?? 3}%
            </div>
            <div className="text-[10px] text-[#64748B]">양방향</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#E11D48]">
            <div className="text-[10px] font-bold text-[#BE123C]">RF Reflect Max</div>
            <div className="font-mono text-[#BE123C] font-bold text-xs mt-0.5">
              {settings.ecRfReflectWarningW ?? 100}W / {settings.ecRfReflectAlarmW ?? 200}W
            </div>
            <div className="text-[10px] text-[#64748B]">상한</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#059669]">
            <div className="text-[10px] font-bold text-[#047857]">Matcher Uniformity</div>
            <div className="font-mono text-[#047857] font-bold text-xs mt-0.5">
              {settings.ecMatcherWarningPct ?? 2}% / {settings.ecMatcherAlarmPct ?? 3}%
            </div>
            <div className="text-[10px] text-[#64748B]">상한 (Vpp/Irms/DC)</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#D97706]">
            <div className="text-[10px] font-bold text-[#B45309]">T/V Pressure</div>
            <div className="font-mono text-[#B45309] font-bold text-xs mt-0.5">
              ±{settings.ecPressureWarningPct ?? 2}% / ±{settings.ecPressureAlarmPct ?? 5}%
            </div>
            <div className="text-[10px] text-[#64748B]">양방향</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#D97706]">
            <div className="text-[10px] font-bold text-[#B45309]">T/V Position</div>
            <div className="font-mono text-[#B45309] font-bold text-xs mt-0.5">
              {settings.ecPositionWarningPct ?? 0.5}% / {settings.ecPositionAlarmPct ?? 1.0}%
            </div>
            <div className="text-[10px] text-[#64748B]">상한</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#4F46E5]">
            <div className="text-[10px] font-bold text-[#4338CA]">Lift Spacing</div>
            <div className="font-mono text-[#4338CA] font-bold text-xs mt-0.5">
              {settings.ecLiftSpacingWarningPct !== null ? `±${settings.ecLiftSpacingWarningPct}%` : '미설정'}
            </div>
            <div className="text-[10px] text-[#64748B]">양방향</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#EA580C]">
            <div className="text-[10px] font-bold text-[#C2410C]">Gas 유량 (전 종류)</div>
            <div className="font-mono text-[#C2410C] font-bold text-xs mt-0.5">
              ±{settings.ecGasWarningPct ?? 3}% / ±{settings.ecGasAlarmPct ?? 5}%
            </div>
            <div className="text-[10px] text-[#64748B]">양방향</div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-[#CBD5E1] border-t-2 border-t-[#DC2626]">
            <div className="text-[10px] font-bold text-[#B91C1C]">Heater Zone (℃)</div>
            <div className="font-mono text-[#B91C1C] font-bold text-xs mt-0.5">
              ±{settings.ecHeaterWarningC ?? 5}℃ / ±{settings.ecHeaterAlarmC ?? 10}℃
            </div>
            <div className="text-[10px] text-[#64748B]">양방향 (온도차)</div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs for RF Matcher vs Pressure Lift to ensure RCP Name is fully readable */}
      <div className="flex items-center gap-2 border-b border-[#CBD5E1] pb-2">
        <button
          onClick={() => setActiveSubTab('rf_matcher')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'rf_matcher'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'bg-white text-[#475569] border border-[#CBD5E1] hover:bg-[#F8FAFC]'
          }`}
        >
          1. RF & Matcher 분석
        </button>
        <button
          onClick={() => setActiveSubTab('pressure_lift')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'pressure_lift'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'bg-white text-[#475569] border border-[#CBD5E1] hover:bg-[#F8FAFC]'
          }`}
        >
          2. Pressure & Lift Spacing 분석
        </button>
      </div>

      {/* Active Tab Content */}
      {activeSubTab === 'rf_matcher' ? (
        <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              <h3 className="text-xs font-bold text-[#0F172A]">
                [Monitoring Data] 공정 Parameter 신뢰성 분석 - RF & Matcher
              </h3>
              <span className="text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
                구간: {currentIntervalDesc} ({intervalModeBadge})
              </span>
            </div>

            <button
              onClick={() => handleCopy('rf-table', tRfHeaders, tRfRows)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#E2E8F0] bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] shadow-xs transition-all active:scale-[0.98]"
            >
              {copiedTable === 'rf-table' ? (
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
              <colgroup>
                <col className="w-[36px]" />
                <col className="min-w-[110px] w-[130px]" />
                <col className="w-[60px]" />
              </colgroup>
              <thead className="bg-[#F1F5F9] text-[#475569] font-bold sticky top-0 z-10 border-b border-[#CBD5E1] text-[11px]">
                <tr>
                  <th rowSpan={2} className="py-2.5 px-2.5 border-r border-[#CBD5E1] text-center">No.</th>
                  <th rowSpan={2} className="py-2.5 px-3 border-r border-[#CBD5E1] text-center">RCP Name</th>
                  <th rowSpan={2} className="py-2.5 px-2 border-r border-[#CBD5E1] text-center">구간</th>
                  <th colSpan={4} className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold">
                    RF Forward Power(Act) (W)
                  </th>
                  <th colSpan={3} className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold">
                    RF Reflect Power (W)
                  </th>
                  <th colSpan={3} className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold">
                    Matcher Vpp (V)
                  </th>
                  <th colSpan={3} className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold">
                    Matcher Irms (A)
                  </th>
                  <th colSpan={3} className="py-1.5 px-2 text-center font-bold">
                    Matcher DC Bias (V)
                  </th>
                </tr>
                <tr className="border-t border-[#CBD5E1] text-[10px] bg-[#F8FAFC]">
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">ΔMin(%)</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">ΔMax(%)</th>

                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Forward 대비 비율</th>

                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">Unif.</th>

                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">Unif.</th>

                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 font-bold">Unif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs text-[#334155]">
                {results.map((r, idx) => {
                  const d = r.deviation;
                  return (
                    <tr key={`${r.fileId || 'item'}_${idx}`} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-1.5 px-2.5 text-center text-[#64748B] border-r border-[#E2E8F0]">{d.no}</td>
                      <td className="py-1.5 px-3 font-sans font-bold text-[#0F172A] border-r border-[#E2E8F0] text-center">
                        {d.rcpName}
                      </td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0] text-[10px]">
                        {r.windowStart}s~{r.windowEnd}s
                      </td>

                      {/* RF Forward */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.rfForward.min)}</td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.rfForward.max)}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">{renderDevCell(d.rfForward, 'min')}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">{renderDevCell(d.rfForward, 'max')}</td>

                      {/* RF Reflect */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.rfReflect.min)}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                        {renderAlarmSpan(fmt(d.rfReflect.max), d.rfReflect.alarmLevel)}
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-[#334155] border-r border-[#E2E8F0]">
                        {d.rfReflect.ratioToForwardPct !== null && d.rfReflect.ratioToForwardPct !== undefined
                          ? `${d.rfReflect.ratioToForwardPct.toFixed(1)}`
                          : '-'}
                      </td>

                      {/* Matcher Vpp */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.matcherVpp.min)}</td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.matcherVpp.max)}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                        {renderAlarmSpan(
                          d.matcherVpp.uniformityPct !== null && d.matcherVpp.uniformityPct !== undefined ? `${d.matcherVpp.uniformityPct.toFixed(1)}` : '-',
                          d.matcherVpp.alarmLevel
                        )}
                      </td>

                      {/* Matcher Irms */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.matcherIrms.min)}</td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.matcherIrms.max)}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                        {renderAlarmSpan(
                          d.matcherIrms.uniformityPct !== null && d.matcherIrms.uniformityPct !== undefined ? `${d.matcherIrms.uniformityPct.toFixed(1)}` : '-',
                          d.matcherIrms.alarmLevel
                        )}
                      </td>

                      {/* Matcher DC Bias */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.matcherDCBias.min)}</td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.matcherDCBias.max)}</td>
                      <td className="py-1.5 px-2 text-center">
                        {renderAlarmSpan(
                          d.matcherDCBias.uniformityPct !== null && d.matcherDCBias.uniformityPct !== undefined ? `${d.matcherDCBias.uniformityPct.toFixed(1)}` : '-',
                          d.matcherDCBias.alarmLevel
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              <h3 className="text-xs font-bold text-[#0F172A]">
                [Monitoring Data] 공정 Parameter 신뢰성 분석 - Pressure & Lift Spacing
              </h3>
              <span className="text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
                구간: {currentIntervalDesc} ({intervalModeBadge})
              </span>
            </div>

            <button
              onClick={() => handleCopy('press-lift-table', tPressLiftHeaders, tPressLiftRows)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#E2E8F0] bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] shadow-xs transition-all active:scale-[0.98]"
            >
              {copiedTable === 'press-lift-table' ? (
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
              <colgroup>
                <col className="w-[36px]" />
                <col className="min-w-[110px] w-[130px]" />
                <col className="w-[60px]" />
              </colgroup>
              <thead className="bg-[#F1F5F9] text-[#475569] font-bold sticky top-0 z-10 border-b border-[#CBD5E1] text-[11px]">
                <tr>
                  <th rowSpan={2} className="py-2.5 px-2.5 border-r border-[#CBD5E1] text-center">No.</th>
                  <th rowSpan={2} className="py-2.5 px-3 border-r border-[#CBD5E1] text-center">RCP Name</th>
                  <th rowSpan={2} className="py-2.5 px-2 border-r border-[#CBD5E1] text-center">구간</th>
                  <th colSpan={4} className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold">
                    T/V Pressure (mTorr)
                  </th>
                  <th colSpan={3} className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold">
                    T/V Position (%)
                  </th>
                  <th colSpan={4} className="py-1.5 px-2 text-center font-bold">
                    Lift Spacing (mm)
                  </th>
                </tr>
                <tr className="border-t border-[#CBD5E1] text-[10px] bg-[#F8FAFC]">
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">ΔMin(%)</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">ΔMax(%)</th>

                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">Unif.</th>

                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Min</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1]">Max</th>
                  <th className="py-1 px-2 border-r border-[#CBD5E1] font-bold">ΔMin(%)</th>
                  <th className="py-1 px-2 font-bold">ΔMax(%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs text-[#334155]">
                {results.map((r, idx) => {
                  const d = r.deviation;
                  return (
                    <tr key={`${r.fileId || 'item'}_${idx}`} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-1.5 px-2.5 text-center text-[#64748B] border-r border-[#E2E8F0]">{d.no}</td>
                      <td className="py-1.5 px-3 font-sans font-bold text-[#0F172A] border-r border-[#E2E8F0] text-center">
                        {d.rcpName}
                      </td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0] text-[10px]">
                        {r.windowStart}s~{r.windowEnd}s
                      </td>

                      {/* T/V Pressure */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.tvPressure.min)}</td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.tvPressure.max)}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">{renderDevCell(d.tvPressure, 'min')}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">{renderDevCell(d.tvPressure, 'max')}</td>

                      {/* T/V Position */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.tvPosition.min)}</td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.tvPosition.max)}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                        {renderAlarmSpan(
                          d.tvPosition.uniformityPct !== null && d.tvPosition.uniformityPct !== undefined ? `${d.tvPosition.uniformityPct.toFixed(1)}` : '-',
                          d.tvPosition.alarmLevel
                        )}
                      </td>

                      {/* Lift Spacing */}
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.liftSpacing.min)}</td>
                      <td className="py-1.5 px-2 text-center text-[#64748B] border-r border-[#E2E8F0]">{fmt(d.liftSpacing.max)}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">{renderDevCell(d.liftSpacing, 'min')}</td>
                      <td className="py-1.5 px-2 text-center">{renderDevCell(d.liftSpacing, 'max')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
