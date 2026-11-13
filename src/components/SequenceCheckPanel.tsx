import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, ListChecks } from 'lucide-react';
import { AnalysisFileResult, ParsedLogFile } from '../types/pecvd';
import { useTheme } from '../context/ThemeContext';
import { copyTableToClipboard } from '../utils/exportUtils';
import { checkSequence, CheckKind, Evidence, SequenceReport, Verdict, worst } from '../utils/sequenceCheck';

/** 판정 근거 원본 Log 행 */
const EvidenceTable: React.FC<{ ev: Evidence }> = ({ ev }) => {
  const h = 'px-1.5 py-[3px] border border-slate-400 bg-[#CBD5E1] text-[10px] font-bold text-[#0F172A] whitespace-nowrap text-center';
  const c = 'px-1.5 py-[2px] border border-slate-300 text-[10px] tabular-nums whitespace-nowrap text-center';
  return (
    <div data-seq-evidence className="mt-1 mb-1 ml-[22px] overflow-x-auto rounded border border-slate-400">
      <table className="border-collapse w-max min-w-full">
        <thead>
          <tr>
            <th className={h}>행</th>
            <th className={h}>동작</th>
            <th className={h}>Time</th>
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
          {ev.rows.map((r, i) =>
            r.gap ? (
              <tr key={i}>
                <td colSpan={ev.cols.length + 5} className="px-1.5 py-0 border border-slate-300 text-center text-[10px] text-[#64748B] leading-[14px] bg-[#F1F5F9]">
                  ⋯
                </td>
              </tr>
            ) : (
              <tr key={i} data-ev-key={r.tag ? '1' : undefined} className={r.tag ? 'bg-[#DBEAFE]' : 'bg-white'}>
                <td className={`${c} text-[#64748B]`}>{r.rowNo}</td>
                <td className={c}>{r.tag && <span className="font-bold text-[#1D4ED8]">▶ {r.tag}</span>}</td>
                <td className={`${c} text-[#475569]`}>{r.time}</td>
                <td className={`${c} text-[#2563EB] font-semibold`}>{r.t === undefined ? '-' : `${r.t >= 0 ? '+' : '−'}${Math.abs(r.t).toFixed(1)}s`}</td>
                <td className={`${c} text-center font-semibold`}>{r.step}</td>
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

/** Step별 설정 요약: 'S6 SG · S10–12 BB' */
const settingChips = (r: SequenceReport) => {
  const groups: { label: string; steps: number[] }[] = [];
  const push = (label: string, s: number) => {
    const g = groups.find(x => x.label === label && x.steps[x.steps.length - 1] === s - 1);
    if (g) g.steps.push(s);
    else groups.push({ label, steps: [s] });
  };
  r.settings.forEach(s => {
    if (s.bb) push('BB', s.step);
    if (s.sg) push('SG', s.step);
  });
  return groups.map(g => `S${g.steps[0]}${g.steps.length > 1 ? `–${g.steps[g.steps.length - 1]}` : ''} ${g.label}`);
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
    const headers = ['No.', 'Recipe', '설정', 'Sequence', 'BB Mode', 'Specific Gas', 'RSD', '경계', '항목', '판정', '내용'];
    const rows: (string | number)[][] = [];
    reports.forEach(({ no, rcp, report }) => {
      if (!report) return;
      const head = [no, rcp, settingChips(report).join(', ') || '-', ...KINDS.map(k => V_STYLE[report.summary[k]].label)];
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
              <th className={`${th} text-left`}>Log 설정 (Step)</th>
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
                    <td className={`${td}`}>
                      {report ? (
                        <span className="flex flex-wrap gap-1">
                          {settingChips(report).map(c => (
                            <span key={c} className={`px-1.5 rounded text-[10px] font-bold ${c.endsWith('BB') ? 'bg-[#EDE9FE] text-[#5B21B6]' : 'bg-[#CCFBF1] text-[#0F766E]'}`}>
                              {c}
                            </span>
                          ))}
                          {settingChips(report).length === 0 && <span className="text-[10.5px] text-[#94A3B8]">모두 꺼짐</span>}
                          {!report.hasSgCol && <span className="px-1.5 rounded text-[10px] font-bold bg-[#FEF3C7] text-[#92400E]">SG 열 없음</span>}
                          {!report.hasBbCol && <span className="px-1.5 rounded text-[10px] font-bold bg-[#FEF3C7] text-[#92400E]">BB 열 없음</span>}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-[#94A3B8]">Depo Step 없음</span>
                      )}
                    </td>
                    {KINDS.map(k => (
                      <td key={k} className={`${td} text-center`}>
                        {report ? <VerdictBadge v={report.summary[k]} /> : '-'}
                      </td>
                    ))}
                    <td className={`${td} text-center`}>{report ? <VerdictBadge v={total} /> : '-'}</td>
                  </tr>
                  {isOpen && report && (
                    <tr data-seq-detail={no} data-copy-skip>
                      <td colSpan={9} className="p-2.5 bg-[#EEF2F6] border border-slate-400">
                        <div className="space-y-2.5">
                          {KINDS.map((kind, ki) => {
                            const groups = report.boundaries
                              .map(b => ({ b, items: b.items.filter(it => it.kind === kind) }))
                              .filter(g => g.items.length > 0);
                            const info = KIND_INFO[kind];
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
                                ) : (
                                  <div className="p-2 grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">
                                    {groups.map(({ b, items }, i) => (
                                      <div key={i} data-seq-boundary className="border border-slate-400 rounded-md overflow-hidden">
                                        <div className="px-2 py-1.5 bg-[#E2E8F0] border-b border-slate-400 flex flex-wrap items-center gap-2">
                                          <VerdictBadge v={worst(...items.map(it => it.verdict))} />
                                          <span className="text-[11.5px] font-bold text-[#0F172A]">{b.title}</span>
                                          <span className="ml-auto text-[10.5px] font-semibold text-[#334155] bg-white border border-slate-400 rounded px-1.5">{b.setting}</span>
                                        </div>
                                        <div className="px-2 py-1.5 space-y-1.5 text-[11px]">
                                          {(kind === 'sequence' || kind === 'sg') && (
                                            <>
                                              <div className="flex flex-wrap items-center gap-1">
                                                <span className="text-[10.5px] font-bold text-[#475569] w-[40px] shrink-0">기대</span>
                                                {b.expected.map((e, k) => (
                                                  <span key={k} className="flex items-center gap-1">
                                                    {k > 0 && <span className="text-[#94A3B8]">→</span>}
                                                    <span className="px-1.5 rounded bg-slate-100 border border-slate-300 text-[#334155] font-semibold">{e}</span>
                                                  </span>
                                                ))}
                                              </div>
                                              {b.events.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1">
                                                  <span className="text-[10.5px] font-bold text-[#475569] w-[40px] shrink-0">실제</span>
                                                  {b.events.map((e, k) => (
                                                    <span key={k} className="flex items-center gap-1">
                                                      {k > 0 && <span className="text-[#94A3B8]">→</span>}
                                                      <span className="px-1.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E3A8A] font-semibold whitespace-nowrap">
                                                        {e.label}
                                                        <span className="ml-1 tabular-nums text-[10px] text-[#2563EB]">{e.t === null ? '-' : `${e.t >= 0 ? '+' : '−'}${Math.abs(e.t).toFixed(1)}s`}</span>
                                                      </span>
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </>
                                          )}
                                          <ul className="space-y-1 pt-0.5">
                                            {items.map((it, k) => {
                                              // 같은 근거를 쓰는 항목이 이어지면 표는 마지막 항목 아래에 한 번만
                                              const showEv = showLog && it.evidence && items[k + 1]?.evidence !== it.evidence;
                                              return (
                                                <li key={k} data-seq-item={it.verdict}>
                                                  <div className="flex items-start gap-1.5">
                                                    <VerdictBadge v={it.verdict} compact />
                                                    <span className="text-[#0F172A] font-semibold pt-[2px]">{it.text}</span>
                                                  </div>
                                                  {showEv && <EvidenceTable ev={it.evidence!} />}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-[10.5px] text-[#94A3B8] flex items-center gap-1">
                          <ListChecks className="w-3 h-3" />
                          시간 = 다음 Step 첫 행 기준 (− 는 경계 전) · 같은 행(0.15초 안)은 '동시' · SiH4 Off와 RF RSD Down은 0.35초 안이면 '함께' · 근거 Log: 파란 행 = 동작이 일어난 행, 노란 칸 = 바로 앞 행에서 Set·상태 값이 바뀐 칸, ⋯ = 사이 행 생략
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
