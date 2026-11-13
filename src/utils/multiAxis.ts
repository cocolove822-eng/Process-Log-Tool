/**
 * 통합 그래프 좌·우 축 자동 배치
 * - 모든 조합(항목별 좌/우 × 축별 위쪽 여유)을 점수로 비교해 가장 잘 보이는 배치를 고름
 * - 점수 = 해상도(선이 축 높이를 잘 쓰는지) − 겹침 벌점(같은 시간에 켜진 두 선이 화면에서 같은 높이) + 약한 선호
 */

export interface AxisInput {
  id: string;
  unit: string;
  /** [시간, 값] — 시간 순 */
  points: [number, number][];
}

export interface AxisRange {
  lo: number;
  hi: number;
  step: number;
}

export interface AxisLayout {
  sides: Record<string, 'L' | 'R'>;
  axes: { L: AxisRange | null; R: AxisRange | null };
  /** 디버그·검증용 */
  score: number;
  overlap: number;
  resolution: number;
}

export const niceStep = (span: number, count: number) => {
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return ([1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag) || 1;
};

/** 축 범위: 0 포함, 위쪽 여유(head) 반영, 눈금 간격의 배수로 맞춤 */
export const makeAxis = (mn: number, mx: number, head: number): AxisRange => {
  const top = mx > 0 ? mx * head : 0;
  const bot = mn < 0 ? mn * (mx > 0 ? 1.05 : head) : 0;
  let span = top - bot;
  if (span < 1e-9) span = 1;
  const step = niceStep(span, 5);
  const hi = top > 0 ? Math.ceil(top / step - 1e-9) * step : 0;
  const lo = bot < 0 ? Math.floor(bot / step + 1e-9) * step : 0;
  return { lo, hi: hi - lo < 1e-9 ? lo + step : hi, step };
};

const HEADS = [1.04, 1.15, 1.3, 1.5];
const SAMPLES = 240;
/** 두 선이 화면 높이의 이만큼 안이면 겹쳐 보임 */
const NEAR = 0.04;

const valueAt = (pts: [number, number][], t: number) => {
  let lo = 0;
  let hi = pts.length - 1;
  if (hi < 0) return 0;
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[hi][0]) return pts[hi][1];
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (pts[m][0] <= t) lo = m;
    else hi = m;
  }
  return Math.abs(pts[lo][0] - t) <= Math.abs(pts[hi][0] - t) ? pts[lo][1] : pts[hi][1];
};

/**
 * @param fixed 사용자가 직접 정한 축 (그 항목은 바꾸지 않음)
 */
export function autoAxisLayout(series: AxisInput[], fixed: Record<string, 'L' | 'R'> = {}): AxisLayout {
  const info = series.map(s => {
    let mn = 0;
    let mx = 0;
    s.points.forEach(([, v]) => {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    });
    return { s, mn, mx, flat: mx - mn < 1e-9 };
  });
  // 공통 시간 샘플
  let t0 = Infinity;
  let t1 = -Infinity;
  series.forEach(s => {
    if (s.points.length) {
      t0 = Math.min(t0, s.points[0][0]);
      t1 = Math.max(t1, s.points[s.points.length - 1][0]);
    }
  });
  const ts = Number.isFinite(t0) ? Array.from({ length: SAMPLES }, (_, k) => t0 + ((t1 - t0) * k) / (SAMPLES - 1)) : [];
  const vals = series.map(s => ts.map(t => valueAt(s.points, t)));
  // 켜져 있음: 0에서 자기 최대 폭의 3% 이상 떨어짐 (바닥선끼리 겹치는 건 괜찮음)
  const active = info.map((x, i) => vals[i].map(v => Math.abs(v) > Math.max(Math.abs(x.mx), Math.abs(x.mn)) * 0.03));

  const free = info.map((x, i) => i).filter(i => !info[i].flat && fixed[info[i].s.id] === undefined);
  const scoring = info.map((x, i) => i).filter(i => !info[i].flat);
  let best: AxisLayout | null = null;

  const combos = 1 << free.length;
  for (let mask = 0; mask < combos; mask++) {
    const side: ('L' | 'R')[] = info.map((x, i) => fixed[x.s.id] ?? 'L');
    free.forEach((i, k) => (side[i] = mask & (1 << k) ? 'R' : 'L'));
    const has = { L: false, R: false };
    const ext = { L: [0, 0], R: [0, 0] } as Record<'L' | 'R', number[]>;
    scoring.forEach(i => {
      const sd = side[i];
      has[sd] = true;
      ext[sd][0] = Math.min(ext[sd][0], info[i].mn);
      ext[sd][1] = Math.max(ext[sd][1], info[i].mx);
    });
    for (const hL of has.L ? HEADS : [1.04]) {
      for (const hR of has.R ? HEADS : [1.04]) {
        const axL = has.L ? makeAxis(ext.L[0], ext.L[1], hL) : null;
        const axR = has.R ? makeAxis(ext.R[0], ext.R[1], hR) : null;
        const axOf = (i: number) => (side[i] === 'L' ? axL : axR)!;
        // 해상도: 선의 높이 폭 / 축 높이 (평균)
        let res = 0;
        scoring.forEach(i => {
          const ax = axOf(i);
          res += (info[i].mx - info[i].mn) / (ax.hi - ax.lo);
        });
        res = scoring.length ? res / scoring.length : 1;
        // 겹침: 같은 시간에 둘 다 켜져 있고 화면 높이가 NEAR 안
        let ov = 0;
        let pairs = 0;
        let worstPair = 0;
        for (let a = 0; a < scoring.length; a++) {
          for (let b = a + 1; b < scoring.length; b++) {
            const i = scoring[a];
            const j = scoring[b];
            const ai = axOf(i);
            const aj = axOf(j);
            let both = 0;
            let near = 0;
            for (let k = 0; k < ts.length; k++) {
              if (!active[i][k] || !active[j][k]) continue;
              both++;
              const yi = (vals[i][k] - ai.lo) / (ai.hi - ai.lo);
              const yj = (vals[j][k] - aj.lo) / (aj.hi - aj.lo);
              if (Math.abs(yi - yj) < NEAR) near++;
            }
            pairs++;
            if (both > 0) {
              ov += near / ts.length;
              worstPair = Math.max(worstPair, near / ts.length);
            }
          }
        }
        const overlap = pairs ? ov / pairs : 0;
        // 약한 선호: 같은 단위는 같은 축, 왼쪽 축 위주, 2축은 필요할 때만
        let sameUnit = 0;
        for (let a = 0; a < scoring.length; a++)
          for (let b = a + 1; b < scoring.length; b++)
            if (info[scoring[a]].s.unit === info[scoring[b]].s.unit && side[scoring[a]] === side[scoring[b]]) sameUnit++;
        const rightCount = scoring.filter(i => side[i] === 'R').length;
        // 겹침은 평균과 가장 심한 쌍 둘 다 벌점 (한 쌍이 크게 겹치는 배치를 피함)
        const score = res - 4 * overlap - 2 * worstPair + 0.015 * sameUnit - 0.01 * rightCount - (has.L && has.R ? 0.02 : 0);
        if (!best || score > best.score + 1e-9) {
          const sides: Record<string, 'L' | 'R'> = {};
          info.forEach((x, i) => (sides[x.s.id] = side[i]));
          best = { sides, axes: { L: axL, R: axR }, score, overlap, resolution: res };
        }
      }
    }
  }
  if (!best) {
    const sides: Record<string, 'L' | 'R'> = {};
    series.forEach(s => (sides[s.id] = fixed[s.id] ?? 'L'));
    return { sides, axes: { L: null, R: null }, score: 0, overlap: 0, resolution: 0 };
  }
  return best;
}
