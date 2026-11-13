import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CopyImageButton } from './CopyImageButton';
import { Check, ChevronDown, ChevronRight, Copy, Layers, RefreshCw, X } from 'lucide-react';
import { useStoredState } from '../utils/trendStore';
import { copyTableToClipboard } from '../utils/exportUtils';

/**
 * 통합 그래프: Run 1개의 여러 Parameter를 한 그래프에 (좌·우 2축)
 * - 값이 작은 항목은 왼쪽 축, 큰 항목은 오른쪽 축 (그래프 분석 매니저에서 항목별로 바꿀 수 있음)
 * - 커서 위치의 모든 값, Step 타임라인 띠, 휠 확대 · 드래그 이동, Shift+드래그 구간 통계
 */

export interface MultiSeries {
  id: string;
  name: string;
  unit: string;
  color: string;
  side: 'L' | 'R';
  /** [시간(초), 값] — 시간 순 */
  points: [number, number][];
}

export interface MultiStep {
  step: number;
  stepName: string;
  start: number;
  end: number;
}

interface Props {
  runLabel: string;
  series: MultiSeries[];
  /** 자동 배치에서 정한 좌·우 축 범위 (없으면 데이터로 계산) */
  axes?: { L: { lo: number; hi: number; step: number } | null; R: { lo: number; hi: number; step: number } | null };
  steps: MultiStep[];
  showSteps: boolean;
  stepColors: { bg: string; border: string; text: string }[];
  timeLabel: string;
}

const H = 360;
const PAD_L = 62;
const PAD_R = 64;
const PAD_T = 24; // 위쪽: 축 단위 제목 자리 (눈금 숫자와 겹치지 않게)
const PAD_B = 34;

const niceStep = (span: number, count: number) => {
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return ([1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag) || 1;
};
const fmtVal = (v: number) => {
  const a = Math.abs(v);
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 1 : 2;
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fmtTick = (v: number, step: number) => {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};
/** 정렬된 시간 배열에서 t에 가장 가까운 점 */
const nearestIdx = (pts: [number, number][], t: number) => {
  let lo = 0;
  let hi = pts.length - 1;
  if (hi < 0) return -1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (pts[m][0] <= t) lo = m;
    else hi = m;
  }
  return Math.abs(pts[lo][0] - t) <= Math.abs(pts[hi][0] - t) ? lo : hi;
};

/** 축 범위: 0을 포함하고 위쪽에 여유 */
const axisRange = (list: MultiSeries[]): { lo: number; hi: number; step: number } | null => {
  let lo = Infinity;
  let hi = -Infinity;
  list.forEach(s =>
    s.points.forEach(([, v]) => {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }),
  );
  if (!Number.isFinite(lo)) return null;
  lo = Math.min(0, lo);
  hi = Math.max(0, hi);
  if (hi - lo < 1e-9) hi = lo + 1;
  const step = niceStep((hi - lo) * 1.05, 5);
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil((hi * 1.04) / step) * step, step };
};

export const MultiParamChart: React.FC<Props> = ({ runLabel, series, axes, steps, showSteps, stepColors, timeLabel }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(900);
  const [view, setView] = useState<[number, number] | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const [copied, setCopied] = useState(false);
  // 접기/펼치기 (기본: 접힘, 탭을 다녀와도 유지)
  const [collapsed, setCollapsed] = useStoredState<boolean>('trend.multiCollapsed', true);
  const dragRef = useRef<{ mode: 'pan' | 'range'; x0: number; t0: number; view: [number, number] } | null>(null);

  // 전체 시간 범위
  const full = useMemo<[number, number]>(() => {
    let a = Infinity;
    let b = -Infinity;
    series.forEach(s => {
      if (s.points.length) {
        a = Math.min(a, s.points[0][0]);
        b = Math.max(b, s.points[s.points.length - 1][0]);
      }
    });
    return Number.isFinite(a) ? [Math.floor(a), Math.ceil(b)] : [0, 100];
  }, [series]);
  const [x0, x1] = view ?? full;
  // Run·항목이 바뀌면 확대·구간 해제
  const sig = series.map(s => s.id).join(',') + '|' + runLabel + '|' + full.join(',');
  useEffect(() => {
    setView(null);
    setRange(null);
  }, [sig]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(320, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [collapsed]);

  const left = series.filter(s => s.side === 'L');
  const right = series.filter(s => s.side === 'R');
  const axL = useMemo(() => (left.length ? axes?.L ?? axisRange(left) : null), [series, axes]); // eslint-disable-line react-hooks/exhaustive-deps
  const axR = useMemo(() => (right.length ? axes?.R ?? axisRange(right) : null), [series, axes]); // eslint-disable-line react-hooks/exhaustive-deps
  const plotW = Math.max(50, width - PAD_L - PAD_R);
  const plotH = H - PAD_T - PAD_B;
  const xOf = (t: number) => PAD_L + ((t - x0) / Math.max(1e-9, x1 - x0)) * plotW;
  const tOf = (px: number) => x0 + ((px - PAD_L) / plotW) * (x1 - x0);
  const yOf = (v: number, ax: { lo: number; hi: number }) => PAD_T + plotH - ((v - ax.lo) / (ax.hi - ax.lo)) * plotH;

  // 그리기
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, H);
    g.font = '10px Inter, "Inter Embedded", sans-serif';

    // 구간 배경
    const shade = draft ?? range;
    if (shade) {
      const a = Math.max(PAD_L, xOf(Math.min(shade[0], shade[1])));
      const b = Math.min(PAD_L + plotW, xOf(Math.max(shade[0], shade[1])));
      if (b > a) {
        g.fillStyle = 'rgba(124,58,237,0.10)';
        g.fillRect(a, PAD_T, b - a, plotH);
      }
    }
    // Step 경계 점선
    if (showSteps) {
      g.strokeStyle = '#CBD5E1';
      g.setLineDash([3, 3]);
      steps.forEach(st => {
        const x = xOf(st.start);
        if (x > PAD_L + 1 && x < PAD_L + plotW - 1) {
          g.beginPath();
          g.moveTo(x, PAD_T);
          g.lineTo(x, PAD_T + plotH);
          g.stroke();
        }
      });
      g.setLineDash([]);
    }
    // 가로 눈금 (왼쪽 축 기준, 없으면 오른쪽)
    const main = axL ?? axR;
    if (main) {
      g.textBaseline = 'middle';
      for (let v = main.lo; v <= main.hi + main.step * 1e-6; v += main.step) {
        const y = yOf(v, main);
        g.strokeStyle = '#E2E8F0';
        g.beginPath();
        g.moveTo(PAD_L, y);
        g.lineTo(PAD_L + plotW, y);
        g.stroke();
      }
    }
    if (axL) {
      g.fillStyle = '#475569';
      g.textAlign = 'right';
      for (let v = axL.lo; v <= axL.hi + axL.step * 1e-6; v += axL.step) g.fillText(fmtTick(v, axL.step), PAD_L - 6, yOf(v, axL));
    }
    if (axR) {
      g.fillStyle = '#475569';
      g.textAlign = 'left';
      for (let v = axR.lo; v <= axR.hi + axR.step * 1e-6; v += axR.step) g.fillText(fmtTick(v, axR.step), PAD_L + plotW + 6, yOf(v, axR));
    }
    // 세로 눈금 (시간)
    const xs = niceStep(x1 - x0, Math.max(4, Math.floor(plotW / 90)));
    g.fillStyle = '#475569';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let t = Math.ceil(x0 / xs) * xs; t <= x1 + 1e-9; t += xs) {
      const x = xOf(t);
      g.strokeStyle = '#F1F5F9';
      g.beginPath();
      g.moveTo(x, PAD_T);
      g.lineTo(x, PAD_T + plotH);
      g.stroke();
      g.fillText(fmtTick(t, xs), x, PAD_T + plotH + 5);
    }
    g.fillText(timeLabel, PAD_L + plotW / 2, H - 13);
    g.strokeStyle = '#94A3B8';
    g.strokeRect(PAD_L + 0.5, PAD_T + 0.5, plotW - 1, plotH - 1);

    // 선
    g.save();
    g.beginPath();
    g.rect(PAD_L, PAD_T, plotW, plotH);
    g.clip();
    series.forEach(s => {
      const ax = s.side === 'L' ? axL : axR;
      if (!ax || s.points.length === 0) return;
      g.strokeStyle = s.color;
      g.lineWidth = 1.6;
      g.beginPath();
      let started = false;
      // 화면 밖 점은 건너뛰되 경계 바로 바깥 점은 포함해 선이 끊기지 않게
      const i0 = Math.max(0, nearestIdx(s.points, x0) - 1);
      const i1 = Math.min(s.points.length - 1, nearestIdx(s.points, x1) + 1);
      for (let i = i0; i <= i1; i++) {
        const [t, v] = s.points[i];
        const x = xOf(t);
        const y = yOf(v, ax);
        if (!started) {
          g.moveTo(x, y);
          started = true;
        } else g.lineTo(x, y);
      }
      g.stroke();
    });
    // 커서
    if (hoverT !== null && hoverT >= x0 && hoverT <= x1) {
      const x = xOf(hoverT);
      g.strokeStyle = '#334155';
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(x, PAD_T);
      g.lineTo(x, PAD_T + plotH);
      g.stroke();
      g.setLineDash([]);
      series.forEach(s => {
        const ax = s.side === 'L' ? axL : axR;
        const i = nearestIdx(s.points, hoverT);
        if (!ax || i < 0) return;
        g.fillStyle = '#FFFFFF';
        g.strokeStyle = s.color;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(xOf(s.points[i][0]), yOf(s.points[i][1], ax), 3.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      });
    }
    g.restore();
  }, [series, width, x0, x1, hoverT, axL, axR, steps, showSteps, range, draft, timeLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // 마우스: 휠 = 확대, 드래그 = 이동, Shift+드래그 = 구간
  const pxOf = (e: React.MouseEvent | WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return (e as MouseEvent).clientX - r.left;
  };
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = tOf(pxOf(e));
      const k = e.deltaY < 0 ? 0.8 : 1.25;
      let a = t - (t - x0) * k;
      let b = t + (x1 - t) * k;
      if (b - a >= full[1] - full[0]) {
        setView(null);
        return;
      }
      if (b - a < 1) return;
      if (a < full[0]) [a, b] = [full[0], full[0] + (b - a)];
      if (b > full[1]) [a, b] = [full[1] - (b - a), full[1]];
      setView([a, b]);
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.MouseEvent) => {
    const px = pxOf(e);
    if (px < PAD_L || px > PAD_L + plotW) return;
    dragRef.current = { mode: e.shiftKey ? 'range' : 'pan', x0: px, t0: tOf(px), view: [x0, x1] };
  };
  const onMove = (e: React.MouseEvent) => {
    const px = pxOf(e);
    const t = tOf(Math.max(PAD_L, Math.min(PAD_L + plotW, px)));
    setHoverT(px >= PAD_L && px <= PAD_L + plotW ? t : null);
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === 'range') {
      setDraft([d.t0, t]);
    } else if (view) {
      const dt = ((px - d.x0) / plotW) * (d.view[1] - d.view[0]);
      let a = d.view[0] - dt;
      let b = d.view[1] - dt;
      if (a < full[0]) [a, b] = [full[0], full[0] + (b - a)];
      if (b > full[1]) [a, b] = [full[1] - (b - a), full[1]];
      setView([a, b]);
    }
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.mode === 'range' && draft) {
      const a = Math.min(draft[0], draft[1]);
      const b = Math.max(draft[0], draft[1]);
      setRange(b - a > 0.05 ? [Math.round(a * 10) / 10, Math.round(b * 10) / 10] : null);
    }
    setDraft(null);
  };

  // 커서 값 · 구간 통계
  const cursorVals = series.map(s => {
    const i = hoverT === null ? -1 : nearestIdx(s.points, hoverT);
    return i >= 0 ? s.points[i][1] : null;
  });
  const stats = useMemo(() => {
    if (!range) return null;
    return series.map(s => {
      const vs = s.points.filter(([t]) => t >= range[0] && t <= range[1]).map(([, v]) => v);
      if (vs.length === 0) return { s, n: 0, avg: null, min: null, max: null };
      const sum = vs.reduce((a, v) => a + v, 0);
      return { s, n: vs.length, avg: sum / vs.length, min: Math.min(...vs), max: Math.max(...vs) };
    });
  }, [range, series]);

  const copyStats = async () => {
    if (!stats || !range) return;
    const ok = await copyTableToClipboard(
      ['Parameter', '단위', '축', 'Avg.', 'Min', 'Max', 'Max−Min'],
      stats.map(x => [x.s.name, x.s.unit, x.s.side === 'L' ? '좌' : '우', x.avg ?? '-', x.min ?? '-', x.max ?? '-', x.max !== null && x.min !== null ? x.max - x.min : '-']),
    );
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const unitsOf = (list: MultiSeries[]) => [...new Set(list.map(s => s.unit))].join(' · ');
  const visibleSteps = steps.filter(st => st.end > x0 && st.start < x1);

  return (
    <div data-multi-chart className="bg-white border border-slate-400 border-t-2 border-t-[#7C3AED] rounded-2xl shadow-xs overflow-hidden">
      {/* 머리줄: 접기 · 제목 · Run · 범례 */}
      <div className={`px-3 py-2 bg-[#F5F3FF] ${collapsed ? '' : 'border-b border-slate-300'} flex flex-wrap items-center gap-x-3 gap-y-1.5`}>
        <button
          type="button"
          data-copy-ignore
          data-multi-toggle
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          title={collapsed ? '통합 그래프 펼치기' : '통합 그래프 접기'}
          className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A] whitespace-nowrap cursor-pointer hover:text-[#6D28D9]"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 text-[#7C3AED]" /> : <ChevronDown className="w-4 h-4 text-[#7C3AED]" />}
          <Layers className="w-4 h-4 text-[#7C3AED]" />
          통합 그래프
          <span className="px-1.5 py-[1px] rounded border border-[#C4B5FD] bg-white text-[10px] font-semibold text-[#6D28D9]">{collapsed ? '펼치기' : '접기'}</span>
        </button>
        <span className="px-2 py-0.5 rounded-md bg-white border border-[#C4B5FD] text-[11px] font-bold text-[#5B21B6] whitespace-nowrap">{runLabel}</span>
        <div data-multi-legend className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {series.map(s => (
            <span key={s.id} className="flex items-center gap-1 text-[11px] font-semibold text-[#334155] whitespace-nowrap">
              <span className="w-3.5 h-[3px] rounded" style={{ backgroundColor: s.color }} />
              {s.name}
              <span className="text-[10px] text-[#94A3B8]">[{s.unit}]</span>
              <span className={`text-[9.5px] px-1 rounded font-bold ${s.side === 'L' ? 'bg-slate-100 text-[#475569]' : 'bg-[#EDE9FE] text-[#6D28D9]'}`}>{s.side === 'L' ? '좌' : '우'}</span>
            </span>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-2 text-[10.5px] text-[#64748B] whitespace-nowrap">
          {!collapsed && <CopyImageButton compact fileName="통합_그래프.png" />}
          {!collapsed && view && (
            <button
              type="button"
              onClick={() => setView(null)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-300 bg-white text-[#334155] font-semibold cursor-pointer hover:bg-slate-50"
            >
              <RefreshCw className="w-3 h-3" />
              초기화
            </button>
          )}
          {!collapsed && '휠: 확대 · 드래그: 이동 · Shift+드래그: 구간'}
        </span>
      </div>
      {!collapsed && (<>
      <div className="p-2 flex gap-2">
        <div className="flex-1 min-w-0">
          {/* Step 타임라인 띠 */}
          {showSteps && visibleSteps.length > 0 && (
            <div className="relative h-[20px] mb-1" style={{ marginLeft: PAD_L, marginRight: PAD_R }}>
              {visibleSteps.map((st, i) => {
                const a = Math.max(0, ((Math.max(st.start, x0) - x0) / (x1 - x0)) * 100);
                const b = Math.min(100, ((Math.min(st.end, x1) - x0) / (x1 - x0)) * 100);
                const c = stepColors[steps.indexOf(st) % stepColors.length];
                return (
                  <div
                    key={`${st.step}-${i}`}
                    className="absolute top-0 h-full flex items-center justify-center overflow-hidden text-[9.5px] font-semibold border rounded-sm whitespace-nowrap"
                    style={{ left: `${a}%`, width: `${Math.max(0, b - a)}%`, backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                    title={`Step ${st.step} ${st.stepName} (${st.start.toFixed(1)} ~ ${st.end.toFixed(1)} s)`}
                  >
                    {b - a > 6 ? `Step ${st.step}${b - a > 12 ? ` (${st.stepName})` : ''}` : `S${st.step}`}
                  </div>
                );
              })}
            </div>
          )}
          <div ref={wrapRef} className="relative">
            {/* 축 제목 (단위) */}
            <span className="absolute left-0 top-0 text-[10px] font-bold text-[#475569]">{left.length ? unitsOf(left) : ''}</span>
            <span className="absolute right-0 top-0 text-[10px] font-bold text-[#6D28D9]">{right.length ? unitsOf(right) : ''}</span>
            <canvas
              ref={canvasRef}
              style={{ width, height: H, cursor: dragRef.current ? 'grabbing' : view ? 'grab' : 'crosshair' }}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={() => {
                setHoverT(null);
                onUp();
              }}
              onDoubleClick={() => setView(null)}
            />
          </div>
        </div>
        {/* 커서 값 표 */}
        <div data-multi-values className="w-[210px] shrink-0 bg-white border border-slate-300 rounded-lg overflow-hidden self-start">
          <div className="px-2 py-1.5 bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-bold text-[#334155]">
            {hoverT === null ? '커서 위치 값' : `${hoverT.toFixed(1)} s`}
            {hoverT !== null && (() => {
              const st = steps.find(s => hoverT >= s.start && hoverT <= s.end);
              return st ? <span className="ml-1 font-semibold text-[#64748B]">· Step {st.step}</span> : null;
            })()}
          </div>
          {series.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between gap-1 px-2 py-1 border-b border-slate-100 last:border-0 text-[11px]">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="truncate font-semibold text-[#0F172A]" title={s.name}>{s.name}</span>
              </span>
              <span className="tabular-nums font-bold text-[#0F172A] whitespace-nowrap">
                {cursorVals[i] === null ? '–' : fmtVal(cursorVals[i] as number)}
                <span className="ml-0.5 text-[9.5px] font-semibold text-[#94A3B8]">{s.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* 구간 통계 */}
      {stats && range && (
        <div data-multi-stats className="mx-2 mb-2 border border-[#C4B5FD] rounded-lg overflow-hidden">
          <div className="px-2 py-1 bg-[#F5F3FF] flex items-center gap-2 text-[11px]">
            <b className="text-[#5B21B6]">구간 통계</b>
            <span className="tabular-nums text-[#334155] font-semibold">
              {range[0].toFixed(1)} ~ {range[1].toFixed(1)} s ({(range[1] - range[0]).toFixed(1)} s)
            </span>
            <button type="button" onClick={copyStats} className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10.5px] font-semibold cursor-pointer">
              {copied ? <Check className="w-3 h-3 text-[#059669]" /> : <Copy className="w-3 h-3 text-[#64748B]" />}
              {copied ? '복사 완료' : '복사'}
            </button>
            <button type="button" onClick={() => setRange(null)} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10.5px] font-semibold cursor-pointer">
              <X className="w-3 h-3" />
              해제
            </button>
          </div>
          <table className="w-full border-collapse text-[11px] tabular-nums">
            <thead>
              <tr className="bg-[#DDE3EA]">
                {['Parameter', '축', 'Avg.', 'Min', 'Max', 'Max−Min'].map(h => (
                  <th key={h} className="px-2 py-1 border border-slate-400 font-bold text-[#0F172A] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(x => (
                <tr key={x.s.id} className="odd:bg-white even:bg-[#EDF2F7]">
                  <td className="px-2 py-1 border border-slate-400 font-semibold text-left whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: x.s.color }} />
                    {x.s.name} <span className="text-[#94A3B8]">[{x.s.unit}]</span>
                  </td>
                  <td className="px-2 py-1 border border-slate-400 text-center">{x.s.side === 'L' ? '좌' : '우'}</td>
                  {[x.avg, x.min, x.max, x.max !== null && x.min !== null ? x.max - x.min : null].map((v, k) => (
                    <td key={k} className="px-2 py-1 border border-slate-400 text-center font-semibold">{v === null ? '-' : fmtVal(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}
    </div>
  );
};
