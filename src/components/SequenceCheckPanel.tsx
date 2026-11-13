import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, ListChecks } from 'lucide-react';
import { AnalysisFileResult, ParsedLogFile } from '../types/pecvd';
import { useTheme } from '../context/ThemeContext';
import { copyTableToClipboard } from '../utils/exportUtils';
import { checkSequence, CheckKind, SequenceReport, Verdict, worst } from '../utils/sequenceCheck';

/** 판정 표시 (정상 / 확인 필요 / 미적용 / 해당 없음) */
const V_STYLE: Record<Verdict, { icon: string; label: string; cls: string }> = {
  ok: { icon: '✔', label: '정상', cls: 'bg-[#DCFCE7] text-[#047857] border-[#86EFAC]' },
  warn: { icon: '⚠', label: '확인 필요', cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]' },
  fail: { icon: '✖', label: '미적용', cls: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]' },
  na: { icon: '–', label: '해당 없음', cls: 'bg-slate-50 text-[#94A3B8] border-slate-200' },
};
const KIND_LABEL: Record<CheckKind, string> = { sequence: 'Sequence', bb: 'BB Mode', sg: 'Specific Gas', rsd: 'RSD' };
const KINDS: CheckKind[] = ['sequence', 'bb', 'sg', 'rsd'];

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
                    <tr data-seq-detail={no}>
                      <td colSpan={9} className="p-2 bg-[#F8FAFC] border border-slate-300">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">
                          {report.boundaries.map((b, i) => (
                            <div key={i} data-seq-boundary className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                              <div className="px-2 py-1.5 bg-[#F1F5F9] border-b border-slate-200 flex flex-wrap items-center gap-2">
                                <VerdictBadge v={b.verdict} />
                                <span className="text-[11.5px] font-bold text-[#0F172A]">{b.title}</span>
                                <span className="ml-auto text-[10.5px] font-semibold text-[#475569] bg-white border border-slate-200 rounded px-1.5">{b.setting}</span>
                              </div>
                              <div className="px-2 py-1.5 space-y-1.5 text-[11px]">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10.5px] font-bold text-[#64748B] w-[40px] shrink-0">기대</span>
                                  {b.expected.map((e, k) => (
                                    <span key={k} className="flex items-center gap-1">
                                      {k > 0 && <span className="text-[#CBD5E1]">→</span>}
                                      <span className="px-1.5 rounded bg-slate-100 text-[#334155] font-semibold">{e}</span>
                                    </span>
                                  ))}
                                </div>
                                {b.events.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="text-[10.5px] font-bold text-[#64748B] w-[40px] shrink-0">실제</span>
                                    {b.events.map((e, k) => (
                                      <span key={k} className="flex items-center gap-1">
                                        {k > 0 && <span className="text-[#CBD5E1]">→</span>}
                                        <span className="px-1.5 rounded bg-[#EFF6FF] text-[#1E3A8A] font-semibold whitespace-nowrap">
                                          {e.label}
                                          <span className="ml-1 tabular-nums text-[10px] text-[#2563EB]">{e.t === null ? '-' : `${e.t >= 0 ? '+' : '−'}${Math.abs(e.t).toFixed(1)}s`}</span>
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <ul className="space-y-0.5 pt-0.5">
                                  {b.items.map((it, k) => (
                                    <li key={k} data-seq-item={it.verdict} className="flex items-start gap-1.5">
                                      <VerdictBadge v={it.verdict} compact />
                                      <span className="text-[10px] font-bold text-[#64748B] w-[72px] shrink-0 pt-[3px]">{KIND_LABEL[it.kind]}</span>
                                      <span className="text-[#0F172A] pt-[2px]">{it.text}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[10.5px] text-[#94A3B8] flex items-center gap-1">
                          <ListChecks className="w-3 h-3" />
                          시간 = 다음 Step 첫 행 기준 (− 는 경계 전) · 같은 행(0.15초 안)은 '동시' · SiH4 Off와 RF RSD Down은 0.35초 안이면 '함께'
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
