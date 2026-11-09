import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, List, Plus, SearchCheck, X } from 'lucide-react';
import { RawLogRow } from '../types/pecvd';

/* ============================================================================
 * 원본 로그 '조건 찾기'
 *  - 항목 · 비교 · 값으로 조건을 만들고(최대 3개, 그리고/또는), 맞는 행을 찾아 구간 단위로 이동
 *  - 편차 항목: Set 대비 |편차|(%) 또는 |Act − Set|(℃) — Set이 있는 행만 비교
 *  - 계산(evaluateFind)은 표 쪽에서, 이 파일은 조건 입력 막대 · 결과 이동 · 위치 막대 · 결과 목록 UI
 * ========================================================================== */

export type FindOp = '>' | '>=' | '<' | '<=' | '=' | '!=';

export interface FindField {
  key: string;
  label: string;
  group: string;
  unit?: string;
  kind: 'num' | 'text';
  /** 행에서 값 꺼내기 (없거나 비교할 수 없으면 null) */
  get: (r: RawLogRow) => number | string | null;
  /** 글자 항목의 선택지 (예: PRESS / POS / OPEN) */
  options?: string[];
  /** 강조할 표 칸의 키 */
  hlKey: string;
}

export interface FindCond {
  id: number;
  fieldKey: string;
  op: FindOp;
  value: string;
}

export interface FindSegment {
  /** 표(검색어 적용 후 행 목록) 기준 시작·끝 위치 */
  startPos: number;
  endPos: number;
  rows: number;
  step: number;
  stepName: string;
  startAllTime: number;
  endAllTime: number;
  startTimeStr: string;
  /** 첫 번째 숫자 조건 항목의 대표값 (> 계열은 최댓값, < 계열은 최솟값) */
  peak: number | null;
}

const OP_LABEL: Record<FindOp, string> = { '>': '>', '>=': '≥', '<': '<', '<=': '≤', '=': '=', '!=': '≠' };
const NUM_OPS: FindOp[] = ['>', '>=', '<', '<=', '=', '!='];
const TEXT_OPS: FindOp[] = ['=', '!='];

/** 조건 하나가 실제로 쓰일 수 있는지 (항목이 있고 값이 올바름) */
export const isCondActive = (c: FindCond, fields: FindField[]): boolean => {
  const f = fields.find(x => x.key === c.fieldKey);
  if (!f || c.value.trim() === '') return false;
  if (f.kind === 'num') return Number.isFinite(parseFloat(c.value.replace(/,/g, '')));
  return true;
};

const testOne = (v: number | string | null, op: FindOp, target: string, kind: 'num' | 'text'): boolean => {
  if (v === null || v === undefined) return false;
  if (kind === 'text') {
    const a = String(v).trim().toUpperCase();
    const b = target.trim().toUpperCase();
    return op === '!=' ? a !== b : a === b;
  }
  const a = typeof v === 'number' ? v : parseFloat(String(v));
  const b = parseFloat(target.replace(/,/g, ''));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const eq = Math.abs(a - b) < 1e-6;
  switch (op) {
    case '>': return a > b && !eq;
    case '>=': return a > b || eq;
    case '<': return a < b && !eq;
    case '<=': return a < b || eq;
    case '=': return eq;
    case '!=': return !eq;
  }
};

/**
 * 조건 평가: 행마다 맞는지(hits)와 연속 구간(segments)
 * - scope: [시작, 끝) 위치 범위 (선택 Step만 찾을 때)
 */
export const evaluateFind = (
  rows: RawLogRow[],
  fields: FindField[],
  conds: FindCond[],
  join: 'and' | 'or',
  scope: [number, number] | null
): { hits: Uint8Array | null; segments: FindSegment[]; hitRows: number } => {
  const act = conds
    .filter(c => isCondActive(c, fields))
    .map(c => ({ c, f: fields.find(x => x.key === c.fieldKey)! }));
  if (act.length === 0 || rows.length === 0) return { hits: null, segments: [], hitRows: 0 };
  const hits = new Uint8Array(rows.length);
  const [s0, s1] = scope ?? [0, rows.length];
  let hitRows = 0;
  for (let i = s0; i < s1; i++) {
    const r = rows[i];
    let ok = join === 'and';
    for (const { c, f } of act) {
      const m = testOne(f.get(r), c.op, c.value, f.kind);
      if (join === 'and' && !m) { ok = false; break; }
      if (join === 'or' && m) { ok = true; break; }
    }
    if (ok) { hits[i] = 1; hitRows++; }
  }
  // 대표값: 첫 번째 숫자 조건
  const peakDef = act.find(a => a.f.kind === 'num');
  const segments: FindSegment[] = [];
  let i = s0;
  while (i < s1) {
    if (!hits[i]) { i++; continue; }
    let j = i;
    while (j + 1 < s1 && hits[j + 1]) j++;
    let peak: number | null = null;
    if (peakDef) {
      const wantMin = peakDef.c.op === '<' || peakDef.c.op === '<=';
      for (let k = i; k <= j; k++) {
        const v = peakDef.f.get(rows[k]);
        if (typeof v === 'number' && Number.isFinite(v)) peak = peak === null ? v : wantMin ? Math.min(peak, v) : Math.max(peak, v);
      }
    }
    segments.push({
      startPos: i,
      endPos: j,
      rows: j - i + 1,
      step: rows[i].step,
      stepName: rows[i].stepName,
      startAllTime: rows[i].stepAllTime,
      endAllTime: rows[j].stepAllTime,
      startTimeStr: rows[i].timeStr,
      peak,
    });
    i = j + 1;
  }
  return { hits, segments, hitRows };
};

interface RawConditionFinderProps {
  fields: FindField[];
  conds: FindCond[];
  onChangeConds: (c: FindCond[]) => void;
  join: 'and' | 'or';
  onChangeJoin: (j: 'and' | 'or') => void;
  segments: FindSegment[];
  hitRows: number;
  totalRows: number;
  currentSeg: number;
  onGo: (segIdx: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onClear: () => void;
  /** 선택한 Step이 있을 때만: 그 Step 안에서만 찾기 */
  stepScope: { step: number; on: boolean; onToggle: (v: boolean) => void } | null;
}

let condSeq = 1;
export const newCond = (fieldKey: string, op: FindOp = '>', value = ''): FindCond => ({ id: condSeq++, fieldKey, op, value });

const fmtV = (v: number | null) => (v === null ? '-' : Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));

/**
 * Log 분석 매니저(폭 160px) 안의 '조건 찾기' 카드 — 입력칸을 세로로 쌓은 배치
 */
export const RawConditionFinder: React.FC<RawConditionFinderProps> = ({
  fields,
  conds,
  onChangeConds,
  join,
  onChangeJoin,
  segments,
  hitRows,
  totalRows,
  currentSeg,
  onGo,
  onNext,
  onPrev,
  onClear,
  stepScope,
}) => {
  const [showList, setShowList] = useState(false);
  const [copied, setCopied] = useState(false);
  const groups = useMemo(() => {
    const m = new Map<string, FindField[]>();
    fields.forEach(f => {
      if (!m.has(f.group)) m.set(f.group, []);
      m.get(f.group)!.push(f);
    });
    return [...m.entries()];
  }, [fields]);

  const anyActive = conds.some(c => isCondActive(c, fields));
  const update = (id: number, patch: Partial<FindCond>) =>
    onChangeConds(conds.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const firstNum = conds.map(c => fields.find(f => f.key === c.fieldKey)).find(f => f?.kind === 'num');

  const copyList = async () => {
    const head = ['#', 'Step', 'Name', 'All Time 시작(s)', 'All Time 끝(s)', '행 수', '시작 Time', firstNum ? `대표값 (${firstNum.label}${firstNum.unit ? ` ${firstNum.unit}` : ''})` : '대표값'];
    const lines = segments.map((sg, i) => [i + 1, sg.step, sg.stepName, sg.startAllTime.toFixed(1), sg.endAllTime.toFixed(1), sg.rows, sg.startTimeStr, fmtV(sg.peak)].join('\t'));
    try {
      await navigator.clipboard.writeText([head.join('\t'), ...lines].join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 사용 불가 환경 */
    }
  };

  const selCls =
    'h-[22px] bg-white border border-slate-300 rounded-md px-0.5 text-[10.5px] font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer';

  return (
    <div data-find-bar className="space-y-1 text-[10.5px]">
      {/* 머리줄 (세 매니저 공통 섹션 제목 모양) */}
      <div className="flex items-center justify-between gap-1 min-h-[16px]">
        <span className="flex items-center gap-1 text-[10.5px] font-bold text-[#334155] whitespace-nowrap">
          2. 조건 찾기
          <SearchCheck className="w-3 h-3 text-[#D97706]" />
        </span>
        {anyActive && (
          <button type="button" onClick={onClear} className="text-[10px] font-semibold text-[#64748B] hover:text-[#DC2626] cursor-pointer" title="조건 지우기">
            지우기
          </button>
        )}
      </div>

      {/* 조건들 */}
      {conds.map((c, idx) => {
        const f = fields.find(x => x.key === c.fieldKey);
        const ops = f?.kind === 'text' ? TEXT_OPS : NUM_OPS;
        const active = isCondActive(c, fields);
        return (
          <React.Fragment key={c.id}>
            {idx > 0 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onChangeJoin(join === 'and' ? 'or' : 'and')}
                  className="h-[18px] px-2 rounded-full border border-[#FCD34D] bg-white text-[#92400E] text-[10px] font-bold cursor-pointer hover:bg-[#FEF3C7]"
                  title="누르면 '그리고(모두 만족)' ↔ '또는(하나라도 만족)' 전환"
                >
                  {join === 'and' ? '그리고' : '또는'}
                </button>
              </div>
            )}
            <div className={`rounded-md border p-0.5 space-y-0.5 ${active ? 'border-[#F59E0B] bg-white' : 'border-slate-300 bg-white'}`}>
              <div className="flex items-center gap-0.5">
                <select
                  aria-label="찾을 항목"
                  value={f ? c.fieldKey : ''}
                  onChange={e => {
                    const nf = fields.find(x => x.key === e.target.value);
                    update(c.id, {
                      fieldKey: e.target.value,
                      op: nf?.kind === 'text' ? '=' : c.op === '=' || c.op === '!=' ? '>' : c.op,
                      value: nf?.kind === 'text' ? nf.options?.[0] ?? '' : f?.kind === 'text' ? '' : c.value,
                    });
                  }}
                  className={`${selCls} flex-1 min-w-0`}
                  title={f ? `${f.label}${f.unit ? ` (${f.unit})` : ''}` : '항목 선택'}
                >
                  {!f && <option value="">항목 선택</option>}
                  {groups.map(([g, list]) => (
                    <optgroup key={g} label={g}>
                      {list.map(x => (
                        <option key={x.key} value={x.key}>
                          {x.label}
                          {x.unit ? ` (${x.unit})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {conds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChangeConds(conds.filter(x => x.id !== c.id))}
                    className="p-0.5 text-[#94A3B8] hover:text-[#DC2626] cursor-pointer shrink-0"
                    title="이 조건 삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <select
                  aria-label="비교"
                  value={c.op}
                  onChange={e => update(c.id, { op: e.target.value as FindOp })}
                  className={`${selCls} w-[36px] text-center shrink-0`}
                >
                  {ops.map(o => (
                    <option key={o} value={o}>
                      {OP_LABEL[o]}
                    </option>
                  ))}
                </select>
                {f?.kind === 'text' ? (
                  <select
                    aria-label="값"
                    value={c.value}
                    onChange={e => update(c.id, { value: e.target.value })}
                    className={`${selCls} flex-1 min-w-0`}
                  >
                    {(f.options ?? []).map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label="값"
                    type="text"
                    inputMode="decimal"
                    placeholder="값"
                    value={c.value}
                    onChange={e => update(c.id, { value: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) onPrev();
                        else onNext();
                      }
                    }}
                    className="h-[22px] flex-1 min-w-0 bg-white border border-slate-300 rounded-md px-1 text-right text-[11px] font-bold tabular-nums text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                    title="Enter: 다음 구간 · Shift+Enter: 이전 구간"
                  />
                )}
                {f?.unit && <span className="text-[9.5px] text-[#64748B] font-semibold shrink-0 max-w-[30px] truncate">{f.unit}</span>}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {/* 조건 추가 (최대 3개) */}
      {conds.length < 3 && (
        <button
          type="button"
          onClick={() => onChangeConds([...conds, newCond(conds[conds.length - 1]?.fieldKey ?? fields[0]?.key ?? '')])}
          className="w-full h-[22px] flex items-center justify-center gap-0.5 px-1 rounded-md border border-dashed border-slate-400 bg-white text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] font-semibold cursor-pointer"
          title="조건 추가 (최대 3개)"
        >
          <Plus className="w-3 h-3" />
          조건 추가
        </button>
      )}

      {stepScope && (
        <label className="flex items-center gap-1 px-0.5 text-[#334155] font-semibold cursor-pointer select-none" title="선택한 Step 안에서만 찾기">
          <input type="checkbox" checked={stepScope.on} onChange={e => stepScope.onToggle(e.target.checked)} className="accent-[#2563EB] cursor-pointer" />
          선택 Step(S{stepScope.step})만
        </label>
      )}

      {/* 결과 · 이동 */}
      {anyActive ? (
        segments.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-0.5 text-[#475569]" data-find-count>
              <span>
                <b className="text-[#B45309] tabular-nums">{segments.length.toLocaleString()}</b>구간 ·{' '}
                <b className="tabular-nums text-[#0F172A]">{hitRows.toLocaleString()}</b>행
              </span>
              <span className="text-[9.5px] text-[#94A3B8] tabular-nums">/ {totalRows.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="flex-1 flex items-center rounded-md border border-slate-300 bg-white overflow-hidden">
                <button type="button" onClick={onPrev} className="h-[22px] px-1 hover:bg-slate-100 cursor-pointer" title="이전 구간 (Shift+Enter)">
                  <ChevronLeft className="w-3.5 h-3.5 text-[#334155]" />
                </button>
                <span data-find-pos className="flex-1 text-center font-bold tabular-nums text-[#0F172A] border-x border-slate-200">
                  {currentSeg >= 0 ? currentSeg + 1 : '-'} / {segments.length}
                </span>
                <button type="button" onClick={onNext} className="h-[22px] px-1 hover:bg-slate-100 cursor-pointer" title="다음 구간 (Enter)">
                  <ChevronRight className="w-3.5 h-3.5 text-[#334155]" />
                </button>
              </span>
              <button
                type="button"
                onClick={() => setShowList(v => !v)}
                className={`h-[22px] shrink-0 flex items-center gap-0.5 px-1 rounded-md border font-semibold cursor-pointer ${
                  showList ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-slate-300 bg-white text-[#334155] hover:border-[#2563EB]'
                }`}
                title="찾은 구간 목록"
              >
                <List className="w-3 h-3" />
                목록
              </button>
            </div>
            {showList && (
              <div className="border border-slate-300 rounded-md bg-white overflow-hidden">
                <div className="flex items-center justify-between px-1 py-0.5 bg-[#F1F5F9] border-b border-slate-300">
                  <span className="font-bold text-[#334155] text-[10px]">
                    {segments.length > 200 ? '앞 200개' : `${segments.length}개`}
                    {firstNum ? ` · 대표값 ${firstNum.unit ?? ''}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={copyList}
                    className="flex items-center gap-0.5 text-[10px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                    title="엑셀에 붙여 넣을 수 있게 목록 복사 (Step·이름·시간·행 수·대표값)"
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
                <div className="max-h-[150px] overflow-y-auto scrollbar-thin" data-find-list>
                  {segments.slice(0, 200).map((sg, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => onGo(i)}
                      className={`w-full flex items-center gap-1 px-1 py-[2px] text-left tabular-nums cursor-pointer border-b border-slate-100 ${
                        i === currentSeg ? 'bg-[#DBEAFE] font-bold' : 'hover:bg-[#EFF6FF]'
                      }`}
                      title={`#${i + 1} · S${sg.step} ${sg.stepName} · All Time ${sg.startAllTime.toFixed(1)}~${sg.endAllTime.toFixed(1)}s · ${sg.rows}행 · ${sg.startTimeStr}`}
                    >
                      <span className="text-[9.5px] text-[#94A3B8] w-[18px] shrink-0 text-right">{i + 1}</span>
                      <span className="text-[#2563EB] font-bold shrink-0">S{sg.step}</span>
                      <span className="flex-1 min-w-0 truncate text-[#334155]">{sg.startAllTime.toFixed(1)}s</span>
                      <span className="font-bold text-[#B45309] shrink-0">{fmtV(sg.peak)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-0.5 text-[#64748B] font-semibold" data-find-count>
            맞는 행 없음
          </div>
        )
      ) : null}
    </div>
  );
};

/** 표 위 얇은 위치 막대: Step 경계 + 찾은 구간 (누르면 가장 가까운 구간으로 이동) */
export const FindPositionBar: React.FC<{
  segments: FindSegment[];
  totalRows: number;
  currentSeg: number;
  stepBounds: { pos: number; step: number; name: string }[];
  onGo: (i: number) => void;
}> = ({ segments, totalRows, currentSeg, stepBounds, onGo }) => {
  if (segments.length === 0 || totalRows === 0) return null;
  return (
    <div className="px-3 py-1 bg-[#F8FAFC] border-b border-slate-400 flex items-center gap-2" data-find-posbar>
      <span className="text-[10px] font-bold text-[#92400E] shrink-0 flex items-center gap-1">
        <SearchCheck className="w-3 h-3 text-[#D97706]" />
        찾은 위치
      </span>
      <div
        className="relative flex-1 h-[10px] rounded bg-[#E2E8F0] border border-slate-300 overflow-hidden cursor-pointer"
        title="전체 로그에서 찾은 구간 위치 (누르면 가장 가까운 구간으로 이동)"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = ((e.clientX - rect.left) / rect.width) * totalRows;
          let best = 0;
          let bd = Infinity;
          segments.forEach((sg, i) => {
            const d = pos < sg.startPos ? sg.startPos - pos : pos > sg.endPos ? pos - sg.endPos : 0;
            if (d < bd) { bd = d; best = i; }
          });
          onGo(best);
        }}
      >
        {stepBounds.map(b => (
          <span key={`b${b.pos}`} className="absolute top-0 bottom-0 w-px bg-slate-400/70" style={{ left: `${(b.pos / totalRows) * 100}%` }} title={`S${b.step} ${b.name}`} />
        ))}
        {segments.map((sg, i) => (
          <span
            key={`s${i}`}
            className={`absolute top-[1px] bottom-[1px] rounded-[1px] ${i === currentSeg ? 'bg-[#2563EB]' : 'bg-[#F59E0B]'}`}
            style={{ left: `${(sg.startPos / totalRows) * 100}%`, width: `max(2px, ${((sg.endPos - sg.startPos + 1) / totalRows) * 100}%)` }}
          />
        ))}
      </div>
    </div>
  );
};
