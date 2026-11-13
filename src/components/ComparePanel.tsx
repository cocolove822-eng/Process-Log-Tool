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
  /** 머리글에 단위가 없을 때 붙일 단위 (예: H/W Control 'sec') */
  unit?: string;
}

/** 표 문자열 → 숫자 (쉼표·단위 꼬리 제거, 숫자가 아니면 null) */
export const parseCellNumber = (v: string | number | null | undefined): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  // 숫자 뒤에는 공백·괄호·% 꼬리만 허용 (예: '28.3 (Full Open)', '+1.2%') — 날짜 '2026-08-04' 같은 값은 글자로 취급
  const m = String(v).replace(/,/g, '').trim().match(/^([+-]?\d+(?:\.\d+)?)(?:\s|\(|%|$)/);
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
  // 숨긴 구분 (Recipe · Monitoring · H/W Control · 신뢰성)
  const [hidden, setHidden] = useState<string[]>([]);
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
        const item = cleanHeader(h) + (sec.unit && !/\(/.test(h) ? ` (${sec.unit})` : '');
        out.push({ section: sec.title, item, values, deltas, differs });
      });
    });
    return out;
  }, [sections, picked.join(',')]);

  if (picked.length < 2) return null;
  const visibleLines = lines.filter(l => !hidden.includes(l.section));
  const shown = diffOnly ? visibleLines.filter(l => l.differs) : visibleLines;
  const diffCount = visibleLines.filter(l => l.differs).length;
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

  // 구분별로 나누고, 긴 구분은 BLOCK_ROWS줄씩 끊어 작은 표로 (여러 단 배치용)
  const BLOCK_ROWS = 18;
  const blocks: { section: string; part: number; total: number; lines: CompareLine[] }[] = [];
  sections.forEach(sec => {
    const ls = shown.filter(l => l.section === sec.title);
    if (ls.length === 0) return;
    const total = Math.ceil(ls.length / BLOCK_ROWS);
    // 마지막 조각이 너무 짧지 않게 고르게 나눔 (예: 25줄 → 13 + 12)
    const per = Math.ceil(ls.length / total);
    for (let k = 0; k < total; k++) blocks.push({ section: sec.title, part: k + 1, total, lines: ls.slice(k * per, (k + 1) * per) });
  });

  const th = 'px-2 py-1.5 border border-slate-400 text-[11px] font-bold text-[#0F172A] bg-[#DDE3EA] whitespace-nowrap';
  const td = 'px-2 py-1 border border-slate-300 text-[11px] tabular-nums whitespace-nowrap';

  return (
    <section data-compare-card className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow}`}>
      <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-[#7C3AED] shadow-xs" />
          <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>[비교] 선택 Recipe 비교</h3>
          <span className="text-[11px] text-[#475569] font-medium whitespace-nowrap">
            (Recipe · Monitoring · H/W Control 시점 · Parameter 신뢰성 — 기준 A와의 차이 Δ)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* 구분 켜기·끄기 */}
          <div className="flex items-center gap-1" role="group" aria-label="비교 구분">
            {sections.map(sec => {
              const on = !hidden.includes(sec.title);
              return (
                <button
                  key={sec.title}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setHidden(prev => (on ? [...prev, sec.title] : prev.filter(t => t !== sec.title)))}
                  className={`h-[22px] px-2 rounded-full border text-[10.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    on ? 'bg-[#F5F3FF] border-[#7C3AED] text-[#5B21B6]' : 'bg-white border-slate-300 text-[#94A3B8] hover:text-[#475569]'
                  }`}
                  title={on ? `${sec.title} 숨기기` : `${sec.title} 보기`}
                >
                  {on ? '✓ ' : ''}
                  {sec.title}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#334155] cursor-pointer whitespace-nowrap select-none">
            <input
              type="checkbox"
              aria-label="차이 있는 항목만"
              checked={diffOnly}
              onChange={e => setDiffOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#7C3AED] cursor-pointer"
            />
            차이 있는 항목만 <span className="text-[#94A3B8] font-normal">({diffCount}/{visibleLines.length})</span>
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
      {/* Run 범례: 이름은 여기 한 번만, 표 머리는 A·B·C 표시와 번호만 */}
      <div data-compare-legend className="px-3 pt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {runs.map((r, s) => (
          <span key={s} className="flex items-center gap-1.5 whitespace-nowrap">
            <CompareBadge slot={s} />
            <b className="text-[#0F172A] tabular-nums">#{r.displayNo}</b>
            <span className="font-semibold text-[#334155]">{r.processData?.rcpName || r.rcpName}</span>
            {(r.totalDepoStepsInFile ?? 1) > 1 && <span className="text-[#64748B]">Depo {r.subIndex}</span>}
          </span>
        ))}
        <span className="text-[10.5px] text-[#94A3B8] whitespace-nowrap">
          노란 줄 = 값이 다른 항목 · Δ = 기준 A와의 차이 (파랑 = A보다 큼, 빨강 = A보다 작음) · 값은 위쪽 표와 같습니다
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="m-3 p-4 text-center text-[12px] font-semibold text-[#059669] bg-white border border-dashed border-slate-300 rounded-xl">
          모든 항목이 같습니다
        </div>
      ) : (
        /* 구분별 작은 표(최대 BLOCK_ROWS줄)를 신문처럼 왼쪽 위부터 여러 단으로 채움 → 가로 공간 활용 */
        <div data-compare-blocks className="p-3" style={{ columnWidth: `${runs.length >= 3 ? 620 : 440}px`, columnGap: '12px' }}>
          {blocks.map(bk => (
            <div key={`${bk.section}-${bk.part}`} data-compare-block={bk.section} className="inline-block w-full mb-3 break-inside-avoid">
              {/* 열 너비 고정: 값 78px · Δ 122px, 항목 이름은 남는 폭 (길면 두 줄) → 옆 단으로 넘치지 않음 */}
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col />
                  {runs.map((_, s) => (
                    <col key={s} style={{ width: 78 }} />
                  ))}
                  {runs.slice(1).map((_, s) => (
                    <col key={`d${s}`} style={{ width: 122 }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th colSpan={1 + runs.length * 2 - 1} className={`${th} text-left !bg-[#E2E8F0]`}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                        {bk.section}
                        {bk.total > 1 && <span className="text-[10.5px] font-semibold text-[#64748B]">({bk.part}/{bk.total})</span>}
                        <span className="ml-auto text-[10.5px] font-semibold text-[#94A3B8]">{bk.lines.length}개 항목</span>
                      </span>
                    </th>
                  </tr>
                  <tr>
                    <th className={`${th} text-left`}>항목</th>
                    {runs.map((r, s) => (
                      <th key={s} className={th} style={{ backgroundColor: COMPARE_TINTS[s], borderTop: `3px solid ${COMPARE_COLORS[s]}` }} title={r.processData?.rcpName || r.rcpName}>
                        <span className="flex items-center justify-center gap-1">
                          <CompareBadge slot={s} />#{r.displayNo}
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
                  {bk.lines.map((l, i) => (
                    <tr key={i} data-compare-line={l.item} className={l.differs ? 'bg-[#FFFBEB]' : i % 2 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                      <td className={`${td} !whitespace-normal break-words leading-tight text-left font-semibold text-[#0F172A]`} title={l.item}>
                        {l.item}
                      </td>
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
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
