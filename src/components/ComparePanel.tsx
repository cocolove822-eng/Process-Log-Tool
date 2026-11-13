import React, { useMemo, useState } from 'react';
import { Check, Copy, GitCompareArrows, X } from 'lucide-react';
import { AnalysisFileResult } from '../types/pecvd';
import { useTheme } from '../context/ThemeContext';
import { copyTableToClipboard } from '../utils/exportUtils';

/* ------------------------------------------------------------------ */
/* 비교 선택 공통                                                        */
/* ------------------------------------------------------------------ */

/** 비교 최대 개수 */
export const COMPARE_MAX = 3;
/** 비교 표시 글자 · 색 (A·B·C) */
export const COMPARE_LETTERS = ['A', 'B', 'C'] as const;
export const COMPARE_COLORS = ['#7C3AED', '#EA580C', '#0D9488'];
export const COMPARE_TINTS = ['#F5F3FF', '#FFF7ED', '#F0FDFA'];

/** Run(Depo) 고유 키: 순서를 바꿔도 같은 Run을 가리킴 */
export const resultKey = (r: AnalysisFileResult) => `${r.fileId}#${r.subIndex ?? 1}`;

/** 표 No. 칸 앞에 붙는 A·B·C 표시 */
export const CompareBadge: React.FC<{ slot: number }> = ({ slot }) =>
  slot < 0 ? null : (
    <b
      data-compare-badge={COMPARE_LETTERS[slot]}
      className="inline-flex shrink-0 items-center justify-center w-[15px] h-[15px] rounded text-[9.5px] font-bold text-white align-middle"
      style={{ backgroundColor: COMPARE_COLORS[slot] }}
    >
      {COMPARE_LETTERS[slot]}
    </b>
  );

/* ------------------------------------------------------------------ */
/* 비교 막대 (선택한 Run · 선택만 보기 · 비교 해제)                          */
/* ------------------------------------------------------------------ */
export const CompareBar: React.FC<{
  results: AnalysisFileResult[];
  compareKeys: string[];
  compareOnly: boolean;
  onToggleCompareOnly: (v: boolean) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  notice?: string | null;
}> = ({ results, compareKeys, compareOnly, onToggleCompareOnly, onRemove, onClear, notice }) => {
  if (compareKeys.length === 0) return null;
  return (
    <div
      data-compare-bar
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 bg-white border border-slate-400 rounded-xl shadow-xs text-[11px]"
    >
      <span className="flex items-center gap-1.5 font-bold text-[#0F172A] whitespace-nowrap">
        <GitCompareArrows className="w-3.5 h-3.5 text-[#7C3AED]" />
        비교 선택 ({compareKeys.length}/{COMPARE_MAX})
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {compareKeys.map((k, slot) => {
          const idx = results.findIndex(r => resultKey(r) === k);
          const r = results[idx];
          if (!r) return null;
          const multi = (r.totalDepoStepsInFile ?? 1) > 1;
          return (
            <span
              key={k}
              data-compare-chip={COMPARE_LETTERS[slot]}
              className="flex items-center gap-1 h-[24px] pl-1 pr-0.5 rounded-lg border bg-white whitespace-nowrap"
              style={{ borderColor: COMPARE_COLORS[slot] }}
            >
              <CompareBadge slot={slot} />
              <span className="font-bold text-[#0F172A] tabular-nums">#{r.displayNo}</span>
              <span className="font-semibold text-[#334155] max-w-[200px] truncate" title={r.processData?.rcpName || r.rcpName}>
                {r.processData?.rcpName || r.rcpName}
              </span>
              {multi && <span className="text-[10px] text-[#64748B]">Depo {r.subIndex}</span>}
              <button
                type="button"
                onClick={() => onRemove(k)}
                className="p-0.5 rounded text-[#94A3B8] hover:text-[#DC2626] hover:bg-slate-100 cursor-pointer"
                title="비교에서 빼기"
                aria-label={`${COMPARE_LETTERS[slot]} 비교에서 빼기`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
      </div>
      <label className="flex items-center gap-1.5 font-semibold text-[#334155] cursor-pointer whitespace-nowrap select-none">
        <input
          type="checkbox"
          aria-label="선택만 보기"
          checked={compareOnly}
          onChange={e => onToggleCompareOnly(e.target.checked)}
          className="w-3.5 h-3.5 accent-[#7C3AED] cursor-pointer"
        />
        선택만 보기 <span className="text-[#94A3B8] font-normal">(모든 표에 고른 행만)</span>
      </label>
      <button
        type="button"
        onClick={onClear}
        className="px-2 h-[24px] rounded-lg border border-slate-300 bg-white text-[#475569] font-semibold hover:text-[#DC2626] hover:border-rose-300 cursor-pointer whitespace-nowrap"
      >
        비교 해제
      </button>
      <span className="text-[10.5px] text-[#94A3B8] whitespace-nowrap">
        {notice || '표에서 Ctrl + 클릭으로 추가·빼기 (최대 3개)'}
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* [비교] 카드: 항목을 세로로, A·B·C를 가로로 + 차이(Δ)                      */
/* ------------------------------------------------------------------ */

export interface CompareSection {
  title: string;
  headers: string[];
  /** results와 같은 순서의 행 (표 '데이터 복사'와 같은 값) */
  rows: (string | number | null | undefined)[][];
  /** 비교에서 뺄 열 위치 (No., RCP Name 등) */
  skipCols?: number[];
}

/** 표 문자열 → 숫자 (쉼표·단위 꼬리 제거, 숫자가 아니면 null) */
export const parseCellNumber = (v: string | number | null | undefined): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  // 숫자 뒤에는 공백·괄호 꼬리만 허용 (예: '28.3 (Full Open)') — 날짜 '2026-08-04' 같은 값은 글자로 취급
  const m = String(v).replace(/,/g, '').trim().match(/^([+-]?\d+(?:\.\d+)?)(?:\s|\(|$)/);
  return m ? Number(m[1]) : null;
};

const cellText = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '-' : String(v));

/** 머리글 정리: 'Max: Ref.(W)' → 'Max Ref. (W)' */
const cleanHeader = (h: string) => h.replace(/:\s*/, ' ').replace(/\s*\(([^)]*)\)\s*$/, ' ($1)').trim();

/** 소수 자리: 두 값 중 더 긴 소수 자리에 맞춤 (최대 3) */
const decimalsOf = (...vs: (string | number | null | undefined)[]) =>
  Math.min(
    3,
    Math.max(
      0,
      ...vs.map(v => {
        const m = String(v ?? '').replace(/,/g, '').match(/\.(\d+)/);
        return m ? m[1].length : 0;
      }),
    ),
  );

interface CompareLine {
  section: string;
  item: string;
  values: string[];
  deltas: { text: string; pct: string; sign: number }[];
  differs: boolean;
}

export const CompareCard: React.FC<{
  results: AnalysisFileResult[];
  compareKeys: string[];
  sections: CompareSection[];
}> = ({ results, compareKeys, sections }) => {
  const { theme } = useTheme();
  const [diffOnly, setDiffOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const picked = compareKeys
    .map(k => results.findIndex(r => resultKey(r) === k))
    .filter(i => i >= 0);

  const lines = useMemo<CompareLine[]>(() => {
    const out: CompareLine[] = [];
    sections.forEach(sec => {
      sec.headers.forEach((h, col) => {
        if (sec.skipCols?.includes(col)) return;
        const raw = picked.map(i => sec.rows[i]?.[col]);
        const values = raw.map(cellText);
        const base = parseCellNumber(raw[0]);
        const dec = decimalsOf(...raw);
        const deltas = raw.slice(1).map(v => {
          const n = parseCellNumber(v);
          if (base === null || n === null) {
            return { text: cellText(v) === values[0] ? '같음' : '-', pct: '', sign: 0 };
          }
          const d = n - base;
          const rounded = Math.round(d * Math.pow(10, dec)) / Math.pow(10, dec);
          const sign = rounded > 0 ? 1 : rounded < 0 ? -1 : 0;
          const text =
            sign === 0
              ? '0'
              : `${sign > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
          const pct = sign !== 0 && base !== 0 ? `${d > 0 ? '+' : '−'}${Math.abs((d / Math.abs(base)) * 100).toFixed(1)}%` : '';
          return { text, pct, sign };
        });
        const differs = values.some(v => v !== values[0]);
        out.push({ section: sec.title, item: cleanHeader(h), values, deltas, differs });
      });
    });
    return out;
  }, [sections, picked.join(',')]);

  if (picked.length < 2) return null;
  const shown = diffOnly ? lines.filter(l => l.differs) : lines;
  const diffCount = lines.filter(l => l.differs).length;
  const runs = picked.map(i => results[i]);

  const handleCopy = async () => {
    const headers = [
      '구분',
      '항목',
      ...runs.map((r, s) => `${COMPARE_LETTERS[s]} #${r.displayNo} ${r.processData?.rcpName || r.rcpName}`),
      ...runs.slice(1).map((_, s) => `Δ (${COMPARE_LETTERS[s + 1]}−A)`),
      ...runs.slice(1).map((_, s) => `Δ% (${COMPARE_LETTERS[s + 1]}−A)`),
    ];
    const rows = shown.map(l => [l.section, l.item, ...l.values, ...l.deltas.map(d => d.text), ...l.deltas.map(d => d.pct)]);
    if (await copyTableToClipboard(headers, rows)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const th = 'px-2 py-1.5 border border-slate-400 text-[11px] font-bold text-[#0F172A] bg-[#DDE3EA] whitespace-nowrap';
  const td = 'px-2 py-1 border border-slate-300 text-[11px] tabular-nums whitespace-nowrap';
  let lastSection = '';

  return (
    <section data-compare-card className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow}`}>
      <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-[#7C3AED] shadow-xs" />
          <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>[비교] 선택 Recipe 비교</h3>
          <span className="text-[11px] text-[#475569] font-medium whitespace-nowrap">
            (Recipe Data · Monitoring Data — 기준 A와의 차이 Δ)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#334155] cursor-pointer whitespace-nowrap select-none">
            <input
              type="checkbox"
              aria-label="차이 있는 항목만"
              checked={diffOnly}
              onChange={e => setDiffOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#7C3AED] cursor-pointer"
            />
            차이 있는 항목만 <span className="text-[#94A3B8] font-normal">({diffCount}/{lines.length})</span>
          </label>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${theme.btnSecondary} rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer`}
          >
            {copied ? (
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
      <div className="p-3 overflow-x-auto">
        <table className="border-collapse min-w-[560px]">
          <thead>
            <tr>
              <th className={th}>구분</th>
              <th className={`${th} text-left`}>항목</th>
              {runs.map((r, s) => (
                <th key={s} className={th} style={{ backgroundColor: COMPARE_TINTS[s], borderTop: `3px solid ${COMPARE_COLORS[s]}` }}>
                  <span className="flex items-center justify-center gap-1">
                    <CompareBadge slot={s} />#{r.displayNo}
                  </span>
                  <span className="block font-semibold text-[10.5px] text-[#334155] max-w-[180px] truncate mx-auto" title={r.processData?.rcpName || r.rcpName}>
                    {r.processData?.rcpName || r.rcpName}
                  </span>
                </th>
              ))}
              {runs.slice(1).map((_, s) => (
                <th key={`d${s}`} className={th}>
                  Δ ({COMPARE_LETTERS[s + 1]}−A)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={2 + runs.length * 2 - 1} className={`${td} text-center text-[#059669] font-semibold py-3`}>
                  모든 항목이 같습니다
                </td>
              </tr>
            ) : (
              shown.map((l, i) => {
                const first = l.section !== lastSection;
                lastSection = l.section;
                return (
                  <tr key={i} data-compare-line={l.item} className={l.differs ? 'bg-[#FFFBEB]' : i % 2 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                    <td className={`${td} font-bold text-[#475569] ${first ? '' : 'text-transparent'}`}>{l.section}</td>
                    <td className={`${td} text-left font-semibold text-[#0F172A]`}>{l.item}</td>
                    {l.values.map((v, s) => (
                      <td key={s} className={`${td} text-center font-semibold text-[#0F172A]`}>
                        {v}
                      </td>
                    ))}
                    {l.deltas.map((d, s) => (
                      <td
                        key={`d${s}`}
                        data-compare-delta
                        className={`${td} text-center font-bold ${d.sign > 0 ? 'text-[#1D4ED8]' : d.sign < 0 ? 'text-[#BE123C]' : 'text-[#94A3B8]'}`}
                      >
                        {d.text}
                        {d.pct && <span className="ml-1 text-[10px] font-semibold opacity-80">({d.pct})</span>}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="mt-1.5 text-[10.5px] text-[#94A3B8]">
          노란 줄 = 값이 다른 항목 · Δ는 기준 A와의 차이 (파랑 = A보다 큼, 빨강 = A보다 작음) · 값은 위쪽 표와 같습니다
        </div>
      </div>
    </section>
  );
};
