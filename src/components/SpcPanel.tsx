import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CopyImageButton } from './CopyImageButton';
import { Activity, Check, Copy, Info } from 'lucide-react';
import { AnalysisFileResult, ParsedLogFile } from '../types/pecvd';
import { useTheme } from '../context/ThemeContext';
import { copyTableToClipboard } from '../utils/exportUtils';
import {
  buildSpcGroups,
  buildSpcRuns,
  computeSpcChart,
  fmtSpc,
  readMetric,
  SPC_DEFAULT_METRICS,
  SPC_METRICS,
  SPC_MIN_POINTS,
  SPC_RULE_LABEL,
  SPC_RUN_LENGTH,
  SpcChart,
  SpcRule,
} from '../utils/spc';

/** 판정 규칙별 색 (점 · 배지) */
const RULE_COLOR: Record<SpcRule, string> = {
  beyond: '#DC2626', // 관리선 밖: 빨강
  side: '#D97706', // 7점 연속 한쪽: 주황
  trend: '#7C3AED', // 7점 연속 상승·하강: 보라
};
const RULE_ORDER: SpcRule[] = ['beyond', 'trend', 'side'];

const ALL_GROUPS = '__all__';

interface SpcPanelProps {
  results: AnalysisFileResult[];
  files: ParsedLogFile[];
  selectedRunIdx: number | null;
  onSelectRunIdx?: (idx: number | null) => void;
}

/** 보기 좋은 눈금 (4~6개) */
const niceTicks = (lo: number, hi: number, count = 5): number[] => {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
};

/** 관리선 값은 값보다 한 자리 더 (예: 값 59.5 · UCL 59.47 → 초과 여부가 보이게) */
const limDigits = (d: number) => Math.min(3, d + 1);

/** 점 색: 규칙 우선순위(관리선 밖 > 상승·하강 > 한쪽) */
const pointColor = (rules: SpcRule[]) => {
  for (const r of RULE_ORDER) if (rules.includes(r)) return RULE_COLOR[r];
  return '#334155';
};

/* ------------------------------------------------------------------ */
/* 관리도 한 장 (SVG)                                                   */
/* ------------------------------------------------------------------ */
const SpcChartView: React.FC<{
  chart: SpcChart;
  selectedResultIdx: number | null;
  onPick: (resultIdx: number) => void;
}> = ({ chart, selectedResultIdx, onPick }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const { metric, points, cl, ucl, lcl } = chart;
  const H = 210;
  const padL = 54;
  const padR = 62;
  const padT = 16;
  const padB = 30;
  const plotW = Math.max(40, width - padL - padR);
  const plotH = H - padT - padB;
  const n = points.length;
  const innerX = n > 1 ? 10 : 0;
  const xOf = (x: number) => (n > 1 ? padL + innerX + ((plotW - innerX * 2) * x) / (n - 1) : padL + plotW / 2);

  // 세로 범위: 값 + 관리선 모두 보이게
  const vals = points.map(p => p.value).filter((v): v is number => v !== null);
  const bounds = [...vals, ...(cl !== null ? [cl, ucl as number, lcl as number] : [])];
  let yLo = bounds.length ? Math.min(...bounds) : 0;
  let yHi = bounds.length ? Math.max(...bounds) : 1;
  if (yHi - yLo < 1e-9) {
    const d = Math.abs(yHi) * 0.1 || 1;
    yLo -= d;
    yHi += d;
  } else {
    const m = (yHi - yLo) * 0.08;
    yLo -= m;
    yHi += m;
  }
  const yOf = (v: number) => padT + plotH - ((v - yLo) / (yHi - yLo)) * plotH;
  const ticks = niceTicks(yLo, yHi, 4);

  // 가로 이름: 글자 길이에 맞춰 겹치지 않게 건너뛰며 표시
  const maxLabelLen = Math.max(1, ...points.map(p => `#${p.run.result.displayNo || p.run.result.no}`.length));
  const slotW = maxLabelLen * 6 + 10;
  const stepW = n > 1 ? (plotW - innerX * 2) / (n - 1) : plotW;
  const labelEvery = Math.max(1, Math.ceil(slotW / Math.max(1, stepW)));

  // 선: 값 없는 Run에서 끊김
  const pathParts: string[] = [];
  let pen = false;
  points.forEach(p => {
    if (p.value === null) {
      pen = false;
      return;
    }
    pathParts.push(`${pen ? 'L' : 'M'}${xOf(p.x).toFixed(1)},${yOf(p.value).toFixed(1)}`);
    pen = true;
  });

  // 기준 구간 경계 (기준이 전체가 아닐 때)
  const valued = points.filter(p => p.value !== null);
  const baseEndX = chart.baseN < chart.n && chart.cl !== null ? valued[chart.baseN - 1]?.x : undefined;
  const baseLineX = baseEndX !== undefined ? (xOf(baseEndX) + xOf(Math.min(n - 1, baseEndX + 1))) / 2 : undefined;

  // 관리선 이름(UCL·CL·LCL): σ=0이면 CL만, 가까우면 위아래로 벌려 겹치지 않게
  const limitLabels: { y: number; text: string; color: string }[] = [];
  if (cl !== null && ucl !== null && lcl !== null) {
    const flat = Math.abs(ucl - lcl) < 1e-12;
    const raw = flat
      ? [{ y: yOf(cl), text: 'CL', color: '#059669' }]
      : [
          { y: yOf(ucl), text: 'UCL', color: '#DC2626' },
          { y: yOf(cl), text: 'CL', color: '#059669' },
          { y: yOf(lcl), text: 'LCL', color: '#DC2626' },
        ];
    const GAP = 11;
    // 가운데(CL) 기준으로 위·아래 이름을 밀어냄
    if (raw.length === 3) {
      raw[0].y = Math.min(raw[0].y, raw[1].y - GAP);
      raw[2].y = Math.max(raw[2].y, raw[1].y + GAP);
    }
    limitLabels.push(...raw);
  }

  const hp = hover !== null ? points[hover] : null;
  const lineLabel = (y: number, text: string, color: string) => (
    <text x={padL + plotW + 4} y={y + 3.5} fontSize={10} fontWeight={700} fill={color}>
      {text}
    </text>
  );

  return (
    <div ref={wrapRef} className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={H} className="block" role="img" aria-label={`${metric.name} 관리도`}>
        {/* 기준 구간 배경 */}
        {baseLineX !== undefined && (
          <>
            <rect x={padL} y={padT} width={baseLineX - padL} height={plotH} fill="#EFF6FF" />
            <line x1={baseLineX} x2={baseLineX} y1={padT} y2={padT + plotH} stroke="#93C5FD" strokeDasharray="3 3" />
            <text x={padL + 2} y={padT - 4} fontSize={9.5} fontWeight={700} fill="#2563EB">
              기준 구간
            </text>
          </>
        )}
        {/* 눈금 */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={padL + plotW} y1={yOf(t)} y2={yOf(t)} stroke="#E2E8F0" />
            <text x={padL - 6} y={yOf(t) + 3.5} fontSize={10} textAnchor="end" fill="#64748B">
              {fmtSpc(t, Math.max(0, Math.min(metric.digits, 2)))}
            </text>
          </g>
        ))}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="#CBD5E1" />

        {/* 관리선 */}
        {cl !== null && ucl !== null && lcl !== null && (
          <>
            <line x1={padL} x2={padL + plotW} y1={yOf(ucl)} y2={yOf(ucl)} stroke="#DC2626" strokeWidth={1.2} strokeDasharray="5 4" />
            <line x1={padL} x2={padL + plotW} y1={yOf(lcl)} y2={yOf(lcl)} stroke="#DC2626" strokeWidth={1.2} strokeDasharray="5 4" />
            <line x1={padL} x2={padL + plotW} y1={yOf(cl)} y2={yOf(cl)} stroke="#059669" strokeWidth={1.4} />
            {limitLabels.map(l => (
              <React.Fragment key={l.text}>{lineLabel(l.y, l.text, l.color)}</React.Fragment>
            ))}
          </>
        )}

        {/* 값 선 */}
        {pathParts.length > 0 && <path d={pathParts.join(' ')} fill="none" stroke="#64748B" strokeWidth={1.3} />}

        {/* 가로 이름 */}
        {points.map(p =>
          p.x % labelEvery === 0 || p.x === n - 1 ? (
            <text key={`lb${p.x}`} x={xOf(p.x)} y={H - padB + 14} fontSize={9.5} textAnchor="middle" fill="#475569">
              #{p.run.result.displayNo || p.run.result.no}
            </text>
          ) : null,
        )}
        <text x={padL + plotW / 2} y={H - 3} fontSize={9.5} textAnchor="middle" fill="#94A3B8">
          Run (시간 순)
        </text>

        {/* 점 */}
        {points.map(p => {
          if (p.value === null) return null;
          const cx = xOf(p.x);
          const cy = yOf(p.value);
          const sel = p.run.resultIdx === selectedResultIdx;
          const col = pointColor(p.rules);
          return (
            <g key={`pt${p.x}`}>
              {sel && <circle cx={cx} cy={cy} r={7.5} fill="none" stroke="#2563EB" strokeWidth={2} />}
              {hover === p.x && <circle cx={cx} cy={cy} r={6.5} fill={col} opacity={0.18} />}
              <circle cx={cx} cy={cy} r={p.rules.length ? 4.2 : 3.4} fill={p.rules.length ? col : '#FFFFFF'} stroke={col} strokeWidth={1.6} />
              <circle
                data-spc-point={p.run.result.displayNo}
                data-spc-rules={p.rules.join(",")}
                data-spc-value={p.value}
                cx={cx}
                cy={cy}
                r={10}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHover(p.x)}
                onClick={() => onPick(p.run.resultIdx)}
              />
            </g>
          );
        })}
      </svg>

      {/* 값 상자 (마우스 올림) */}
      {hp && hp.value !== null && (
        <div
          className="absolute z-10 pointer-events-none bg-white border border-slate-300 rounded-lg shadow-md px-2 py-1.5 text-[10.5px] leading-snug whitespace-nowrap"
          style={{
            left: Math.min(Math.max(4, xOf(hp.x) + 10), width - 200),
            top: Math.max(0, yOf(hp.value) - 64),
          }}
        >
          <div className="font-bold text-[#0F172A]">
            #{hp.run.result.displayNo} {hp.run.result.processData?.rcpName || hp.run.result.rcpName}
          </div>
          <div className="text-[#64748B]">{hp.run.startLabel}</div>
          <div className="font-bold text-[#0F172A] tabular-nums">
            {metric.name}: {fmtSpc(hp.value, metric.digits)} {metric.unit}
          </div>
          {hp.rules.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {RULE_ORDER.filter(r => hp.rules.includes(r)).map(r => (
                <span key={r} className="px-1 rounded text-white font-bold" style={{ backgroundColor: RULE_COLOR[r] }}>
                  {SPC_RULE_LABEL[r]}
                </span>
              ))}
            </div>
          ) : chart.cl !== null ? (
            <div className="text-[#059669] font-semibold">정상 범위</div>
          ) : null}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 패널                                                                 */
/* ------------------------------------------------------------------ */
export const SpcPanel: React.FC<SpcPanelProps> = ({ results, files, selectedRunIdx, onSelectRunIdx }) => {
  const { theme } = useTheme();
  const [metricIds, setMetricIds] = useState<string[]>(SPC_DEFAULT_METRICS);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [baseCount, setBaseCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const allRuns = useMemo(() => buildSpcRuns(results, files), [results, files]);
  const groups = useMemo(() => buildSpcGroups(allRuns), [allRuns]);

  // 대상 Recipe 기본값: Run이 가장 많은 Recipe·Layer (그 묶음이 3개 미만이면 전체)
  const defaultGroup = groups.length > 1 && groups[0].count >= SPC_MIN_POINTS ? groups[0].key : ALL_GROUPS;
  const activeGroup = groupKey !== null && (groupKey === ALL_GROUPS || groups.some(g => g.key === groupKey)) ? groupKey : defaultGroup;
  const runs = useMemo(
    () => (activeGroup === ALL_GROUPS ? allRuns : allRuns.filter(r => r.groupKey === activeGroup)),
    [allRuns, activeGroup],
  );
  const mixed = activeGroup === ALL_GROUPS && groups.length > 1;

  // 기준 구간 선택지: 처음 5·10·20개 (Run 수보다 작은 것만)
  const baseOptions = [5, 10, 20].filter(k => k >= SPC_MIN_POINTS && k < runs.length);
  const effBase = baseOptions.includes(baseCount) ? baseCount : 0;

  const charts = useMemo(
    () =>
      metricIds
        .map(id => SPC_METRICS.find(m => m.id === id))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map(m => computeSpcChart(m, runs, effBase)),
    [metricIds, runs, effBase],
  );

  // 항목 칩: 위반 개수 · 값 유무 (현재 대상 Run 기준)
  const chipInfo = useMemo(() => {
    const info: Record<string, { flagged: number; hasValue: boolean }> = {};
    SPC_METRICS.forEach(m => {
      const c = computeSpcChart(m, runs, effBase);
      info[m.id] = { flagged: c.flagged, hasValue: c.n > 0 };
    });
    return info;
  }, [runs, effBase]);

  const toggleMetric = (id: string) =>
    setMetricIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].sort((a, b) => SPC_METRICS.findIndex(m => m.id === a) - SPC_METRICS.findIndex(m => m.id === b))));

  const pick = (resultIdx: number) => onSelectRunIdx?.(selectedRunIdx === resultIdx ? null : resultIdx);

  const handleCopy = async () => {
    const headers = ['No.', 'Recipe', 'Layer', '시작 시각', ...charts.map(c => `${c.metric.name} (${c.metric.unit})`), '판정'];
    const rows: (string | number | null)[][] = runs.map(run => {
      const judge = charts
        .map(c => {
          const p = c.points.find(pt => pt.run.resultIdx === run.resultIdx);
          return p && p.rules.length ? `${c.metric.name}: ${RULE_ORDER.filter(r => p.rules.includes(r)).map(r => SPC_RULE_LABEL[r]).join('/')}` : '';
        })
        .filter(Boolean)
        .join(' · ');
      return [
        run.result.displayNo,
        run.result.processData?.rcpName || run.result.rcpName,
        run.groupLabel.split(' · ').slice(-1)[0],
        run.startLabel,
        ...charts.map(c => readMetric(c.metric, run.result)),
        judge || '정상',
      ];
    });
    const limRow = (label: string, key: 'cl' | 'ucl' | 'lcl') => [label, '', '', '', ...charts.map(c => (c[key] === null ? '' : Number((c[key] as number).toFixed(6)))), ''];
    rows.push(limRow('CL (평균)', 'cl'), limRow('UCL (+3σ)', 'ucl'), limRow('LCL (−3σ)', 'lcl'));
    if (await copyTableToClipboard(headers, rows)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalFlagged = charts.reduce((s, c) => s + c.flagged, 0);

  return (
    <section data-spc className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} transition-colors`}>
      {/* 머리줄 */}
      <div className={`px-3 py-1.5 ${theme.cardHeaderBg} ${theme.cardTitleColor} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-[#0EA5E9] shadow-xs" />
          <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>[SPC] Run별 추세 관리도</h3>
          <span className="text-[11px] text-[#475569] font-medium whitespace-nowrap">
            (Run 시간 순 · 관리선 = 평균 ± 3σ, σ = 이동범위 평균 ÷ 1.128)
          </span>
        </div>
        <div className="flex items-center gap-2">
        <CopyImageButton fileName="SPC_관리도.png" />
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

      <div className="p-3 space-y-2.5">
        {/* 설정 줄: 대상 Recipe · 관리선 기준 · 판정 규칙 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <label className="flex items-center gap-1.5">
            <span className="font-bold text-[#334155] whitespace-nowrap">대상 Recipe</span>
            <select
              aria-label="SPC 대상 Recipe"
              value={activeGroup}
              onChange={e => setGroupKey(e.target.value)}
              className="h-[26px] max-w-[340px] px-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-[#0F172A] cursor-pointer focus:outline-none focus:border-[#2563EB]"
            >
              {groups.map(g => (
                <option key={g.key} value={g.key}>
                  {g.label} ({g.count} Run)
                </option>
              ))}
              <option value={ALL_GROUPS}>전체 Run ({allRuns.length})</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="font-bold text-[#334155] whitespace-nowrap">관리선 기준</span>
            <select
              aria-label="관리선 기준"
              value={effBase}
              onChange={e => setBaseCount(Number(e.target.value))}
              className="h-[26px] px-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-[#0F172A] cursor-pointer focus:outline-none focus:border-[#2563EB]"
              title="관리선(평균·±3σ)을 어떤 Run으로 계산할지 — 예: PM 전 Run만 기준으로 두고 이후 Run을 판정"
            >
              <option value={0}>전체 Run</option>
              {baseOptions.map(k => (
                <option key={k} value={k}>
                  처음 {k}개 Run
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2.5 text-[10.5px] font-semibold text-[#475569]">
            {RULE_ORDER.map(r => (
              <span key={r} className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RULE_COLOR[r] }} />
                {SPC_RULE_LABEL[r]}
              </span>
            ))}
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-[#2563EB]" />
              선택 Run
            </span>
          </div>
        </div>

        {/* 항목 선택 칩 */}
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="SPC 항목">
          <span className="text-[11px] font-bold text-[#334155] mr-1 whitespace-nowrap">항목</span>
          {SPC_METRICS.map(m => {
            const on = metricIds.includes(m.id);
            const ci = chipInfo[m.id];
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMetric(m.id)}
                className={`flex items-center gap-1 h-[24px] px-2 rounded-full border text-[10.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  on ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1D4ED8]' : 'bg-white border-slate-300 text-[#475569] hover:bg-slate-50'
                } ${ci && !ci.hasValue ? 'opacity-55' : ''}`}
                title={ci && !ci.hasValue ? `${m.name}: 값 없음${m.emptyHint ? ` (${m.emptyHint})` : ''}` : `${m.name} [${m.unit}]`}
              >
                {on && <Check className="w-3 h-3" />}
                {m.name}
                {ci && ci.flagged > 0 && (
                  <span className="min-w-[16px] h-[15px] px-1 rounded-full bg-[#DC2626] text-white text-[9.5px] leading-[15px] text-center tabular-nums">
                    {ci.flagged}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 안내 */}
        {mixed && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            <Info className="w-3.5 h-3.5 mt-[1px] shrink-0" />
            <span>
              서로 다른 Recipe·Layer({groups.length}종)가 섞여 있습니다. 관리선은 같은 조건끼리 비교해야 정확하니, <b>대상 Recipe</b>에서 하나를 고르는 것을 권장합니다.
            </span>
          </div>
        )}
        {runs.length < 2 ? (
          <div className="p-6 text-center text-[12px] text-[#64748B] bg-white border border-dashed border-slate-300 rounded-xl">
            추세를 보려면 같은 조건의 Run이 2개 이상 필요합니다. 공정 Log를 더 추가해 주세요.
          </div>
        ) : charts.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-[#64748B] bg-white border border-dashed border-slate-300 rounded-xl">
            위 <b>항목</b>에서 볼 항목을 골라 주세요.
          </div>
        ) : (
          <>
            <div className="text-[11px] text-[#475569]">
              대상 <b className="text-[#0F172A]">{runs.length}</b> Run · 규칙에 걸린 점{' '}
              <b className={totalFlagged ? 'text-[#DC2626]' : 'text-[#059669]'}>{totalFlagged}</b>개 · 점을 누르면 그 Run이 선택됩니다 (표·타임라인과 연동)
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              {charts.map(c => (
                <div key={c.metric.id} data-spc-chart={c.metric.id} className="bg-white border border-slate-300 rounded-xl p-2 min-w-0">
                  {/* 그래프 제목 + 관리선 값 */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-1 pb-1">
                    <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#0F172A] whitespace-nowrap">
                      <Activity className="w-3.5 h-3.5 text-[#0EA5E9]" />
                      {c.metric.name}
                      <span className="text-[10.5px] font-semibold text-[#64748B]">[{c.metric.unit}]</span>
                      {c.flagged > 0 ? (
                        <span className="px-1.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold">이상 {c.flagged}</span>
                      ) : c.cl !== null ? (
                        <span className="px-1.5 rounded-full bg-[#DCFCE7] text-[#047857] text-[10px] font-bold">정상</span>
                      ) : null}
                    </span>
                    {c.cl !== null ? (
                      <span data-spc-limits className="flex items-center gap-2 text-[10.5px] tabular-nums whitespace-nowrap">
                        <span className="text-[#DC2626] font-semibold">UCL {fmtSpc(c.ucl, limDigits(c.metric.digits))}</span>
                        <span className="text-[#059669] font-bold">CL {fmtSpc(c.cl, limDigits(c.metric.digits))}</span>
                        <span className="text-[#DC2626] font-semibold">LCL {fmtSpc(c.lcl, limDigits(c.metric.digits))}</span>
                        <span className="text-[#64748B]">σ {fmtSpc(c.sigma, Math.min(4, c.metric.digits + 1))}</span>
                        <span className="text-[#94A3B8]">n={c.n}{c.baseN < c.n ? ` (기준 ${c.baseN})` : ''}</span>
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-[#94A3B8] whitespace-nowrap">
                        {c.n === 0 ? `값 없음${c.metric.emptyHint ? ` · ${c.metric.emptyHint}` : ''}` : `관리선은 값이 ${SPC_MIN_POINTS}개 이상일 때 계산됩니다 (현재 ${c.n}개)`}
                      </span>
                    )}
                  </div>
                  {c.n > 0 ? (
                    <SpcChartView chart={c} selectedResultIdx={selectedRunIdx} onPick={pick} />
                  ) : (
                    <div className="h-[120px] flex items-center justify-center text-[11px] text-[#94A3B8]">표시할 값이 없습니다</div>
                  )}
                  {/* 규칙 위반 목록 */}
                  {c.segments.length > 0 && (
                    <ul data-spc-violations className="mt-1 px-1 space-y-0.5 text-[10.5px]">
                      {c.segments.slice(0, 6).map((s, i) => {
                        const a = c.points[s.from].run.result.displayNo;
                        const b = c.points[s.to].run.result.displayNo;
                        const where = s.from === s.to ? `#${a}` : `#${a} ~ #${b}`;
                        const what =
                          s.rule === 'beyond'
                            ? `${s.dir === 'up' ? 'UCL 초과' : 'LCL 미만'} (${fmtSpc(c.points[s.from].value, c.metric.digits)} ${c.metric.unit})`
                            : s.rule === 'side'
                              ? `${SPC_RUN_LENGTH}점 이상 연속 평균 ${s.dir === 'up' ? '위' : '아래'}`
                              : `${SPC_RUN_LENGTH}점 이상 연속 ${s.dir === 'up' ? '상승' : '하강'}`;
                        return (
                          <li key={i} className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RULE_COLOR[s.rule] }} />
                            <span className="font-bold text-[#0F172A] tabular-nums">{where}</span>
                            <span className="text-[#475569] truncate">{what}</span>
                          </li>
                        );
                      })}
                      {c.segments.length > 6 && <li className="text-[#94A3B8] pl-3.5">외 {c.segments.length - 6}건 (데이터 복사로 전체 확인)</li>}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
