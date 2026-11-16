import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, ListChecks } from 'lucide-react';
import { AnalysisFileResult, ParsedLogFile } from '../types/pecvd';
import { useTheme } from '../context/ThemeContext';
import { copyTableToClipboard } from '../utils/exportUtils';
import { BoundaryCheck, checkSequence, CheckItem, CheckKind, Evidence, OrderStep, SequenceReport, StepSetting, Verdict, worst } from '../utils/sequenceCheck';

/** 판정 근거 원본 Log 행 (keyOnly = 동작이 일어난 행만) */
const EvidenceTable: React.FC<{ ev: Evidence; keyOnly?: boolean; caption?: string }> = ({ ev, keyOnly, caption }) => {
  // 머리글은 필요하면 두 줄로 접어 칸 폭을 줄임 (가로 스크롤 없이)
  const h = 'px-1 py-[3px] border border-slate-400 bg-[#E2E8F0] text-[10px] font-bold text-[#0F172A] text-center leading-tight';
  const c = 'px-1 py-[2px] border border-slate-300 text-[10px] tabular-nums whitespace-nowrap text-center';
  const keyRows = ev.rows.filter(r => !r.gap && r.tag);
  const rows = keyOnly && keyRows.length ? keyRows : ev.rows;
  return (
    <div data-seq-evidence className="overflow-x-auto">
      {caption && <div className="px-1 pt-1 pb-0.5 text-[10px] font-bold text-[#475569]">{caption}</div>}
      <table className="border-collapse w-full">
        <thead>
          <tr>
            <th className={h}>동작</th>
            <th className={h}>행</th>
            <th className={h}>경계 기준</th>
            <th className={h}>Step</th>
            {ev.cols.map(col => (
              <th key={col} className={h}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            r.gap ? (
              <tr key={i}>
                <td colSpan={ev.cols.length + 4} className="px-1.5 py-0 border border-slate-300 text-center text-[10px] text-[#64748B] leading-[12px] bg-[#F1F5F9]">
                  ⋯
                </td>
              </tr>
            ) : (
              <tr key={i} data-ev-key={r.tag ? '1' : undefined} className={r.tag ? 'bg-[#DBEAFE]' : 'bg-white'} title={r.time ? `Time ${r.time}` : undefined}>
                <td className={`${c} !text-left`}>{r.tag && <span className="font-bold text-[#1D4ED8]">▶ {r.tag}</span>}</td>
                <td className={`${c} text-[#64748B]`}>{r.rowNo}</td>
                <td className={`${c} text-[#2563EB] font-semibold`}>{r.t === undefined ? '-' : `${r.t >= 0 ? '+' : '−'}${Math.abs(r.t).toFixed(1)}s`}</td>
                <td className={`${c} font-semibold`}>{r.step}</td>
                {r.cells!.map((v, k) => (
                  <td key={k} className={`${c} ${r.changed![k] ? 'bg-[#FEF08A] font-bold text-[#0F172A]' : 'text-[#334155]'}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

/** 항목들의 근거 표 (같은 근거는 한 번만) */
const evidencesOf = (items: CheckItem[]) => {
  const out: { ev: Evidence; caption: string }[] = [];
  items.forEach(it => {
    if (it.evidence && !out.some(o => o.ev === it.evidence)) out.push({ ev: it.evidence, caption: it.short || it.text });
  });
  return out;
};

/** 접히는 근거 원본 Log 묶음 */
const EvidenceBlock: React.FC<{ list: { ev: Evidence; caption: string }[]; defaultOpen: boolean; defaultKeyOnly: boolean; title?: string }> = ({
  list,
  defaultOpen,
  defaultKeyOnly,
  title,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [keyOnly, setKeyOnly] = useState(defaultKeyOnly);
  if (list.length === 0) return null;
  return (
    <div data-seq-evblock className="border-t border-slate-300">
      <div className="flex items-center gap-2 px-2 py-1 bg-[#F8FAFC] text-[10.5px]">
        <button type="button" data-seq-evtoggle onClick={() => setOpen(o => !o)} className="flex items-center gap-1 font-bold text-[#475569] hover:text-[#1D4ED8] cursor-pointer">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          근거 원본 Log{title ? ` — ${title}` : ''}
        </button>
        {open ? (
          <>
            <span className="text-[#94A3B8]">{keyOnly ? '동작 행만' : '앞뒤 행 포함'} · 바뀐 칸 노랑</span>
            <button
              type="button"
              data-seq-evrows
              onClick={() => setKeyOnly(k => !k)}
              className="ml-auto px-1.5 rounded border border-slate-300 bg-white text-[10px] font-semibold text-[#2563EB] hover:border-[#2563EB] cursor-pointer"
            >
              {keyOnly ? '앞뒤 행 보기' : '동작 행만 보기'}
            </button>
          </>
        ) : (
          <span className="text-[#94A3B8]">눌러서 펼치기</span>
        )}
      </div>
      {open && (
        <div className="px-2 pb-2 space-y-1.5">
          {list.map((x, i) => (
            <EvidenceTable key={i} ev={x.ev} keyOnly={keyOnly} caption={list.length > 1 ? x.caption : undefined} />
          ))}
        </div>
      )}
    </div>
  );
};

const VTEXT: Record<Verdict, string> = { ok: 'text-[#065F46] bg-[#F0FDF4] border-[#BBF7D0]', warn: 'text-[#92400E] bg-[#FFFBEB] border-[#FDE68A]', fail: 'text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]', na: 'text-[#64748B] bg-slate-50 border-slate-200' };

/** 순서 확인 표 */
const OrderTable: React.FC<{ order: OrderStep[] }> = ({ order }) => {
  const h = 'px-2 py-1 border border-slate-400 bg-[#CBD5E1] text-[10.5px] font-bold text-[#0F172A] whitespace-nowrap text-center';
  const c = 'px-2 py-1 border border-slate-300 text-[11px] text-center whitespace-nowrap';
  return (
    <table data-seq-order className="w-full border-collapse">
      <thead>
        <tr>
          <th className={`${h} w-[44px]`}>순서</th>
          <th className={h}>기대 동작</th>
          <th className={h}>실제 시점 (경계 기준)</th>
          <th className={h}>Log 행</th>
          <th className={h}>확인</th>
        </tr>
      </thead>
      <tbody>
        {order.map((o, i) => (
          <tr key={i} className="bg-white">
            <td className={c}>
              <span className="inline-flex w-4 h-4 rounded-full bg-[#1E3A8A] text-white text-[10px] font-bold items-center justify-center">{i + 1}</span>
            </td>
            <td className={`${c} !text-left font-bold text-[#0F172A]`}>{o.label}</td>
            <td className={`${c} font-bold text-[#2563EB] tabular-nums`}>{o.t}</td>
            <td className={`${c} tabular-nums text-[#334155]`}>{o.rows}</td>
            <td className={`${c} !text-left`}>
              <span className="inline-flex items-center gap-1.5">
                <VerdictBadge v={o.verdict} compact />
                {o.note && <span className="text-[10.5px] text-[#64748B]">{o.note}</span>}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/** 결론 띠 (항목별 한 줄) */
const ResultLines: React.FC<{ items: CheckItem[] }> = ({ items }) => (
  <div>
    {items.map((it, k) => (
      <div key={k} data-seq-item={it.verdict} className={`flex items-start gap-1.5 px-2 py-1 border-t text-[11px] font-bold ${VTEXT[it.verdict]}`}>
        <VerdictBadge v={it.verdict} compact />
        <span className="pt-[2px]">{it.text}</span>
      </div>
    ))}
  </div>
);

/** 모아 보기 표 칸 정의 (BB Mode · RSD) */
const AGG_COLS: Partial<Record<CheckKind, { key: string; title: string; sub?: string; empty: string }[]>> = {
  bb: [
    { key: 'bbRf', title: 'RF 이어짐', sub: '경계 −0.5 ~ +0.6 s 모두 RF On', empty: '–' },
    { key: 'bbPress', title: '압력 제어 유지', empty: '–' },
    { key: 'bbSet', title: '다음 Step 동시 Set', sub: '0.35 s 안', empty: '– (Set 변화 없음)' },
  ],
  rsd: [{ key: 'rsdHold', title: 'RSD 유지 → RF Off', sub: '0.5 s 이상 유지', empty: '–' }],
};

/** BB Mode · RSD: 경계를 한 표로 모으고, 고른 경계의 근거 Log만 아래에 */
const AggTable: React.FC<{ kind: CheckKind; groups: { b: BoundaryCheck; items: CheckItem[] }[]; showLog: boolean }> = ({ kind, groups, showLog }) => {
  const cols = AGG_COLS[kind]!;
  const [sel, setSel] = useState<number>(showLog ? 0 : -1);
  const h = 'px-2 py-1 border border-slate-400 bg-[#CBD5E1] text-[10.5px] font-bold text-[#0F172A] text-center';
  const c = 'px-2 py-1 border border-slate-300 text-[11px] text-center whitespace-nowrap';
  const rangeOf = (items: CheckItem[]) => {
    const nos = items.flatMap(it => it.evidence?.rows.filter(r => !r.gap).map(r => r.rowNo as number) ?? []);
    return nos.length ? `행 ${Math.min(...nos)} ~ ${Math.max(...nos)}` : '-';
  };
  const cur = sel >= 0 ? groups[sel] : null;
  return (
    <div className="border border-slate-400 rounded-md overflow-hidden" data-seq-agg={kind}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${h} text-left w-[240px]`}>경계</th>
              {cols.map(col => (
                <th key={col.key} className={h}>
                  {col.title}
                  {col.sub && <div className="text-[9.5px] font-normal text-[#475569]">({col.sub})</div>}
                </th>
              ))}
              <th className={`${h} w-[90px]`}>판정</th>
              <th className={`${h} w-[150px]`}>근거 Log</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ b, items }, gi) => {
              const none = items.find(it => it.check === 'bbNone');
              return (
                <tr key={gi} data-seq-boundary className={gi === sel ? 'bg-[#EFF6FF]' : 'bg-white'}>
                  <td className={`${c} !text-left font-bold text-[#0F172A]`}>{b.title}</td>
                  {none ? (
                    <td colSpan={cols.length} className={`${c} text-[#92400E]`} data-seq-item={none.verdict}>
                      ⚠ {none.text}
                    </td>
                  ) : (
                    cols.map(col => {
                      const it = items.find(x => x.check === col.key);
                      return (
                        <td key={col.key} className={c} title={it?.text} data-seq-item={it?.verdict}>
                          {it ? (
                            <span className="inline-flex items-center gap-1.5">
                              <VerdictBadge v={it.verdict} compact />
                              <span className="text-[#334155] font-semibold">{it.short || it.text}</span>
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">{items.some(x => x.check === 'bbPress') ? col.empty : '–'}</span>
                          )}
                        </td>
                      );
                    })
                  )}
                  <td className={c}>
                    <VerdictBadge v={worst(...items.map(it => it.verdict))} />
                  </td>
                  <td className={c}>
                    {items.some(it => it.evidence) ? (
                      <button
                        type="button"
                        data-seq-aggev
                        onClick={() => setSel(s => (s === gi ? -1 : gi))}
                        className={`text-[10.5px] font-semibold underline cursor-pointer ${gi === sel ? 'text-[#1D4ED8]' : 'text-[#2563EB] hover:text-[#1D4ED8]'}`}
                      >
                        {rangeOf(items)} {gi === sel ? '▴' : '▾'}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cur && <EvidenceBlock key={sel} list={evidencesOf(cur.items)} defaultOpen defaultKeyOnly={kind !== 'bb'} title={cur.b.title} />}
    </div>
  );
};

/** Sequence · Specific Gas: 경계 카드 (순서 확인 표 + 결론 + 근거) */
const BoundaryCard: React.FC<{ kind: CheckKind; b: BoundaryCheck; items: CheckItem[]; showLog: boolean }> = ({ kind, b, items, showLog }) => {
  const order = b.order?.[kind];
  return (
    <div data-seq-boundary className="border border-slate-400 rounded-md overflow-hidden bg-white">
      <div className="px-2 py-1.5 bg-[#E2E8F0] border-b border-slate-400 flex flex-wrap items-center gap-2">
        <VerdictBadge v={worst(...items.map(it => it.verdict))} />
        <span className="text-[11.5px] font-bold text-[#0F172A]">{b.title}</span>
        <span className="ml-auto text-[10.5px] font-semibold text-[#334155] bg-white border border-slate-400 rounded px-1.5">{b.setting}</span>
      </div>
      {order && order.length > 0 && <OrderTable order={order} />}
      <ResultLines items={items} />
      <EvidenceBlock key={String(showLog)} list={evidencesOf(items)} defaultOpen={showLog} defaultKeyOnly />
    </div>
  );
};

/** 판정 표시 (정상 / 확인 필요 / 미적용 / 해당 없음) */
const V_STYLE: Record<Verdict, { icon: string; label: string; cls: string }> = {
  ok: { icon: '✔', label: '정상', cls: 'bg-[#DCFCE7] text-[#047857] border-[#86EFAC]' },
  warn: { icon: '⚠', label: '확인 필요', cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]' },
  fail: { icon: '✖', label: '미적용', cls: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]' },
  na: { icon: '–', label: '해당 없음', cls: 'bg-slate-50 text-[#94A3B8] border-slate-200' },
};
const KIND_LABEL: Record<CheckKind, string> = { sequence: 'Sequence', bb: 'BB Mode', sg: 'Specific Gas', rsd: 'RSD' };
const KINDS: CheckKind[] = ['sequence', 'bb', 'sg', 'rsd'];
/** 구역별: 무엇을 판별하는지 */
const KIND_INFO: Record<CheckKind, { desc: string; none: string; border: string; head: string; dot: string }> = {
  sequence: {
    desc: 'Gas · 압력 제어 · RF를 켜고 끄는 순서 (공정 시작 / BB 꺼진 Step 경계 / 공정 끝)',
    none: '판정할 경계가 없습니다',
    border: 'border-[#93C5FD]',
    head: 'bg-[#DBEAFE]',
    dot: 'bg-[#2563EB]',
  },
  bb: {
    desc: 'BB Mode 켜진 Step 경계에서 RF가 꺼지지 않고 이어지는지 · 압력 제어 유지 · 다음 Step 동시 Set',
    none: 'BB Mode가 켜진 Step 경계가 없어 해당 없음',
    border: 'border-[#C4B5FD]',
    head: 'bg-[#EDE9FE]',
    dot: 'bg-[#7C3AED]',
  },
  sg: {
    desc: 'Specific Gas 켜진 Step 끝에서 SiH4 Off와 RF RSD Down이 함께 일어나는지 (꺼짐이면 SiH4가 RF Off까지 유지되는지)',
    none: 'SiH4를 쓰는 Depo Step 끝이 없어 해당 없음',
    border: 'border-[#5EEAD4]',
    head: 'bg-[#CCFBF1]',
    dot: 'bg-[#0D9488]',
  },
  rsd: {
    desc: 'RF를 RSD 값으로 낮춘 뒤 충분히 유지하고 RF Off 하는지',
    none: 'Specific Gas가 켜진 Step 끝에서 RSD 동작을 확인한 곳이 없어 해당 없음',
    border: 'border-[#FCD34D]',
    head: 'bg-[#FEF3C7]',
    dot: 'bg-[#D97706]',
  },
};

export const VerdictBadge: React.FC<{ v: Verdict; compact?: boolean }> = ({ v, compact }) => (
  <span
    data-verdict={v}
    className={`inline-flex items-center gap-1 px-1.5 h-[20px] rounded-md border text-[10.5px] font-bold whitespace-nowrap ${V_STYLE[v].cls}`}
  >
    <span>{V_STYLE[v].icon}</span>
    {!compact && V_STYLE[v].label}
  </span>
);

/** 켜진 Step 묶음: 연속된 Step은 하나로 → [{text: 'Step 10~12 (PL2~PL4)', tip}] */
type OnGroup = { text: string; tip: string };
const onSteps = (r: SequenceReport, key: 'sg' | 'bb'): OnGroup[] | null => {
  if (key === 'sg' ? !r.hasSgCol : !r.hasBbCol) return null; // Log에 설정 열 없음
  const groups: StepSetting[][] = [];
  r.settings.forEach(st => {
    if (!st[key]) return;
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1].step === st.step - 1) last.push(st);
    else groups.push([st]);
  });
  const label = key === 'sg' ? 'Specific Gas' : 'BB Mode';
  return groups.map(g => {
    const a = g[0];
    const b = g[g.length - 1];
    const nm = (x: StepSetting) => x.name || '-';
    return {
      text: g.length > 1 ? `Step ${a.step}~${b.step} (${nm(a)}~${nm(b)})` : `Step ${a.step} (${nm(a)})`,
      tip: g.map(x => `Step ${x.step} ${nm(x)}: Log의 ${label} 설정 = 켜짐`).join('\n'),
    };
  });
};
const onStepsText = (r: SequenceReport, key: 'sg' | 'bb') => {
  const g = onSteps(r, key);
  return g === null ? 'Log에 열 없음' : g.length ? g.map(x => x.text).join(', ') : '없음';
};

export const SequenceCheckPanel: React.FC<{
  results: AnalysisFileResult[];
  files: ParsedLogFile[];
  selectedRunIdx: number | null;
  onSelectRunIdx?: (idx: number | null) => void;
}> = ({ results, files, selectedRunIdx, onSelectRunIdx }) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(true);

  const reports = useMemo(
    () =>
      files.map((f, i) => {
        const depo = results.filter(r => r.fileId === f.id).map(r => r.depoStep);
        const rcp = results.find(r => r.fileId === f.id)?.rcpName || f.meta.recipeName || f.fileName;
        let report: SequenceReport | null = null;
        try {
          report = depo.length ? checkSequence(f, depo) : null;
        } catch {
          report = null;
        }
        return { file: f, no: i + 1, rcp, report };
      }),
    [files, results],
  );
  const selectedFileId = selectedRunIdx !== null ? results[selectedRunIdx]?.fileId : null;
  const toggle = (id: string) => setOpen(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const allOpen = reports.every(x => !x.report || open.includes(x.file.id));

  const handleCopy = async () => {
    const headers = ['No.', 'Recipe', 'Specific Gas 켜진 Step', 'BB Mode 켜진 Step', 'Sequence', 'BB Mode', 'Specific Gas', 'RSD', '경계', '항목', '판정', '내용'];
    const rows: (string | number)[][] = [];
    reports.forEach(({ no, rcp, report }) => {
      if (!report) return;
      const head = [no, rcp, onStepsText(report, 'sg'), onStepsText(report, 'bb'), ...KINDS.map(k => V_STYLE[report.summary[k]].label)];
      report.boundaries.forEach(b =>
        b.items.forEach(it => rows.push([...head, b.title, KIND_LABEL[it.kind], V_STYLE[it.verdict].label, it.text])),
      );
    });
    if (await copyTableToClipboard(headers, rows)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const th = 'px-2 py-1.5 border border-slate-400 text-[11px] font-bold text-[#0F172A] bg-[#DDE3EA] whitespace-nowrap';
  const td = 'px-2 py-1 border border-slate-300 text-[11px] align-middle';

  return (
    <section data-seq-check className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow}`}>
      <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-[#0D9488] shadow-xs" />
          <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>[Sequence 판정] BB Mode · Specific Gas 적용 여부</h3>
          <span className="text-[11px] text-[#475569] font-medium whitespace-nowrap">(Log의 Step별 설정 기준 · 줄을 누르면 경계별 상세)</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#334155] cursor-pointer select-none whitespace-nowrap">
            <input type="checkbox" data-seq-showlog checked={showLog} onChange={e => setShowLog(e.target.checked)} className="accent-[#0D9488]" />
            근거 원본 Log 표시
          </label>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? [] : reports.filter(x => x.report).map(x => x.file.id))}
            className={`px-2.5 py-1.5 text-xs font-semibold ${theme.btnSecondary} rounded-xl shadow-xs cursor-pointer`}
          >
            {allOpen ? '모두 접기' : '모두 펼치기'}
          </button>
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
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr>
              <th className={`${th} w-[34px]`} />
              <th className={`${th} w-[46px]`}>No.</th>
              <th className={`${th} text-left`}>Recipe</th>
              <th className={`${th} text-left`} title="Log의 Step별 'Specific Gas' 설정 열에서 켜짐(Enable/True)인 Step">Specific Gas 켜진 Step</th>
              <th className={`${th} text-left`} title="Log의 Step별 'RF BB.mode' 설정 열에서 켜짐(Enable/True)인 Step">BB Mode 켜진 Step</th>
              {KINDS.map(k => (
                <th key={k} className={`${th} w-[110px]`}>
                  {KIND_LABEL[k]}
                </th>
              ))}
              <th className={`${th} w-[110px]`}>종합</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(({ file, no, rcp, report }) => {
              const isOpen = open.includes(file.id);
              const sel = selectedFileId === file.id;
              const total = report ? worst(...KINDS.map(k => report.summary[k])) : 'na';
              return (
                <React.Fragment key={file.id}>
                  <tr
                    data-seq-row={no}
                    onClick={() => {
                      if (!report) return;
                      toggle(file.id);
                      const ri = results.findIndex(r => r.fileId === file.id);
                      if (ri >= 0) onSelectRunIdx?.(ri);
                    }}
                    className={`cursor-pointer transition-colors ${sel ? 'bg-[#DBEAFE]' : 'bg-white hover:bg-[#F1F5F9]'}`}
                  >
                    <td className={`${td} text-center text-[#64748B]`}>
                      {report ? isOpen ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronRight className="w-3.5 h-3.5 inline" /> : null}
                    </td>
                    <td className={`${td} text-center font-bold tabular-nums`}>{no}</td>
                    <td className={`${td} font-bold text-[#0F172A] whitespace-nowrap`}>{rcp}</td>
                    {(['sg', 'bb'] as const).map(key => {
                      const g = report ? onSteps(report, key) : undefined;
                      const chip = key === 'sg' ? 'bg-[#CCFBF1] text-[#0F766E] border-[#5EEAD4]' : 'bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]';
                      return (
                        <td key={key} data-seq-on={key} className={`${td}`}>
                          {!report ? (
                            <span className="text-[10.5px] text-[#94A3B8]">Depo Step 없음</span>
                          ) : g === null ? (
                            <span className="px-1.5 rounded border border-[#FCD34D] text-[10.5px] font-bold bg-[#FEF3C7] text-[#92400E]" title="이 Log에는 이 설정 열이 없어 Step별 설정을 알 수 없습니다">
                              ⚠ Log에 열 없음
                            </span>
                          ) : g!.length === 0 ? (
                            <span className="text-[10.5px] text-[#64748B]">없음</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {g!.map(x => (
                                <span key={x.text} title={x.tip} className={`px-1.5 rounded border text-[10.5px] font-bold whitespace-nowrap ${chip}`}>
                                  {x.text}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {KINDS.map(k => (
                      <td key={k} className={`${td} text-center`}>
                        {report ? <VerdictBadge v={report.summary[k]} /> : '-'}
                      </td>
                    ))}
                    <td className={`${td} text-center`}>{report ? <VerdictBadge v={total} /> : '-'}</td>
                  </tr>
                  {isOpen && report && (
                    <tr data-seq-detail={no} data-copy-skip>
                      <td colSpan={10} className="p-2.5 bg-[#EEF2F6] border border-slate-400">
                        <div className="space-y-2.5">
                          {KINDS.map((kind, ki) => {
                            const groups = report.boundaries
                              .map(b => ({ b, items: b.items.filter(it => it.kind === kind) }))
                              .filter(g => g.items.length > 0);
                            const info = KIND_INFO[kind];
                            const agg = !!AGG_COLS[kind];
                            return (
                              <div key={kind} data-seq-kind={kind} className={`rounded-lg border-2 ${info.border} bg-white overflow-hidden`}>
                                <div className={`px-3 py-1.5 ${info.head} border-b ${info.border} flex flex-wrap items-center gap-2`}>
                                  <span className={`w-5 h-5 rounded-full ${info.dot} text-white text-[11px] font-bold flex items-center justify-center`}>{ki + 1}</span>
                                  <span className="text-[13px] font-bold text-[#0F172A]">{KIND_LABEL[kind]}</span>
                                  <VerdictBadge v={report.summary[kind]} />
                                  <span className="text-[11px] text-[#334155] font-medium">{info.desc}</span>
                                </div>
                                {groups.length === 0 ? (
                                  <div className="px-3 py-2 text-[11px] text-[#64748B]">{info.none}</div>
                                ) : agg ? (
                                  <div className="p-2">
                                    <AggTable key={String(showLog)} kind={kind} groups={groups} showLog={showLog} />
                                  </div>
                                ) : (
                                  <div className="p-2 grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">
                                    {groups.map(({ b, items }, i) => (
                                      <BoundaryCard key={i} kind={kind} b={b} items={items} showLog={showLog} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-[10.5px] text-[#94A3B8] flex items-center gap-1">
                          <ListChecks className="w-3 h-3" />
                          시간 = 다음 Step 첫 행 기준 (− 는 경계 전) · 같은 행(0.15초 안)은 '동시' · SiH4 Off와 RF RSD Down은 0.35초 안이면 '함께' · 근거 Log: 파란 행 = 동작이 일어난 행 (마우스 = 시각), 노란 칸 = 바로 앞 행에서 Set·상태 값이 바뀐 칸, ⋯ = 사이 행 생략
                        </p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
