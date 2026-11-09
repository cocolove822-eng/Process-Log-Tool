/**
 * Run별 추세 관리도 (SPC) 계산
 *
 * - 한 Run(Depo)에 값 1개 → 개별값 관리도 (I-MR chart)
 * - 중심선 CL = 기준 구간 값들의 평균
 * - σ = 이동범위 평균(MR̄) ÷ 1.128  (이동범위 = 이웃한 두 값의 차이 절대값, d2 = 1.128)
 * - 관리 한계 UCL / LCL = CL ± 3σ
 * - 판정 규칙
 *   1) 관리선 밖: UCL 초과 또는 LCL 미만
 *   2) 7점 연속 한쪽: 7개 이상 연속으로 CL 위(또는 아래) — CL과 같은 값은 연속을 끊음
 *   3) 7점 연속 상승·하강: 7개 이상 연속으로 계속 커짐(또는 계속 작아짐) — 같은 값은 연속을 끊음
 */
import { AnalysisFileResult, ParsedLogFile } from '../types/pecvd';

export type SpcRule = 'beyond' | 'side' | 'trend';

export const SPC_RULE_LABEL: Record<SpcRule, string> = {
  beyond: '관리선 밖',
  side: '7점 연속 한쪽',
  trend: '7점 연속 상승·하강',
};

/** 연속 판정에 필요한 점 수 */
export const SPC_RUN_LENGTH = 7;
/** 개별값 관리도 상수 d2 (n=2) */
export const SPC_D2 = 1.128;

export interface SpcMetricDef {
  id: string;
  name: string;
  unit: string;
  digits: number;
  /** 항목 묶음 (선택칩 정렬용) */
  group: 'RF' | 'Matcher' | 'Pressure' | 'Time';
  get: (r: AnalysisFileResult) => number | null | undefined;
  /** 값이 없을 때 안내 */
  emptyHint?: string;
}

const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v;

export const SPC_METRICS: SpcMetricDef[] = [
  { id: 'reflectMax', name: 'RF Reflect Max', unit: 'W', digits: 1, group: 'RF', get: r => r.monitoringData?.rfReflectPowerMax },
  {
    id: 'rfRamp',
    name: 'RF 도달 시간',
    unit: 's',
    digits: 1,
    group: 'Time',
    get: r => (r.tReach !== null && r.tReach !== undefined && r.tOn !== null && r.tOn !== undefined ? r.tReach - r.tOn : null),
  },
  { id: 'vdcRange', name: 'Vdc Max−Min', unit: 'V', digits: 1, group: 'Matcher', get: r => r.deviation?.matcherDCBias?.range },
  { id: 'dcBiasAvg', name: 'DC Bias Avg', unit: 'V', digits: 1, group: 'Matcher', get: r => r.monitoringData?.matcherDCBiasAvg },
  { id: 'vppAvg', name: 'Vpp Avg', unit: 'V', digits: 1, group: 'Matcher', get: r => r.monitoringData?.matcherVppAvg },
  { id: 'irmsAvg', name: 'Irms Avg', unit: 'A', digits: 2, group: 'Matcher', get: r => r.monitoringData?.matcherIrmsAvg },
  { id: 'loadAvg', name: 'Matcher Load Avg', unit: '%', digits: 1, group: 'Matcher', get: r => r.monitoringData?.matcherLoadAvg },
  { id: 'tuneAvg', name: 'Matcher Tune Avg', unit: '%', digits: 1, group: 'Matcher', get: r => r.monitoringData?.matcherTuneAvg },
  { id: 'tvPosAvg', name: 'T/V Position Avg', unit: '%', digits: 1, group: 'Pressure', get: r => r.monitoringData?.tvPositionAvg },
];

export const SPC_DEFAULT_METRICS = ['reflectMax', 'rfRamp', 'dcBiasAvg', 'tvPosAvg'];

export const getSpcMetric = (id: string): SpcMetricDef | undefined => SPC_METRICS.find(m => m.id === id);

export const readMetric = (m: SpcMetricDef, r: AnalysisFileResult): number | null => {
  try {
    return num(m.get(r));
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* Run 순서 · Recipe 묶음                                               */
/* ------------------------------------------------------------------ */

export interface SpcRun {
  /** results 배열 안 위치 (선택 연동용) */
  resultIdx: number;
  result: AnalysisFileResult;
  /** Run 시작 시각 (ms, 모르면 null) */
  startMs: number | null;
  /** 화면 표시용 시각 'YYYY-MM-DD HH:mm' (모르면 날짜 문자열) */
  startLabel: string;
  /** Recipe · Layer 묶음 키 */
  groupKey: string;
  groupLabel: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtMs = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const fileStartMs = (f: ParsedLogFile | undefined): number | null => {
  if (!f) return null;
  const t = f.rows?.[0]?.timestampMs;
  if (typeof t === 'number' && Number.isFinite(t) && t > 0) return t;
  const parsed = f.meta?.date ? Date.parse(f.meta.date.replace(/\./g, '-')) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Depo Layer 이름 (같은 Recipe 안의 Depo 1·2… 구분) */
const layerName = (r: AnalysisFileResult): string => {
  if (r.depoStepName && !/^Step\s*\d+$/i.test(r.depoStepName.trim())) return r.depoStepName.trim();
  return `Step ${r.depoStep}`;
};

/**
 * Run을 시간 순으로 정렬
 * - 시작 시각(파일 첫 행) → 같은 파일이면 Depo 순서(subIndex) → 원래 순서
 * - 시각을 모르는 Run은 맨 뒤에 원래 순서대로
 */
export const buildSpcRuns = (results: AnalysisFileResult[], files: ParsedLogFile[]): SpcRun[] => {
  const runs = results.map((r, i) => {
    const f = files.find(x => x.id === r.fileId);
    const startMs = fileStartMs(f);
    const rcp = (r.processData?.rcpName || r.rcpName || r.fileName || '').trim();
    const layer = layerName(r);
    return {
      resultIdx: i,
      result: r,
      startMs,
      startLabel: startMs !== null ? fmtMs(startMs) : r.date || '',
      groupKey: `${rcp}\u0000${layer}`,
      groupLabel: `${rcp} · ${layer}`,
    } as SpcRun;
  });
  return runs.sort((a, b) => {
    const ta = a.startMs ?? Number.POSITIVE_INFINITY;
    const tb = b.startMs ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    if (a.result.fileId === b.result.fileId) return (a.result.subIndex ?? 0) - (b.result.subIndex ?? 0) || a.resultIdx - b.resultIdx;
    return a.resultIdx - b.resultIdx;
  });
};

export interface SpcGroup {
  key: string;
  label: string;
  count: number;
}

/** Recipe · Layer 묶음 목록 (Run 많은 순, 같으면 먼저 나온 순) */
export const buildSpcGroups = (runs: SpcRun[]): SpcGroup[] => {
  const map = new Map<string, SpcGroup>();
  runs.forEach(r => {
    const g = map.get(r.groupKey);
    if (g) g.count += 1;
    else map.set(r.groupKey, { key: r.groupKey, label: r.groupLabel, count: 1 });
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
};

/* ------------------------------------------------------------------ */
/* 관리선 · 판정                                                        */
/* ------------------------------------------------------------------ */

export interface SpcPoint {
  run: SpcRun;
  /** 그래프 가로 위치 (0부터, 값 없는 Run도 자리 차지) */
  x: number;
  value: number | null;
  rules: SpcRule[];
}

export interface SpcSegment {
  rule: SpcRule;
  /** points 배열 위치 (값 있는 점 기준 처음·끝) */
  from: number;
  to: number;
  /** 'up' | 'down' (한쪽: 위·아래 / 추세: 상승·하강) */
  dir: 'up' | 'down';
}

export interface SpcChart {
  metric: SpcMetricDef;
  points: SpcPoint[];
  /** 값 있는 점 수 */
  n: number;
  /** 기준 구간에 쓴 값 수 */
  baseN: number;
  cl: number | null;
  ucl: number | null;
  lcl: number | null;
  sigma: number | null;
  mrBar: number | null;
  segments: SpcSegment[];
  /** 규칙에 걸린 점 수 (중복 제외) */
  flagged: number;
}

const EPS = 1e-9;

/** 개별값 관리도 한계 계산 (기준 구간 값들) — 값 2개 미만이면 null */
export const computeIMR = (base: number[]) => {
  if (base.length < 2) return null;
  const mean = base.reduce((s, v) => s + v, 0) / base.length;
  let mrSum = 0;
  for (let i = 1; i < base.length; i++) mrSum += Math.abs(base[i] - base[i - 1]);
  const mrBar = mrSum / (base.length - 1);
  const sigma = mrBar / SPC_D2;
  return { cl: mean, ucl: mean + 3 * sigma, lcl: mean - 3 * sigma, sigma, mrBar };
};

/** 관리선을 그리려면 값이 최소 몇 개 필요한지 */
export const SPC_MIN_POINTS = 3;

/**
 * 관리도 계산
 * @param baseCount 관리선 기준 구간: 값 있는 점 중 앞에서부터 몇 개 (0 또는 n 이상이면 전체)
 */
export const computeSpcChart = (metric: SpcMetricDef, runs: SpcRun[], baseCount = 0): SpcChart => {
  const points: SpcPoint[] = runs.map((run, x) => ({ run, x, value: readMetric(metric, run.result), rules: [] }));
  const valued = points.filter(p => p.value !== null) as (SpcPoint & { value: number })[];
  const n = valued.length;
  const baseN = baseCount > 0 && baseCount < n ? baseCount : n;
  const empty: SpcChart = { metric, points, n, baseN, cl: null, ucl: null, lcl: null, sigma: null, mrBar: null, segments: [], flagged: 0 };
  if (n < SPC_MIN_POINTS || baseN < SPC_MIN_POINTS) return empty;

  const lim = computeIMR(valued.slice(0, baseN).map(p => p.value));
  if (!lim) return empty;
  const { cl, ucl, lcl, sigma, mrBar } = lim;
  const tol = Math.max(EPS, Math.abs(cl) * 1e-12);
  const segments: SpcSegment[] = [];
  const add = (p: SpcPoint, rule: SpcRule) => {
    if (!p.rules.includes(rule)) p.rules.push(rule);
  };

  // 1) 관리선 밖
  valued.forEach((p, i) => {
    if (p.value > ucl + tol || p.value < lcl - tol) {
      add(p, 'beyond');
      segments.push({ rule: 'beyond', from: i, to: i, dir: p.value > ucl ? 'up' : 'down' });
    }
  });

  // 2) 7점 연속 한쪽 (CL과 같은 값은 연속을 끊음)
  const side = (v: number) => (v > cl + tol ? 1 : v < cl - tol ? -1 : 0);
  for (let i = 0; i < n; ) {
    const s0 = side(valued[i].value);
    if (s0 === 0) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < n && side(valued[j + 1].value) === s0) j++;
    if (j - i + 1 >= SPC_RUN_LENGTH) {
      for (let k = i; k <= j; k++) add(valued[k], 'side');
      segments.push({ rule: 'side', from: i, to: j, dir: s0 > 0 ? 'up' : 'down' });
    }
    i = j + 1;
  }

  // 3) 7점 연속 상승·하강 (점 7개 = 변화 6번이 모두 같은 방향, 같은 값은 연속을 끊음)
  const dirOf = (a: number, b: number) => (b > a + tol ? 1 : b < a - tol ? -1 : 0);
  for (let i = 0; i < n - 1; ) {
    const d = dirOf(valued[i].value, valued[i + 1].value);
    if (d === 0) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j + 1 < n && dirOf(valued[j].value, valued[j + 1].value) === d) j++;
    if (j - i + 1 >= SPC_RUN_LENGTH) {
      for (let k = i; k <= j; k++) add(valued[k], 'trend');
      segments.push({ rule: 'trend', from: i, to: j, dir: d > 0 ? 'up' : 'down' });
    }
    // 꼭짓점은 다음 연속의 시작이 될 수 있음
    i = j;
  }

  const flagged = valued.filter(p => p.rules.length > 0).length;
  segments.sort((a, b) => a.from - b.from || a.rule.localeCompare(b.rule));
  // segments의 from/to는 값 있는 점 순서 → points 위치로 바꿔 둠
  const toX = (i: number) => valued[i].x;
  return {
    metric,
    points,
    n,
    baseN,
    cl,
    ucl,
    lcl,
    sigma,
    mrBar,
    segments: segments.map(s => ({ ...s, from: toX(s.from), to: toX(s.to) })),
    flagged,
  };
};

/** 숫자 표시 */
export const fmtSpc = (v: number | null | undefined, digits: number): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
