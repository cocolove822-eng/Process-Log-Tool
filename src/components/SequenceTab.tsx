import React, { useState, useMemo } from 'react';
import { Copy, Check, Clock } from 'lucide-react';
import { AnalysisFileResult } from '../types/pecvd';
import { copyTableToClipboard } from '../utils/exportUtils';

interface SequenceTabProps {
  results: AnalysisFileResult[];
}

interface ColorStyle {
  bg: string;
  border: string;
  text: string;
}

/**
 * Excel 3-Color Scale (Green -> Yellow -> Red) for numeric timing values in White theme
 */
function getTimingColorStyle(
  val: number | null | undefined,
  min: number,
  max: number
): ColorStyle {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
    return { bg: 'transparent', border: 'transparent', text: '#94A3B8' };
  }
  if (min === max) {
    return {
      bg: '#FEF3C7',
      border: '#FDE68A',
      text: '#B45309',
    };
  }

  const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));

  if (ratio < 0.35) {
    return {
      bg: '#ECFDF5',
      border: '#A7F3D0',
      text: '#047857',
    };
  } else if (ratio < 0.7) {
    return {
      bg: '#FFFBEB',
      border: '#FDE68A',
      text: '#B45309',
    };
  } else {
    return {
      bg: '#FEF2F2',
      border: '#FECACA',
      text: '#B91C1C',
    };
  }
}

export const SequenceTab: React.FC<SequenceTabProps> = ({ results }) => {
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  const timingStats = useMemo(() => {
    const getMinMax = (vals: (number | null | undefined)[]) => {
      const valid = vals.filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
      if (valid.length === 0) return { min: 0, max: 0 };
      return { min: Math.min(...valid), max: Math.max(...valid) };
    };

    return {
      // Start table
      depoStable_pyroN2O: getMinMax(results.map(r => r.hwStart.depoStable_pyroN2O)),
      depoStable_pyroNH3: getMinMax(results.map(r => r.hwStart.depoStable_pyroNH3)),
      depoStable_pyroPN2: getMinMax(results.map(r => r.hwStart.depoStable_pyroPN2)),
      depoStable_pyroH2: getMinMax(results.map(r => r.hwStart.depoStable_pyroH2)),
      depoStable_pyroSiH4: getMinMax(results.map(r => r.hwStart.depoStable_pyroSiH4)),
      depoStable_tvCtrlMode: getMinMax(results.map(r => r.hwStart.depoStable_tvCtrlMode)),
      depo_rfForwardAct: getMinMax(results.map(r => r.hwStart.depo_rfForwardAct)),
      plStable_pyroAr: getMinMax(results.map(r => r.hwStart.plStable_pyroAr)),
      plStable_pyroH2: getMinMax(results.map(r => r.hwStart.plStable_pyroH2)),
      plStable_tvCtrlMode: getMinMax(results.map(r => r.hwStart.plStable_tvCtrlMode)),
      pl_rfForwardAct: getMinMax(results.map(r => r.hwStart.pl_rfForwardAct)),

      // End table
      end_depo_rf: getMinMax(results.map(r => r.hwEndRF.depo_rfForwardAct)),
      end_depo_tv: getMinMax(results.map(r => r.hwEndRF.depo_tvCtrlMode)),
      end_depo_sih4: getMinMax(results.map(r => r.hwEndRF.depo_pyroSiH4)),
      end_depo_ar: getMinMax(results.map(r => r.hwEndRF.depo_pyroAr)),
      end_depo_n2o: getMinMax(results.map(r => r.hwEndRF.depo_pyroN2O)),
      end_depo_nh3: getMinMax(results.map(r => r.hwEndRF.depo_pyroNH3)),
      end_depo_pn2: getMinMax(results.map(r => r.hwEndRF.depo_pyroPN2)),
      end_depo_h2: getMinMax(results.map(r => r.hwEndRF.depo_pyroH2)),
      end_pl_rf: getMinMax(results.map(r => r.hwEndRF.pl_rfForwardAct)),
      end_pl_tv: getMinMax(results.map(r => r.hwEndRF.pl_tvCtrlMode)),
      end_pl_ar: getMinMax(results.map(r => r.hwEndRF.pl_pyroAr)),
      end_pl_h2: getMinMax(results.map(r => r.hwEndRF.pl_pyroH2)),
    };
  }, [results]);

  const handleCopy = async (tableId: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
    const ok = await copyTableToClipboard(headers, rows);
    if (ok) {
      setCopiedTable(tableId);
      setTimeout(() => setCopiedTable(null), 2000);
    }
  };

  const fmt = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    return Number(val).toFixed(1);
  };

  const fmtSigned = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '-';
    const s = Number(val).toFixed(1);
    return val > 0 ? `+${s}` : s;
  };

  const renderBadge = (
    val: number | null | undefined,
    stat: { min: number; max: number },
    signed = false
  ) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
      return <span className="text-[#94A3B8] font-mono">-</span>;
    }
    const style = getTimingColorStyle(val, stat.min, stat.max);
    const textStr = signed ? fmtSigned(val) : fmt(val);

    return (
      <span
        className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border inline-block min-w-[42px] text-center shadow-xs"
        style={{
          backgroundColor: style.bg,
          borderColor: style.border,
          color: style.text,
        }}
      >
        {textStr}
      </span>
    );
  };

  // Headers & rows for Table 1 (Start)
  const startHeaders = [
    'No.', 'RCP Name',
    'Depo.Stb Pyro.N2O', 'Depo.Stb Pyro.NH3', 'Depo.Stb Pyro.PN2', 'Depo.Stb Pyro.H2', 'Depo.Stb Pyro.SiH4', 'Depo.Stb T/V Mode',
    'Depo RF Fwd(A)',
    'PL.Stb Pyro.Ar', 'PL.Stb Pyro.H2', 'PL.Stb T/V Mode', 'PL RF Fwd(A)'
  ];

  const startRows = results.map(r => {
    const s = r.hwStart;
    return [
      s.no, s.rcpName,
      fmt(s.depoStable_pyroN2O), fmt(s.depoStable_pyroNH3), fmt(s.depoStable_pyroPN2), fmt(s.depoStable_pyroH2), fmt(s.depoStable_pyroSiH4), fmt(s.depoStable_tvCtrlMode),
      fmt(s.depo_rfForwardAct),
      fmt(s.plStable_pyroAr), fmt(s.plStable_pyroH2), fmt(s.plStable_tvCtrlMode), fmt(s.pl_rfForwardAct)
    ];
  });

  // Headers & rows for Table 2 (End RF)
  const endRFHeaders = [
    'No.', 'RCP Name',
    'Depo RF Fwd(A)', 'Depo T/V Mode', 'Depo Pyro.SiH4', 'Depo Pyro.Ar', 'Depo Pyro.N2O', 'Depo Pyro.NH3', 'Depo Pyro.PN2', 'Depo Pyro.H2',
    'PL RF Fwd(A)', 'PL T/V Mode', 'PL Pyro.Ar', 'PL Pyro.H2'
  ];

  const endRFRows = results.map(r => {
    const e = r.hwEndRF;
    return [
      e.no, e.rcpName,
      fmt(e.depo_rfForwardAct), fmtSigned(e.depo_tvCtrlMode), fmtSigned(e.depo_pyroSiH4), fmtSigned(e.depo_pyroAr), fmtSigned(e.depo_pyroN2O), fmtSigned(e.depo_pyroNH3), fmtSigned(e.depo_pyroPN2), fmtSigned(e.depo_pyroH2),
      fmt(e.pl_rfForwardAct), fmtSigned(e.pl_tvCtrlMode), fmtSigned(e.pl_pyroAr), fmtSigned(e.pl_pyroH2)
    ];
  });

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Visual Legend Bar (White Card) */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-3 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#2563EB]" />
          <h3 className="text-xs font-bold text-[#0F172A] tracking-tight">H/W 시퀀스 타이밍 분석</h3>
          <span className="text-[11px] text-[#64748B]">· 엑셀 분석 Tool 스타일 3색 히트맵 적용</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-xl border border-[#CBD5E1]">
          <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
          <span className="text-[#16A34A] font-semibold">작은값(초록)</span>
          <span className="text-[#CBD5E1]">·</span>
          <span className="w-2 h-2 rounded-full bg-[#D97706]" />
          <span className="text-[#D97706] font-semibold">중간값(노랑)</span>
          <span className="text-[#CBD5E1]">·</span>
          <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
          <span className="text-[#DC2626] font-semibold">큰값(빨강)</span>
        </div>
      </div>

      {/* Table 1: H/W Control Start 시점 (White Card) */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#0F172A] tracking-tight">
              H/W Control Start 시점 (0.0s = 각 Step 시작 기준)
            </h3>
            <span className="text-[11px] text-[#64748B]">
              · 가스 유량 ≥ 1 및 밸브 제어 전환 최초 시점
            </span>
          </div>

          <button
            onClick={() => handleCopy('start-table', startHeaders, startRows)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#E2E8F0] bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] shadow-xs transition-all active:scale-[0.98]"
          >
            {copiedTable === 'start-table' ? (
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
                <th rowSpan={2} className="py-2 px-2.5 border-r border-[#CBD5E1] text-center">No.</th>
                <th rowSpan={2} className="py-2 px-3 border-r border-[#CBD5E1] text-center">RCP Name</th>
                <th colSpan={6} className="py-1 px-2 border-r border-[#CBD5E1] text-center bg-[#EFF6FF] text-[#2563EB]">
                  Depo. Stable Step
                </th>
                <th className="py-1 px-2 border-r border-[#CBD5E1] text-center bg-[#FFFBEB] text-[#D97706]">
                  Depo. Step
                </th>
                <th colSpan={3} className="py-1 px-2 border-r border-[#CBD5E1] text-center bg-[#F5F3FF] text-[#7C3AED]">
                  PL Stable Step
                </th>
                <th className="py-1 px-2 text-center bg-[#ECFDF5] text-[#059669]">
                  PL Step
                </th>
              </tr>
              <tr className="border-t border-[#CBD5E1] text-[11px] bg-[#F8FAFC] text-[#475569]">
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.N2O</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.NH3</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.PN2</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.H2</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold text-[#16A34A]">Pyro.SiH4</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">T/V Mode</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold text-[#2563EB]">RF Fwd(Act)</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.Ar</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.H2</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">T/V Mode</th>
                <th className="py-1.5 px-2 text-center font-bold text-[#059669]">RF Fwd(Act)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs text-[#334155]">
              {results.map((r, idx) => {
                const s = r.hwStart;
                return (
                  <tr key={`${r.fileId || 'item'}_${idx}`} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-1.5 px-2.5 text-center text-[#64748B] border-r border-[#E2E8F0]">{s.no}</td>
                    <td className="py-1.5 px-3 font-sans font-bold text-[#0F172A] border-r border-[#E2E8F0] text-center">{s.rcpName}</td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.depoStable_pyroN2O, timingStats.depoStable_pyroN2O)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.depoStable_pyroNH3, timingStats.depoStable_pyroNH3)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.depoStable_pyroPN2, timingStats.depoStable_pyroPN2)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.depoStable_pyroH2, timingStats.depoStable_pyroH2)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.depoStable_pyroSiH4, timingStats.depoStable_pyroSiH4)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.depoStable_tvCtrlMode, timingStats.depoStable_tvCtrlMode)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.depo_rfForwardAct, timingStats.depo_rfForwardAct)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.plStable_pyroAr, timingStats.plStable_pyroAr)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.plStable_pyroH2, timingStats.plStable_pyroH2)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(s.plStable_tvCtrlMode, timingStats.plStable_tvCtrlMode)}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {renderBadge(s.pl_rfForwardAct, timingStats.pl_rfForwardAct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: H/W Control End 시점 (0.0 sec = RF Power Off) */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            <h3 className="text-xs font-bold text-[#0F172A] tracking-tight">
              H/W Control End 시점 (0.0s = RF Power Off 기준)
            </h3>
            <span className="text-[11px] text-[#64748B]">
              · 음수 = RF Off 이전 조기 차단, 양수 = RF Off 이후 유지 시간 (초)
            </span>
          </div>

          <button
            onClick={() => handleCopy('endrf-table', endRFHeaders, endRFRows)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#E2E8F0] bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] shadow-xs transition-all active:scale-[0.98]"
          >
            {copiedTable === 'endrf-table' ? (
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
                <th rowSpan={2} className="py-2 px-2.5 border-r border-[#CBD5E1] text-center">No.</th>
                <th rowSpan={2} className="py-2 px-3 border-r border-[#CBD5E1] text-center">RCP Name</th>
                <th colSpan={8} className="py-1 px-2 border-r border-[#CBD5E1] text-center bg-[#EFF6FF] text-[#2563EB]">
                  Depo. Step (0.0s = RF Off)
                </th>
                <th colSpan={4} className="py-1 px-2 text-center bg-[#F5F3FF] text-[#7C3AED]">
                  PL Step (0.0s = RF Off)
                </th>
              </tr>
              <tr className="border-t border-[#CBD5E1] text-[11px] bg-[#F8FAFC] text-[#475569]">
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center text-[#64748B]">RF Fwd(A)</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">T/V Mode</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold text-[#DC2626]">Pyro.SiH4</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold text-[#D97706]">Pyro.Ar</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center font-bold text-[#16A34A]">Pyro.N2O</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.NH3</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.PN2</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.H2</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center text-[#64748B]">RF Fwd(A)</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">T/V Mode</th>
                <th className="py-1.5 px-2 border-r border-[#CBD5E1] text-center">Pyro.Ar</th>
                <th className="py-1.5 px-2 text-center">Pyro.H2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs text-[#334155]">
              {results.map((r, idx) => {
                const e = r.hwEndRF;
                return (
                  <tr key={`${r.fileId || 'item'}_${idx}`} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-1.5 px-2.5 text-center text-[#64748B] border-r border-[#E2E8F0]">{e.no}</td>
                    <td className="py-1.5 px-3 font-sans font-bold text-[#0F172A] border-r border-[#E2E8F0] text-center">{e.rcpName}</td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_rfForwardAct, timingStats.end_depo_rf)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_tvCtrlMode, timingStats.end_depo_tv, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_pyroSiH4, timingStats.end_depo_sih4, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_pyroAr, timingStats.end_depo_ar, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_pyroN2O, timingStats.end_depo_n2o, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_pyroNH3, timingStats.end_depo_nh3, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_pyroPN2, timingStats.end_depo_pn2, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.depo_pyroH2, timingStats.end_depo_h2, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.pl_rfForwardAct, timingStats.end_pl_rf)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.pl_tvCtrlMode, timingStats.end_pl_tv, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E2E8F0]">
                      {renderBadge(e.pl_pyroAr, timingStats.end_pl_ar, true)}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {renderBadge(e.pl_pyroH2, timingStats.end_pl_h2, true)}
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
