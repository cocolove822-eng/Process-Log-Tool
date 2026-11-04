import { CTCLMatrixData } from '../types/pecvd';
import {
  MatcherModelParams,
  MatcherSolvedSpec,
  ModelContext,
  ParamUncertainty,
  VvcProfile,
  VvcTable,
  forwardZ,
  getUnsolvedSpec,
} from './matcherSolver';

/**
 * ============================================================================
 * matcherPrecisionFit.ts — VVC 정격 기반 "정밀 보정" 역산
 * ============================================================================
 *
 * 기존 방식(정격 직선 가정)에 다음 두 가지를 더한다.
 *  1) 출력단(Chamber 쪽) 대지 기생 용량 C_out
 *     - Tune 위치에 따라 R이 변하는 현상(이상적인 L-Type에서는 R이 Load에만 의존)을 설명
 *  2) Tune VVC 실측 용량 곡선 (구간 선형, 13개 지점)
 *     - 100% 지점만 "정격 최대 × 수량"으로 고정하고 나머지는 데이터에서 학습
 *     - 진공 가변 콘덴서는 최소 용량 근처(저 % 구간)에서 직선에서 벗어나는 경우가 많음
 *     - 100% 고정점이 있어야 Series L이 결정된다 (없으면 곡선과 L이 서로 맞바뀜)
 *
 * Load 쪽은 CTCL만으로 "VFC ↔ Shunt L ↔ VVC 최소 용량"이 서로 맞바뀌므로,
 * 둘 중 하나를 알려줘야 한다.
 *  - loadMode 'rating' : Load VVC 정격(min~max)을 그대로 쓰고 VFC·Shunt L을 피팅
 *  - loadMode 'vfc'    : 사용자가 입력한 VFC를 쓰고 VVC 최소 용량·Shunt L을 피팅 (최대는 정격)
 */

export const TUNE_KNOTS = [0, 2, 4, 6, 8, 10, 13, 16, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];

export interface PrecisionOptions {
  loadProfile: VvcProfile;
  tuneProfile: VvcProfile;
  /** 알고 있는 Load VFC 합계 (pF). 지정하면 loadMode = 'vfc' */
  knownLoadVfcPf?: number;
  /** Tune VFC 합계 (pF). Tune VVC와 병렬로 장착된 고정 용량, 미장착이면 0 */
  tuneVfcPf?: number;
  rWeight?: number;
}

export interface PrecisionInfo {
  cOutPf: number;
  cOutSd?: number;
  tuneAnchorPf: number;
  tuneCurve: { pct: number; totalPf: number; ratedPf: number }[];
  loadMode: 'rating' | 'vfc';
  loadVvcMinFitPf: number; // Load VVC 총 용량 0% (×수량 포함)
  loadVvcMaxPf: number;
  baseline: { r2: number; rmse: number }; // 같은 정격 힌트, 기존 방식(직선·기생C 없음)
}

interface Sample {
  l: number;
  t: number;
  pL: number;
  pT: number;
  r: number;
  x: number;
}

type Key = string;
type Vec = Record<Key, number>;

const R_WEIGHT_DEFAULT = 3;

function buildModel(v: Vec, o: PrecisionOptions, mode: 'rating' | 'vfc', curve: boolean) {
  const lMax = o.loadProfile.max * o.loadProfile.count;
  const lMin = mode === 'rating' ? o.loadProfile.min * o.loadProfile.count : v.lMin;
  const vfcL = mode === 'rating' ? v.vfcL : o.knownLoadVfcPf ?? 0;
  const tVfc = Math.max(0, o.tuneVfcPf ?? 0);
  const anchor = o.tuneProfile.max * o.tuneProfile.count + tVfc;
  const tMin = o.tuneProfile.min * o.tuneProfile.count + tVfc;

  const loadTable: VvcTable = { points: [{ pct: 0, pf: lMin }, { pct: 100, pf: lMax }], count: 1 };
  const tunePts = curve
    ? TUNE_KNOTS.map((pct, i) => ({ pct, pf: i === TUNE_KNOTS.length - 1 ? anchor : v['k' + i] }))
    : [
        { pct: 0, pf: tMin },
        { pct: 100, pf: anchor },
      ];
  const tuneTable: VvcTable = { points: tunePts, count: 1 };

  const prm: MatcherModelParams = {
    lShuntNh: v.lsh,
    lSeriesNh: v.lse,
    cLoad0Pf: vfcL,
    cLoad100Pf: vfcL,
    cLoadBowPf: 0,
    cTune0Pf: 0,
    cTune100Pf: 0,
    cTuneBowPf: 0,
    rLossOhm: v.rloss,
    cOutPf: curve ? v.cOut : 0,
  };
  const ctx: ModelContext = { loadTable, tuneTable };
  return { prm, ctx, lMin, lMax, vfcL, anchor };
}

function residuals(
  v: Vec,
  ss: Sample[],
  conv: 'zout' | 'zload',
  o: PrecisionOptions,
  mode: 'rating' | 'vfc',
  curve: boolean,
  out: Float64Array
): number {
  const { prm, ctx } = buildModel(v, o, mode, curve);
  const w = o.rWeight ?? R_WEIGHT_DEFAULT;
  let c = 0;
  for (let i = 0; i < ss.length; i++) {
    const z = forwardZ(prm, ss[i].pL, ss[i].pT, conv, ctx);
    const er = z ? (z.r - ss[i].r) * w : 1e3;
    const ex = z ? z.x - ss[i].x : 1e3;
    out[2 * i] = er;
    out[2 * i + 1] = ex;
    c += er * er + ex * ex;
  }
  return c;
}

function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

interface LmResult {
  v: Vec;
  cost: number;
  jtj: number[][];
  keys: Key[];
}

/** 모든 자유 파라미터는 양수 → log 공간 Levenberg–Marquardt (수치 야코비안) */
function lm(
  init: Vec,
  keys: Key[],
  ss: Sample[],
  conv: 'zout' | 'zload',
  o: PrecisionOptions,
  mode: 'rating' | 'vfc',
  curve: boolean,
  maxIter = 150
): LmResult {
  const toV = (th: number[]) => {
    const v = { ...init };
    keys.forEach((k, i) => (v[k] = Math.exp(Math.max(-13, Math.min(13, th[i])))));
    return v;
  };
  let th = keys.map((k) => Math.log(Math.max(init[k], 1e-6)));
  const n = keys.length;
  const r0 = new Float64Array(ss.length * 2);
  const r1 = new Float64Array(ss.length * 2);
  let cost = residuals(toV(th), ss, conv, o, mode, curve, r0);
  let lam = 1e-2;
  let jtj: number[][] = [];
  const h = 1e-5;
  for (let it = 0; it < maxIter; it++) {
    const J: Float64Array[] = [];
    for (let j = 0; j < n; j++) {
      const t = th.slice();
      t[j] += h;
      residuals(toV(t), ss, conv, o, mode, curve, r1);
      const col = new Float64Array(r0.length);
      for (let i = 0; i < r0.length; i++) col[i] = (r1[i] - r0[i]) / h;
      J.push(col);
    }
    const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const g = new Array(n).fill(0);
    for (let a = 0; a < n; a++) {
      for (let b = a; b < n; b++) {
        let s = 0;
        const ja = J[a];
        const jb = J[b];
        for (let i = 0; i < ja.length; i++) s += ja[i] * jb[i];
        A[a][b] = A[b][a] = s;
      }
      let s = 0;
      for (let i = 0; i < r0.length; i++) s += J[a][i] * r0[i];
      g[a] = s;
    }
    jtj = A;
    let ok = false;
    for (let tries = 0; tries < 10; tries++) {
      const Ad = A.map((row, i) => row.map((val, j) => (i === j ? val * (1 + lam) + 1e-12 : val)));
      const d = solveLinear(
        Ad,
        g.map((val) => -val)
      );
      if (!d) {
        lam *= 4;
        continue;
      }
      const t2 = th.map((val, i) => val + Math.max(-1, Math.min(1, d[i])));
      const c2 = residuals(toV(t2), ss, conv, o, mode, curve, r1);
      if (Number.isFinite(c2) && c2 < cost) {
        const rel = (cost - c2) / cost;
        th = t2;
        cost = c2;
        residuals(toV(th), ss, conv, o, mode, curve, r0);
        lam = Math.max(lam / 3, 1e-9);
        ok = true;
        if (rel < 1e-10) it = maxIter;
        break;
      }
      lam *= 4;
    }
    if (!ok) break;
  }
  return { v: toV(th), cost, jtj, keys };
}

function metrics(v: Vec, ss: Sample[], conv: 'zout' | 'zload', o: PrecisionOptions, mode: 'rating' | 'vfc', curve: boolean) {
  const { prm, ctx } = buildModel(v, o, mode, curve);
  let sr = 0;
  let sx = 0;
  let mx = 0;
  let mr = 0;
  let mxv = 0;
  for (const s of ss) {
    mr += s.r / ss.length;
    mxv += s.x / ss.length;
  }
  let st = 0;
  for (const s of ss) {
    const z = forwardZ(prm, s.pL, s.pT, conv, ctx);
    const dr = z ? z.r - s.r : 1e3;
    const dx = z ? z.x - s.x : 1e3;
    sr += dr * dr;
    sx += dx * dx;
    mx = Math.max(mx, Math.hypot(dr, dx));
    st += (s.r - mr) ** 2 + (s.x - mxv) ** 2;
  }
  const n = ss.length;
  return { r2: 1 - (sr + sx) / st, rmse: Math.sqrt((sr + sx) / n), rmseR: Math.sqrt(sr / n), rmseX: Math.sqrt(sx / n), maxAbs: mx };
}

function invert(A: number[][]): number[][] | null {
  const n = A.length;
  const cols: number[][] = [];
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0);
    e[j] = 1;
    const c = solveLinear(A, e);
    if (!c) return null;
    cols.push(c);
  }
  return Array.from({ length: n }, (_, i) => cols.map((c) => c[i]));
}

export function solveMatcherPrecision(matrix: CTCLMatrixData | null, o: PrecisionOptions): MatcherSolvedSpec {
  if (!matrix || matrix.loads.length < 3 || matrix.tunes.length < 3) {
    return getUnsolvedSpec('CTCL Matrix가 없거나 Load/Tune 좌표가 3개 미만입니다.');
  }
  const { loads, tunes, grid } = matrix;
  const lMinP = Math.min(...loads);
  const lMaxP = Math.max(...loads);
  const tMinP = Math.min(...tunes);
  const tMaxP = Math.max(...tunes);
  const all: Sample[] = [];
  for (const l of loads)
    for (const t of tunes) {
      const z = grid[l]?.[t];
      if (!z || !Number.isFinite(z.r) || !Number.isFinite(z.x)) continue;
      all.push({ l, t, pL: (l - lMinP) / (lMaxP - lMinP || 1), pT: (t - tMinP) / (tMaxP - tMinP || 1), r: z.r, x: z.x });
    }
  if (all.length < 60) return getUnsolvedSpec(`유효 격자점이 부족합니다 (${all.length}개).`);

  // 격자 간격에 맞춘 서브샘플 (약 700점 / 2600점)
  const thin = (target: number) => {
    const step = Math.max(1, Math.round(Math.sqrt(all.length / target)));
    const li = new Map(loads.map((v, i) => [v, i]));
    const ti = new Map(tunes.map((v, i) => [v, i]));
    return all.filter((s) => li.get(s.l)! % step === 0 && ti.get(s.t)! % step === 0);
  };
  const coarse = thin(700);
  const fine = thin(2600);

  const mode: 'rating' | 'vfc' = o.knownLoadVfcPf !== undefined && o.knownLoadVfcPf >= 0 ? 'vfc' : 'rating';
  const tuneVfc = Math.max(0, o.tuneVfcPf ?? 0);
  const anchor = o.tuneProfile.max * o.tuneProfile.count + tuneVfc; // Tune 브랜치 총 용량 100% 지점 (VVC 최대 × 수량 + VFC)
  const tMinRated = o.tuneProfile.min * o.tuneProfile.count + tuneVfc;
  const ratedAt = (pct: number) => tMinRated + ((anchor - tMinRated) * pct) / 100;
  const lMinRated = o.loadProfile.min * o.loadProfile.count;

  const knotKeys = TUNE_KNOTS.slice(0, -1).map((_, i) => 'k' + i);
  const loadKeys = mode === 'rating' ? ['vfcL'] : ['lMin'];
  const keys = ['lsh', 'lse', 'rloss', 'cOut', ...loadKeys, ...knotKeys];
  const baseKeys = ['lsh', 'lse', 'rloss', ...loadKeys];

  const makeInit = (lse: number, cOut: number): Vec => {
    const v: Vec = { lsh: 80, lse, rloss: 0.05, cOut, vfcL: 300, lMin: lMinRated };
    TUNE_KNOTS.slice(0, -1).forEach((pct, i) => (v['k' + i] = ratedAt(pct)));
    return v;
  };

  // 1) 다중 시작점 × CTCL 기준(zout/zload) — coarse 격자
  let best: { conv: 'zout' | 'zload'; res: LmResult } | null = null;
  for (const conv of ['zout', 'zload'] as const) {
    for (const lse of [180, 300]) {
      for (const cOut of [5, 25]) {
        const res = lm(makeInit(lse, cOut), keys, coarse, conv, o, mode, true, 80);
        if (!best || res.cost < best.res.cost) best = { conv, res };
      }
    }
  }
  const conv = best!.conv;
  // 2) fine 격자에서 재정밀화
  const fit = lm(best!.res.v, keys, fine, conv, o, mode, true, 150);
  const v = fit.v;
  const met = metrics(v, all, conv, o, mode, true);

  // 기존 방식 비교 (같은 정격, 직선 곡선, 기생 C 없음)
  const baseFit = lm(makeInit(180, 0), baseKeys, coarse, conv, o, mode, false, 80);
  const baseMet = metrics(baseFit.v, all, conv, o, mode, false);

  // 3) 불확도 (1σ) 및 강상관 쌍
  const unc: ParamUncertainty = {};
  const degeneratePairs: string[] = [];
  const cov = invert(fit.jtj.map((row, i) => row.map((x, j) => x + (i === j ? 1e-12 : 0))));
  const dof = Math.max(1, fine.length * 2 - keys.length);
  const s2 = fit.cost / dof;
  const sdOf = (k: string) => {
    const i = keys.indexOf(k);
    if (!cov || i < 0 || !(cov[i][i] > 0)) return undefined;
    return v[k] * Math.sqrt(cov[i][i] * s2);
  };
  unc.lShuntNh = sdOf('lsh');
  unc.lSeriesNh = sdOf('lse');
  unc.rLossOhm = sdOf('rloss');
  if (mode === 'rating') unc.cLoad0Pf = sdOf('vfcL');
  const cOutSd = sdOf('cOut');
  if (cov) {
    const named: Record<string, string> = { lsh: 'Shunt L', lse: 'Series L', vfcL: 'Load VFC', lMin: 'Load VVC 최소', cOut: '출력 기생 C' };
    const ks = Object.keys(named).filter((k) => keys.includes(k));
    for (let a = 0; a < ks.length; a++)
      for (let b = a + 1; b < ks.length; b++) {
        const i = keys.indexOf(ks[a]);
        const j = keys.indexOf(ks[b]);
        const corr = cov[i][j] / Math.sqrt(cov[i][i] * cov[j][j]);
        if (Math.abs(corr) > 0.98) degeneratePairs.push(`${named[ks[a]]}↔${named[ks[b]]}`);
      }
  }

  const { lMin, lMax, vfcL } = buildModel(v, o, mode, true);
  const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  const tuneCurve = TUNE_KNOTS.map((pct, i) => ({
    pct,
    totalPf: round(i === TUNE_KNOTS.length - 1 ? anchor : v['k' + i], 1),
    ratedPf: round(ratedAt(pct), 1),
  }));
  const tuneLo = Math.min(...tuneCurve.map((p) => p.totalPf));

  const warn: string[] = [];
  if (met.r2 < 0.995) warn.push(`R²=${(met.r2 * 100).toFixed(2)}%: 정밀 보정 후에도 설명되지 않는 오차가 있습니다.`);
  if (degeneratePairs.length) warn.push(`분리가 어려운 쌍: ${degeneratePairs.join(', ')}`);
  if (mode === 'rating' && vfcL < 5) warn.push('Load VFC가 0에 가깝게 나왔습니다. Load VVC 정격이 실제보다 크게 선택됐을 수 있습니다.');
  if (tuneLo - tuneVfc < 0)
    warn.push(
      `입력한 Tune VFC(${round(tuneVfc, 0)} pF)가 Tune 0% 지점의 총 용량(${round(tuneLo, 0)} pF)보다 큽니다. Tune VFC 값을 확인하세요.`
    );
  if (mode === 'vfc' && lMin < 0)
    warn.push('입력한 Load VFC가 너무 커서 Load VVC 최소 용량이 음수로 나옵니다. Load VFC 값을 확인하세요.');
  if (mode === 'vfc' && lMin > lMax * 0.9) warn.push('입력한 Load VFC로는 Load VVC 최소 용량이 비정상적으로 큽니다. VFC 값을 확인하세요.');
  for (let i = 1; i < tuneCurve.length; i++)
    if (tuneCurve[i].totalPf < tuneCurve[i - 1].totalPf) {
      warn.push('학습된 Tune 곡선이 단조 증가하지 않는 구간이 있습니다. CTCL 데이터 이상 여부를 확인하세요.');
      break;
    }

  const spec: MatcherSolvedSpec = {
    frequencyMhz: 13.56,
    omega: 2 * Math.PI * 13.56e6,

    shuntInductorNh: round(v.lsh),
    loadVvcMinPf: round(lMin / o.loadProfile.count, 0),
    loadVvcMaxPf: o.loadProfile.max,
    loadVvcCount: o.loadProfile.count,
    loadVfcPf: round(vfcL, 0),
    loadVfcDesc: mode === 'vfc' ? `${round(vfcL, 0)} pF (입력값)` : `≈ ${round(vfcL, 0)} pF (VFC + 기생 용량, 피팅값)`,
    loadTotalMinPf: round(vfcL + lMin, 0),
    loadTotalMaxPf: round(vfcL + lMax, 0),

    seriesInductorNh: round(v.lse),
    tuneVvcMinPf: round((tuneLo - tuneVfc) / o.tuneProfile.count, 0),
    tuneVvcMaxPf: o.tuneProfile.max,
    tuneVvcCount: o.tuneProfile.count,
    tuneVfcPf: round(tuneVfc, 0),
    tuneVfcDesc: tuneVfc > 0 ? `${round(tuneVfc, 0)} pF (입력값)` : '미장착 (0 pF)',
    tuneTotalMinPf: round(tuneLo, 0),
    tuneTotalMaxPf: round(anchor, 0),

    rmse: round(met.rmse, 3),
    fitConfidence: round(Math.max(0, met.r2) * 100, 3),
    samplePointsUsed: all.length,
    matcherModelName: 'L-Type Vacuum Matcher (정밀 보정: 출력 기생 C + Tune VVC 실측 곡선)',

    solved: true,
    message: warn.length ? warn.join(' / ') : '정상 수렴',
    convention: conv,
    conventionRmse: { zout: conv === 'zout' ? met.rmse : null, zload: conv === 'zload' ? met.rmse : null },
    vvcCurve: 'linear',
    vvcTables: {
      load: { points: [{ pct: 0, pf: lMin }, { pct: 100, pf: lMax }], count: 1, label: o.loadProfile.label },
      tune: { points: tuneCurve.map((p) => ({ pct: p.pct, pf: p.totalPf })), count: 1, label: `${o.tuneProfile.label} (실측 곡선)` },
    },
    params: buildModel(v, o, mode, true).prm,
    uncertainty: unc,
    degeneratePairs,
    rmseR: round(met.rmseR, 3),
    rmseX: round(met.rmseX, 3),
    maxAbsError: round(met.maxAbs, 3),
    loadDecompositionCandidates: [],
    tuneDecompositionCandidates: [],
    positionRange: { loadMin: lMinP, loadMax: lMaxP, tuneMin: tMinP, tuneMax: tMaxP },
    precision: {
      cOutPf: round(v.cOut, 1),
      cOutSd: cOutSd !== undefined ? round(cOutSd, 2) : undefined,
      tuneAnchorPf: anchor,
      tuneCurve,
      loadMode: mode,
      loadVvcMinFitPf: round(lMin, 0),
      loadVvcMaxPf: lMax,
      baseline: { r2: round(Math.max(0, baseMet.r2) * 100, 2), rmse: round(baseMet.rmse, 2) },
    },
  };
  return spec;
}
