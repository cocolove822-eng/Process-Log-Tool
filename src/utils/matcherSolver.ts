import { ComplexNumber, CTCLMatrixData } from '../types/pecvd';

/**
 * ============================================================================
 * matcherSolver.ts — CTCL Matrix 기반 L-Type RF Matcher 소자값 역산출 (v2)
 * ============================================================================
 *
 * [회로 모델]  RFG(50Ω) ─┬─ [Tune VVC(+VFC)] ─ [Series L] ─ (+R_loss) ─▶ Output(Chamber)
 *                        │
 *                  [Load VVC ∥ Load VFC]
 *                        │
 *                   [Shunt L]
 *                        │
 *                       GND
 *
 * [CTCL 데이터 기준 (convention)]
 *  - 'zout'  : 출력단에서 매처 쪽(50Ω 소스 포함)을 바라본 임피던스
 *              Z_out = R_loss + jX_se(T) + (jX_sh(L) ∥ 50)
 *              → 해당 Load/Tune 위치에서 정합되는 부하는 Z_L = conj(Z_out)
 *  - 'zload' : 정합되는 부하 임피던스 자체 (= conj(Z_out))
 *  - 'auto'  : 두 기준으로 모두 피팅해서 RMSE가 낮은 쪽을 자동 선택 (기본값)
 *
 * [VVC 용량 곡선 모델]  p = 정규화 모터 위치 (0~1)
 *  - 'linear'    : C(p) = C0 + (C100 − C0)·p
 *  - 'quadratic' : C(p) = C0 + (C100 − C0)·p + Bow·4p(1−p)   (Bow = 50% 지점의 선형 대비 편차, pF)
 *  - C0 / C100은 해당 브랜치의 "총 용량"(VVC×n + VFC)이고, 기생 용량도 함께 포함됩니다.
 *
 * [피팅 방식]
 *  - 전체 격자에 대한 복소 잔차(ΔR, ΔX) 최소제곱 → Levenberg–Marquardt
 *  - 양수 파라미터(L, C, R_loss)는 log 공간에서 최적화 (부호 반전 방지)
 *  - 다중 시작점(Multi-start)을 서브샘플 격자로 돌린 뒤, 최적해를 전체 격자로 재정밀화
 *  - 하드코딩된 정답 보정, 스냅(snap), 신뢰도 하한 같은 처리는 하지 않습니다.
 *    피팅 결과와 오차를 있는 그대로 보고합니다.
 *
 * [주의]
 *  - Series L 피팅값에는 출력 스트랩/배선의 기생 인덕턴스가 합쳐져 나옵니다.
 *    (회로도의 Series Inductor 단품 값보다 크게 나오는 것이 정상일 수 있음)
 *  - VVC 상용 정격(VVC/VFC) 분해는 "피팅된 총 용량 범위를 가장 잘 설명하는 조합 후보"이며,
 *    불일치량(mismatch)을 함께 보고합니다. 최종 판단은 회로도/BOM과 대조해야 합니다.
 */

// ============================================================================
// 공개 타입
// ============================================================================

export type CtclConvention = 'auto' | 'zout' | 'zload';
export type VvcCurveModel = 'linear' | 'quadratic';

/** 피팅되는 물리 파라미터 (자연 단위) */
export interface MatcherModelParams {
  lShuntNh: number; // Shunt 인덕터 (nH)
  lSeriesNh: number; // Series 인덕터 + 출력 기생 L (nH)
  cLoad0Pf: number; // Load 0% 위치의 Load 브랜치 총 용량 (pF)
  cLoad100Pf: number; // Load 100% 위치의 Load 브랜치 총 용량 (pF)
  cLoadBowPf: number; // Load 곡선 2차 편차 (pF, linear 모델이면 0)
  cTune0Pf: number; // Tune 0% 위치의 Tune 브랜치 총 용량 (pF)
  cTune100Pf: number; // Tune 100% 위치의 Tune 브랜치 총 용량 (pF)
  cTuneBowPf: number; // Tune 곡선 2차 편차 (pF)
  rLossOhm: number; // 직렬 등가 손실 저항 (Ω)
  cOutPf?: number; // 출력단(Chamber 쪽) 대지 기생 용량 (pF) — 정밀 보정 모드에서만 사용, 없으면 0
}

/** 사용자가 알고 있는 값을 고정하고 나머지만 피팅할 때 사용 */
export type FixedParams = Partial<MatcherModelParams>;

export interface SolverOptions {
  convention?: CtclConvention; // 기본 'auto'
  vvcCurve?: VvcCurveModel; // 기본 'quadratic'
  includeLoss?: boolean; // 직렬 손실 저항 피팅 여부, 기본 true
  fixed?: FixedParams; // 고정값 (예: { lShuntNh: 70 })
  rWeight?: number; // R 잔차 가중치 (기본 1). R 정보가 X에 묻히면 3~10으로 올려볼 것
  excludeNegativeR?: boolean; // R < 0 측정 노이즈 제외 여부, 기본 false
  maxIterations?: number; // LM 최대 반복 (기본 200)
  vvcLibrary?: VvcProfile[]; // VVC 정격 라이브러리 (기본 STANDARD_VVC_PROFILES)
  /**
   * [권장] VVC 위치(%) → 용량(pF) 테이블. 제조사 데이터시트 또는 매처 Cap Position Cal 값.
   * 지정하면 해당 브랜치는 곡선 형상이 고정되고, 오프셋(VFC + 기생 용량)과 인덕터만 피팅합니다.
   * → CTCL만으로는 분리되지 않는 L ↔ C 상관 문제를 해결하는 가장 확실한 방법.
   */
  loadVvcTable?: VvcTable;
  tuneVvcTable?: VvcTable;
}

/** VVC 1EA의 위치-용량 테이블 (pct 오름차순, 최소 2점) */
export interface VvcTable {
  points: { pct: number; pf: number }[]; // pct: 0~100 (CTCL Load/Tune 축과 같은 정규화)
  count: number; // 병렬 장착 수량
  label?: string; // 예: 'Comet CV1C-1000 × 1EA'
}

/** 순방향 모델 계산에 필요한 고정 정보 */
export interface ModelContext {
  loadTable?: VvcTable;
  tuneTable?: VvcTable;
}

export interface VvcProfile {
  min: number; // pF (1EA 기준)
  max: number; // pF (1EA 기준)
  count: number; // 병렬 수량
  label: string;
}

/** 파라미터별 피팅 불확도 (1σ, 자연 단위) */
export type ParamUncertainty = Partial<Record<keyof MatcherModelParams, number>>;

export interface CapacitorDecomposition {
  vvcMinPf: number;
  vvcMaxPf: number;
  vvcCount: number;
  vvcLabel: string;
  vfcPf: number; // 병렬 고정 용량 추정치 (기생 용량 포함)
  vfcDesc: string;
  mismatchPf: number; // 이 조합으로 설명되지 않는 상단 용량 차이 (pF)
  plausible: boolean; // VFC ≥ 0 이고 mismatch가 범위의 10% 이내인지 여부
}

/**
 * 역산출된 매쳐 최종 물리 사양 인터페이스
 * (기존 필드명은 UI 호환을 위해 그대로 유지, 확장 필드는 하단에 추가)
 */
export interface MatcherSolvedSpec {
  frequencyMhz: number;
  omega: number;

  // Shunt 브랜치 (Load부)
  shuntInductorNh: number;
  loadVvcMinPf: number;
  loadVvcMaxPf: number;
  loadVvcCount: number;
  loadVfcPf: number;
  loadVfcDesc: string;
  loadTotalMinPf: number; // 피팅된 Load 브랜치 총 용량 최소
  loadTotalMaxPf: number; // 피팅된 Load 브랜치 총 용량 최대

  // Series 브랜치 (Tune부)
  seriesInductorNh: number;
  tuneVvcMinPf: number;
  tuneVvcMaxPf: number;
  tuneVvcCount: number;
  tuneVfcPf: number;
  tuneVfcDesc: string;
  tuneTotalMinPf: number;
  tuneTotalMaxPf: number;

  // 모델 피팅 품질 메트릭
  rmse: number; // 복소 RMSE = sqrt(mean(ΔR² + ΔX²)) (Ω)
  fitConfidence: number; // 복소 결정계수 R² × 100 (%) — 하한 보정 없음
  samplePointsUsed: number;
  matcherModelName: string;

  // ---- v2 확장 필드 ----
  solved: boolean; // false면 데이터 부족 등으로 역산 실패 (아래 값은 의미 없음)
  message: string; // 상태/경고 메시지
  convention: 'zout' | 'zload'; // 실제 채택된 CTCL 기준
  conventionRmse: { zout: number | null; zload: number | null };
  vvcCurve: VvcCurveModel;
  vvcTables: { load?: VvcTable; tune?: VvcTable }; // 테이블 모드일 때 사용된 테이블
  params: MatcherModelParams; // 피팅된 원시 파라미터 (forward 계산에 사용)
  // ※ 테이블 모드에서 cLoad0Pf / cTune0Pf 는 "VFC + 기생 용량 오프셋"을 의미
  uncertainty: ParamUncertainty; // 1σ 불확도
  degeneratePairs: string[]; // CTCL만으로 분리 불가한 파라미터 쌍 (|corr| > 0.98)
  rmseR: number; // R 성분 RMSE (Ω)
  rmseX: number; // X 성분 RMSE (Ω)
  maxAbsError: number; // 최대 복소 오차 크기 (Ω)
  loadDecompositionCandidates: CapacitorDecomposition[]; // 상위 3개 후보
  tuneDecompositionCandidates: CapacitorDecomposition[];
  positionRange: { loadMin: number; loadMax: number; tuneMin: number; tuneMax: number };
  precision?: import('./matcherPrecisionFit').PrecisionInfo; // 정밀 보정 모드 결과 (출력 기생 C, Tune 실측 곡선 등)
}

/** 특정 Load %, Tune %에서의 순간 소자값 상태 */
export interface InstantaneousMatcherState {
  loadPercent: number;
  tunePercent: number;
  currentLoadVvcPf: number; // VVC 1EA당 용량
  currentLoadTotalPf: number; // Load 브랜치 총 용량
  currentTuneVvcPf: number;
  currentTuneTotalPf: number;
  calcZ: ComplexNumber; // CTCL과 동일한 기준(convention)으로 계산된 임피던스
}

/** 격자 각 점의 잔차 (히트맵 표시용) */
export interface ResidualPoint {
  l: number;
  t: number;
  measR: number;
  measX: number;
  calcR: number;
  calcX: number;
  errAbs: number; // |Z_calc − Z_meas| (Ω)
}

// ============================================================================
// 상수
// ============================================================================

const RF_FREQ_HZ = 13.56e6;
const OMEGA = 2 * Math.PI * RF_FREQ_HZ; // ≈ 8.5200e7 rad/s
const Z0 = 50;
const C_MAX_PF = 20000; // 브랜치 총 용량 상한 (발산 방지)

/** 상용 VVC 정격 라이브러리 (필요 시 options.vvcLibrary로 교체) */
export const STANDARD_VVC_PROFILES: VvcProfile[] = [
  { min: 50, max: 500, count: 1, label: '50~500pF × 1EA' },
  { min: 50, max: 500, count: 2, label: '50~500pF × 2EA' },
  { min: 100, max: 1000, count: 1, label: '100~1000pF × 1EA' },
  { min: 100, max: 1000, count: 2, label: '100~1000pF × 2EA' },
  { min: 20, max: 200, count: 1, label: '20~200pF × 1EA' },
  { min: 25, max: 500, count: 1, label: '25~500pF × 1EA' },
  { min: 25, max: 1000, count: 1, label: '25~1000pF × 1EA' },
];

const PARAM_KEYS: (keyof MatcherModelParams)[] = [
  'lShuntNh',
  'lSeriesNh',
  'cLoad0Pf',
  'cLoad100Pf',
  'cLoadBowPf',
  'cTune0Pf',
  'cTune100Pf',
  'cTuneBowPf',
  'rLossOhm',
];

/** log 공간에서 최적화하는 양수 파라미터 */
const POSITIVE_KEYS = new Set<keyof MatcherModelParams>([
  'lShuntNh',
  'lSeriesNh',
  'cLoad0Pf',
  'cLoad100Pf',
  'cTune0Pf',
  'cTune100Pf',
  'rLossOhm',
]);

// ============================================================================
// 내부 데이터 구조
// ============================================================================

interface Sample {
  l: number; // 원래 Load 좌표
  t: number; // 원래 Tune 좌표
  pL: number; // 정규화 0~1
  pT: number;
  r: number;
  x: number;
}

interface FitResult {
  params: MatcherModelParams;
  cost: number; // Σ 가중 잔차²
  jtj: number[][] | null; // 최종 JᵀJ (transformed space)
  freeKeys: (keyof MatcherModelParams)[];
  theta: number[];
}

// ============================================================================
// 순방향 모델 (Forward Model)
// ============================================================================

/** 정규화 위치 p(0~1)에서 브랜치 총 용량 (pF) — 해석식 곡선 */
function capAt(c0: number, c100: number, bow: number, p: number): number {
  return c0 + (c100 - c0) * p + bow * 4 * p * (1 - p);
}

/** VVC 테이블 선형 보간 (pct: 0~100) → VVC 1EA 용량 (pF) */
function interpTable(tbl: VvcTable, pct: number): number {
  const pts = tbl.points;
  if (pct <= pts[0].pct) return pts[0].pf;
  if (pct >= pts[pts.length - 1].pct) return pts[pts.length - 1].pf;
  for (let i = 1; i < pts.length; i++) {
    if (pct <= pts[i].pct) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.pf + ((b.pf - a.pf) * (pct - a.pct)) / (b.pct - a.pct || 1);
    }
  }
  return pts[pts.length - 1].pf;
}

/**
 * Load 브랜치 총 용량 (pF)
 * - 테이블 모드: C = cLoad0Pf(= VFC + 기생 오프셋) + count × VVC_table(p)
 * - 해석식 모드: capAt(cLoad0Pf, cLoad100Pf, cLoadBowPf, p)
 */
function loadCap(prm: MatcherModelParams, p: number, ctx: ModelContext): number {
  return ctx.loadTable
    ? prm.cLoad0Pf + ctx.loadTable.count * interpTable(ctx.loadTable, p * 100)
    : capAt(prm.cLoad0Pf, prm.cLoad100Pf, prm.cLoadBowPf, p);
}

/** Tune 브랜치 총 용량 (pF) — 규칙은 loadCap과 동일 */
function tuneCap(prm: MatcherModelParams, p: number, ctx: ModelContext): number {
  return ctx.tuneTable
    ? prm.cTune0Pf + ctx.tuneTable.count * interpTable(ctx.tuneTable, p * 100)
    : capAt(prm.cTune0Pf, prm.cTune100Pf, prm.cTuneBowPf, p);
}

/**
 * 파라미터 + 정규화 위치 → 임피던스 (CTCL과 같은 기준)
 * 물리적으로 불가능한 값(용량 ≤ 0)이면 null
 */
export function forwardZ(
  prm: MatcherModelParams,
  pL: number,
  pT: number,
  convention: 'zout' | 'zload',
  ctx: ModelContext
): ComplexNumber | null {
  const cL = loadCap(prm, pL, ctx);
  const cT = tuneCap(prm, pT, ctx);
  // 물리적 범위 밖(곡선이 음수로 꺾이거나 비현실적으로 커지는 경우)은 무효 처리
  if (!(cL > 0.1 && cL < C_MAX_PF) || !(cT > 0.1 && cT < C_MAX_PF)) return null;

  const xSh = OMEGA * prm.lShuntNh * 1e-9 - 1 / (OMEGA * cL * 1e-12);
  const xSe = OMEGA * prm.lSeriesNh * 1e-9 - 1 / (OMEGA * cT * 1e-12);

  // (jX_sh ∥ 50) = (50·X² + j·2500·X) / (2500 + X²)
  const d = Z0 * Z0 + xSh * xSh;
  const rP = (Z0 * xSh * xSh) / d;
  const xP = (Z0 * Z0 * xSh) / d;

  let r = prm.rLossOhm + rP;
  let xOut = xSe + xP;

  // 출력단 기생 용량: Z' = Z ∥ (1 / jωC_out)
  const cOut = prm.cOutPf ?? 0;
  if (cOut > 0) {
    const d2 = r * r + xOut * xOut;
    const yr = r / d2;
    const yi = -xOut / d2 + OMEGA * cOut * 1e-12;
    const e = yr * yr + yi * yi;
    r = yr / e;
    xOut = -yi / e;
  }
  return { r, x: convention === 'zout' ? xOut : -xOut };
}

// ============================================================================
// 파라미터 변환 (자연 단위 ↔ 최적화 공간)
// ============================================================================

function toTheta(prm: MatcherModelParams, keys: (keyof MatcherModelParams)[]): number[] {
  return keys.map((k) => (POSITIVE_KEYS.has(k) ? Math.log(Math.max(prm[k] ?? 0, 1e-6)) : (prm[k] ?? 0)));
}

function fromTheta(
  theta: number[],
  keys: (keyof MatcherModelParams)[],
  base: MatcherModelParams
): MatcherModelParams {
  const out = { ...base };
  keys.forEach((k, i) => {
    // log 파라미터는 1e-6 ~ 1e6 범위로 제한 (0으로 붕괴 시 야코비안 특이 방지)
    out[k] = POSITIVE_KEYS.has(k) ? Math.exp(Math.max(-13.8, Math.min(13.8, theta[i]))) : theta[i];
  });
  return out;
}

// ============================================================================
// 잔차 계산
// ============================================================================

const PENALTY = 1e3; // 물리적으로 불가능한 점에 대한 잔차

function residuals(
  prm: MatcherModelParams,
  samples: Sample[],
  convention: 'zout' | 'zload',
  rWeight: number,
  out: Float64Array,
  ctx: ModelContext
): number {
  let cost = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const z = forwardZ(prm, s.pL, s.pT, convention, ctx);
    let er: number;
    let ex: number;
    if (!z) {
      er = PENALTY;
      ex = PENALTY;
    } else {
      er = (z.r - s.r) * rWeight;
      ex = z.x - s.x;
    }
    out[2 * i] = er;
    out[2 * i + 1] = ex;
    cost += er * er + ex * ex;
  }
  return cost;
}

// ============================================================================
// 선형대수 유틸
// ============================================================================

/** A·x = b 를 부분 피벗 가우스 소거로 풂. 특이행렬이면 null */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-300) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
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

function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const inv: number[][] = [];
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0);
    e[j] = 1;
    const col = solveLinear(A, e);
    if (!col) return null;
    inv.push(col);
  }
  // inv[j] = j번째 열 → 전치
  return inv[0].map((_, i) => inv.map((col) => col[i]));
}

// ============================================================================
// Levenberg–Marquardt
// ============================================================================

function levenbergMarquardt(
  start: MatcherModelParams,
  freeKeys: (keyof MatcherModelParams)[],
  samples: Sample[],
  convention: 'zout' | 'zload',
  rWeight: number,
  maxIter: number,
  ctx: ModelContext
): FitResult {
  const m = samples.length * 2;
  const n = freeKeys.length;
  let theta = toTheta(start, freeKeys);
  let prm = fromTheta(theta, freeKeys, start);

  const r0 = new Float64Array(m);
  const rTmp = new Float64Array(m);
  let cost = residuals(prm, samples, convention, rWeight, r0, ctx);
  let lambda = 1e-3;
  let jtj: number[][] | null = null;

  const J: Float64Array[] = Array.from({ length: n }, () => new Float64Array(m));

  for (let iter = 0; iter < maxIter; iter++) {
    // 수치 야코비안 (전방 차분)
    for (let j = 0; j < n; j++) {
      const h = 1e-6 * Math.max(1, Math.abs(theta[j]));
      const th = theta.slice();
      th[j] += h;
      residuals(fromTheta(th, freeKeys, start), samples, convention, rWeight, rTmp, ctx);
      const col = J[j];
      for (let i = 0; i < m; i++) col[i] = (rTmp[i] - r0[i]) / h;
    }

    // JᵀJ, Jᵀr
    jtj = Array.from({ length: n }, () => new Array(n).fill(0));
    const jtr = new Array(n).fill(0);
    for (let a = 0; a < n; a++) {
      const ca = J[a];
      let s = 0;
      for (let i = 0; i < m; i++) s += ca[i] * r0[i];
      jtr[a] = s;
      for (let b = a; b < n; b++) {
        const cb = J[b];
        let t = 0;
        for (let i = 0; i < m; i++) t += ca[i] * cb[i];
        jtj[a][b] = t;
        jtj[b][a] = t;
      }
    }

    // 감쇠 계수를 바꿔가며 개선되는 스텝 탐색
    let improved = false;
    for (let tries = 0; tries < 12; tries++) {
      const A = jtj.map((row, a) => row.map((v, b) => (a === b ? v + lambda * Math.max(v, 1e-12) : v)));
      const delta = solveLinear(
        A,
        jtr.map((v) => -v)
      );
      if (!delta) {
        lambda *= 10;
        continue;
      }
      const thNew = theta.map((v, i) => v + delta[i]);
      const prmNew = fromTheta(thNew, freeKeys, start);
      const costNew = residuals(prmNew, samples, convention, rWeight, rTmp, ctx);
      if (Number.isFinite(costNew) && costNew < cost) {
        const relDrop = (cost - costNew) / Math.max(cost, 1e-30);
        theta = thNew;
        prm = prmNew;
        cost = costNew;
        r0.set(rTmp);
        lambda = Math.max(lambda / 3, 1e-12);
        improved = true;
        if (relDrop < 1e-10) iter = maxIter; // 수렴
        break;
      }
      lambda *= 4;
    }
    if (!improved) break;
  }

  return { params: prm, cost, jtj, freeKeys, theta };
}

// ============================================================================
// 피팅 오케스트레이션
// ============================================================================

function buildFreeKeys(
  opt: Required<Pick<SolverOptions, 'vvcCurve' | 'includeLoss'>>,
  fixed: FixedParams,
  ctx: ModelContext
) {
  return PARAM_KEYS.filter((k) => {
    if (fixed[k] !== undefined) return false;
    // 테이블 모드에서는 곡선 형상이 정해져 있으므로 오프셋(cXxx0Pf)만 피팅
    if (ctx.loadTable && (k === 'cLoad100Pf' || k === 'cLoadBowPf')) return false;
    if (ctx.tuneTable && (k === 'cTune100Pf' || k === 'cTuneBowPf')) return false;
    if (opt.vvcCurve === 'linear' && (k === 'cLoadBowPf' || k === 'cTuneBowPf')) return false;
    if (!opt.includeLoss && k === 'rLossOhm') return false;
    return true;
  });
}

function makeStarts(
  fixed: FixedParams,
  vvcCurve: VvcCurveModel,
  includeLoss: boolean,
  ctx: ModelContext
): MatcherModelParams[] {
  const lShs = [40, 80, 150];
  const lSes = [150, 300, 600];
  const cLs: [number, number][] = [
    [400, 1500],
    [1500, 400],
    [800, 2000],
  ];
  const cTs: [number, number][] = [
    [80, 800],
    [800, 80],
    [50, 1200],
  ];
  const starts: MatcherModelParams[] = [];
  for (const lSh of lShs)
    for (const lSe of lSes)
      for (const [cl0, cl1] of cLs)
        for (const [ct0, ct1] of cTs) {
          starts.push({
            lShuntNh: fixed.lShuntNh ?? lSh,
            lSeriesNh: fixed.lSeriesNh ?? lSe,
            cLoad0Pf: fixed.cLoad0Pf ?? (ctx.loadTable ? Math.min(cl0, cl1) / 2 : cl0),
            cLoad100Pf: fixed.cLoad100Pf ?? cl1,
            cLoadBowPf: fixed.cLoadBowPf ?? 0,
            cTune0Pf: fixed.cTune0Pf ?? (ctx.tuneTable ? 20 : ct0),
            cTune100Pf: fixed.cTune100Pf ?? ct1,
            cTuneBowPf: fixed.cTuneBowPf ?? 0,
            rLossOhm: fixed.rLossOhm ?? (includeLoss ? 0.05 : 0),
          });
        }
  void vvcCurve;
  return starts;
}

function subsample(samples: Sample[], target: number): Sample[] {
  if (samples.length <= target) return samples;
  const stride = Math.ceil(samples.length / target);
  const out: Sample[] = [];
  for (let i = 0; i < samples.length; i += stride) out.push(samples[i]);
  return out;
}

function fitConvention(
  samples: Sample[],
  convention: 'zout' | 'zload',
  vvcCurve: VvcCurveModel,
  includeLoss: boolean,
  fixed: FixedParams,
  rWeight: number,
  maxIter: number,
  ctx: ModelContext
): FitResult {
  const freeKeys = buildFreeKeys({ vvcCurve, includeLoss }, fixed, ctx);
  const coarse = subsample(samples, 1200);

  // 1단계: 선형 곡선 + 서브샘플로 다중 시작점 탐색 (빠름)
  const linearKeys = freeKeys.filter((k) => k !== 'cLoadBowPf' && k !== 'cTuneBowPf');
  let best: FitResult | null = null;
  for (const st of makeStarts(fixed, vvcCurve, includeLoss, ctx)) {
    const res = levenbergMarquardt(st, linearKeys, coarse, convention, rWeight, 60, ctx);
    if (!best || res.cost < best.cost) best = res;
  }

  // 2단계: 전체 파라미터 + 전체 격자로 정밀화
  return levenbergMarquardt(best!.params, freeKeys, samples, convention, rWeight, maxIter, ctx);
}

// ============================================================================
// 품질 지표 / 불확도
// ============================================================================

function computeMetrics(
  prm: MatcherModelParams,
  samples: Sample[],
  convention: 'zout' | 'zload',
  ctx: ModelContext
) {
  let sR = 0;
  let sX = 0;
  let maxAbs = 0;
  let meanR = 0;
  let meanX = 0;
  for (const s of samples) {
    meanR += s.r;
    meanX += s.x;
  }
  meanR /= samples.length;
  meanX /= samples.length;
  let sTot = 0;
  for (const s of samples) {
    const z = forwardZ(prm, s.pL, s.pT, convention, ctx);
    const er = z ? z.r - s.r : PENALTY;
    const ex = z ? z.x - s.x : PENALTY;
    sR += er * er;
    sX += ex * ex;
    maxAbs = Math.max(maxAbs, Math.hypot(er, ex));
    sTot += (s.r - meanR) ** 2 + (s.x - meanX) ** 2;
  }
  const n = samples.length;
  return {
    rmse: Math.sqrt((sR + sX) / n),
    rmseR: Math.sqrt(sR / n),
    rmseX: Math.sqrt(sX / n),
    maxAbs,
    r2: sTot > 0 ? 1 - (sR + sX) / sTot : 0,
  };
}

/**
 * 파라미터 1σ 불확도 + 강상관(식별 불가) 파라미터 쌍 검출
 * |상관계수| > 0.98 인 쌍은 CTCL만으로는 서로 분리가 안 된다는 뜻 (예: L_shunt ↔ C_load)
 */
function computeUncertainty(
  fit: FitResult,
  nSamples: number
): { sd: ParamUncertainty; degeneratePairs: string[] } {
  const sd: ParamUncertainty = {};
  const degeneratePairs: string[] = [];
  if (!fit.jtj) return { sd, degeneratePairs };
  const m = nSamples * 2;
  const n = fit.freeKeys.length;
  if (m <= n) return { sd, degeneratePairs };

  let cov = invertMatrix(fit.jtj);
  if (!cov) {
    // 특이행렬이면 아주 작은 ridge를 더해 근사 (강상관 파라미터 존재를 의미)
    const tr = fit.jtj.reduce((s, row, i) => s + row[i], 0) / n;
    cov = invertMatrix(fit.jtj.map((row, i) => row.map((v, j) => (i === j ? v + 1e-9 * tr : v))));
    if (!cov) return { sd, degeneratePairs };
  }
  const s2 = fit.cost / (m - n);
  fit.freeKeys.forEach((k, i) => {
    const sdTheta = Math.sqrt(Math.max(0, cov![i][i] * s2));
    // log 파라미터는 delta method: σ_nat ≈ value · σ_log
    sd[k] = POSITIVE_KEYS.has(k) ? (fit.params[k] ?? 0) * sdTheta : sdTheta;
  });
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const c = cov[i][j] / Math.sqrt(Math.max(cov[i][i] * cov[j][j], 1e-300));
      if (Math.abs(c) > 0.98) degeneratePairs.push(`${fit.freeKeys[i]}↔${fit.freeKeys[j]}`);
    }
  return { sd, degeneratePairs };
}

// ============================================================================
// VVC / VFC 분해
// ============================================================================

function decomposeCapacitance(cMinPf: number, cMaxPf: number, library: VvcProfile[]): CapacitorDecomposition[] {
  const span = Math.max(cMaxPf - cMinPf, 1);
  const cands = library.map((p) => {
    const vfc = cMinPf - p.count * p.min;
    const predictedMax = vfc + p.count * p.max;
    const mismatch = predictedMax - cMaxPf;
    const vfcR = Math.round(vfc);
    return {
      vvcMinPf: p.min,
      vvcMaxPf: p.max,
      vvcCount: p.count,
      vvcLabel: p.label,
      vfcPf: vfcR,
      vfcDesc: vfcR > 5 ? `≈ ${vfcR} pF (고정 VFC + 기생 용량)` : '미장착 (≈ 0 pF)',
      mismatchPf: Math.round(mismatch),
      plausible: vfc > -0.05 * span && Math.abs(mismatch) <= 0.1 * span,
    } as CapacitorDecomposition;
  });
  // 물리적으로 가능한 조합 우선, 그다음 mismatch 작은 순
  cands.sort((a, b) => {
    if (a.plausible !== b.plausible) return a.plausible ? -1 : 1;
    const pa = Math.abs(a.mismatchPf) + (a.vfcPf < 0 ? -a.vfcPf * 2 : 0);
    const pb = Math.abs(b.mismatchPf) + (b.vfcPf < 0 ? -b.vfcPf * 2 : 0);
    return pa - pb;
  });
  return cands.slice(0, 3);
}

/** 테이블 유효성 검사 + pct 오름차순 정렬. 무효면 undefined */
export function normalizeTable(tbl?: VvcTable): VvcTable | undefined {
  if (!tbl || !Array.isArray(tbl.points)) return undefined;
  const pts = tbl.points
    .filter((p) => Number.isFinite(p.pct) && Number.isFinite(p.pf) && p.pf > 0)
    .sort((a, b) => a.pct - b.pct);
  if (pts.length < 2 || !(tbl.count >= 1)) return undefined;
  return { points: pts, count: Math.round(tbl.count), label: tbl.label };
}

function tableDecomposition(tbl: VvcTable, offsetPf: number): CapacitorDecomposition {
  const pfs = tbl.points.map((p) => p.pf);
  const vfc = Math.round(offsetPf);
  return {
    vvcMinPf: Math.min(...pfs),
    vvcMaxPf: Math.max(...pfs),
    vvcCount: tbl.count,
    vvcLabel: tbl.label ?? `사용자 VVC 테이블 × ${tbl.count}EA`,
    vfcPf: vfc,
    vfcDesc: vfc > 5 ? `≈ ${vfc} pF (고정 VFC + 기생 용량, 피팅값)` : '미장착 (≈ 0 pF)',
    mismatchPf: 0,
    plausible: offsetPf > -5,
  };
}

// ============================================================================
// 메인: CTCL → 매처 소자값 역산출
// ============================================================================

export function solveMatcherFromCTCL(
  matrix: CTCLMatrixData | null,
  options: SolverOptions = {}
): MatcherSolvedSpec {
  const convention = options.convention ?? 'auto';
  const vvcCurve = options.vvcCurve ?? 'quadratic';
  const includeLoss = options.includeLoss ?? true;
  const fixed = options.fixed ?? {};
  const rWeight = options.rWeight ?? 1;
  const maxIter = options.maxIterations ?? 200;
  const library = options.vvcLibrary ?? STANDARD_VVC_PROFILES;
  const ctx: ModelContext = {
    loadTable: normalizeTable(options.loadVvcTable),
    tuneTable: normalizeTable(options.tuneVvcTable),
  };

  if (!matrix || matrix.loads.length < 3 || matrix.tunes.length < 3) {
    return getUnsolvedSpec('CTCL Matrix가 없거나 Load/Tune 좌표가 3개 미만입니다.');
  }

  const { loads, tunes, grid } = matrix;
  const lMin = Math.min(...loads);
  const lMax = Math.max(...loads);
  const tMin = Math.min(...tunes);
  const tMax = Math.max(...tunes);
  const lSpan = lMax - lMin || 1;
  const tSpan = tMax - tMin || 1;

  // 1. 유효 샘플 수집 (유한한 값만, R 상한 필터 없음 — 모든 측정점이 정보)
  const samples: Sample[] = [];
  for (const l of loads) {
    for (const t of tunes) {
      const pt = grid[l]?.[t];
      if (!pt || !Number.isFinite(pt.r) || !Number.isFinite(pt.x)) continue;
      if (options.excludeNegativeR && pt.r < 0) continue;
      samples.push({ l, t, pL: (l - lMin) / lSpan, pT: (t - tMin) / tSpan, r: pt.r, x: pt.x });
    }
  }

  const nFree = buildFreeKeys({ vvcCurve, includeLoss }, fixed, ctx).length;
  if (samples.length < Math.max(20, nFree * 5)) {
    return getUnsolvedSpec(`유효 격자점이 부족합니다 (${samples.length}개).`);
  }

  // 2. 기준(convention)별 피팅
  const conventions: ('zout' | 'zload')[] = convention === 'auto' ? ['zout', 'zload'] : [convention];
  const fits: { conv: 'zout' | 'zload'; fit: FitResult; rmse: number }[] = [];
  for (const conv of conventions) {
    const fit = fitConvention(samples, conv, vvcCurve, includeLoss, fixed, rWeight, maxIter, ctx);
    fits.push({ conv, fit, rmse: computeMetrics(fit.params, samples, conv, ctx).rmse });
  }
  fits.sort((a, b) => a.rmse - b.rmse);
  const chosen = fits[0];
  const prm = chosen.fit.params;

  // 3. 품질 지표 / 불확도
  const met = computeMetrics(prm, samples, chosen.conv, ctx);
  const { sd: unc, degeneratePairs } = computeUncertainty(chosen.fit, samples.length);

  // 4. 총 용량 범위 (곡선 전 구간 스캔: 2차 곡선이면 끝점이 극값이 아닐 수 있음)
  const scan = (fn: (p: number) => number) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const c = fn(i / 100);
      lo = Math.min(lo, c);
      hi = Math.max(hi, c);
    }
    return { lo, hi };
  };
  const cl = scan((p) => loadCap(prm, p, ctx));
  const ct = scan((p) => tuneCap(prm, p, ctx));

  // 5. VVC/VFC 조합 (테이블 모드면 테이블 그대로, 아니면 라이브러리 후보 탐색)
  const loadCands = ctx.loadTable
    ? [tableDecomposition(ctx.loadTable, prm.cLoad0Pf)]
    : decomposeCapacitance(cl.lo, cl.hi, library);
  const tuneCands = ctx.tuneTable
    ? [tableDecomposition(ctx.tuneTable, prm.cTune0Pf)]
    : decomposeCapacitance(ct.lo, ct.hi, library);
  const lb = loadCands[0];
  const tb = tuneCands[0];

  // 6. 경고 메시지
  const warn: string[] = [];
  if (met.r2 < 0.99) warn.push(`R²=${(met.r2 * 100).toFixed(1)}%: 모델이 데이터를 충분히 설명하지 못합니다.`);
  if (!lb.plausible) warn.push('Load 브랜치: 라이브러리 내 VVC 조합으로 용량 범위가 잘 설명되지 않습니다.');
  if (!tb.plausible) warn.push('Tune 브랜치: 라이브러리 내 VVC 조합으로 용량 범위가 잘 설명되지 않습니다.');
  const relU = (k: keyof MatcherModelParams) => (unc[k] ?? 0) / Math.max(Math.abs(prm[k] ?? 0), 1e-9);
  if (relU('lShuntNh') > 0.2 || relU('lSeriesNh') > 0.2)
    warn.push('인덕터 값의 불확도가 큽니다(>20%). 알고 있는 소자값을 options.fixed로 고정해 보세요.');
  if (degeneratePairs.length)
    warn.push(
      `CTCL만으로 분리되지 않는 파라미터 쌍: ${degeneratePairs.join(', ')} → 둘 중 하나를 회로도/BOM 값으로 고정해야 의미 있는 값이 나옵니다.`
    );
  if (cl.hi > 0.99 * C_MAX_PF || ct.hi > 0.99 * C_MAX_PF)
    warn.push('용량 곡선이 상한에 도달했습니다. 고정한 값(options.fixed)이 데이터와 맞지 않을 가능성이 큽니다.');
  if (fits.length === 2 && Math.abs(fits[0].rmse - fits[1].rmse) < 0.1 * fits[0].rmse)
    warn.push('Z_out / Z_load 기준의 피팅 품질 차이가 작습니다. 장비 CTCL 정의를 확인하세요.');

  const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

  return {
    frequencyMhz: 13.56,
    omega: OMEGA,

    shuntInductorNh: round(prm.lShuntNh),
    loadVvcMinPf: lb.vvcMinPf,
    loadVvcMaxPf: lb.vvcMaxPf,
    loadVvcCount: lb.vvcCount,
    loadVfcPf: lb.vfcPf,
    loadVfcDesc: lb.vfcDesc,
    loadTotalMinPf: round(cl.lo, 0),
    loadTotalMaxPf: round(cl.hi, 0),

    seriesInductorNh: round(prm.lSeriesNh),
    tuneVvcMinPf: tb.vvcMinPf,
    tuneVvcMaxPf: tb.vvcMaxPf,
    tuneVvcCount: tb.vvcCount,
    tuneVfcPf: tb.vfcPf,
    tuneVfcDesc: tb.vfcDesc,
    tuneTotalMinPf: round(ct.lo, 0),
    tuneTotalMaxPf: round(ct.hi, 0),

    rmse: round(met.rmse, 3),
    fitConfidence: round(Math.max(0, met.r2) * 100, 2),
    samplePointsUsed: samples.length,
    matcherModelName: `L-Type Vacuum Matcher (물리 모델 LM 피팅, ${vvcCurve === 'quadratic' ? '2차' : '선형'} VVC 곡선)`,

    solved: true,
    message: warn.length ? warn.join(' / ') : '정상 수렴',
    convention: chosen.conv,
    conventionRmse: {
      zout: fits.find((f) => f.conv === 'zout')?.rmse ?? null,
      zload: fits.find((f) => f.conv === 'zload')?.rmse ?? null,
    },
    vvcCurve,
    vvcTables: { load: ctx.loadTable, tune: ctx.tuneTable },
    params: prm,
    uncertainty: unc,
    degeneratePairs,
    rmseR: round(met.rmseR, 3),
    rmseX: round(met.rmseX, 3),
    maxAbsError: round(met.maxAbs, 3),
    loadDecompositionCandidates: loadCands,
    tuneDecompositionCandidates: tuneCands,
    positionRange: { loadMin: lMin, loadMax: lMax, tuneMin: tMin, tuneMax: tMax },
  };
}

// ============================================================================
// 슬라이더용: 특정 Load/Tune 위치의 순간 소자값 + 임피던스
// ============================================================================

export function getInstantaneousMatcherState(
  spec: MatcherSolvedSpec,
  loadPercent: number,
  tunePercent: number
): InstantaneousMatcherState {
  const pL = Math.max(0, Math.min(100, loadPercent)) / 100;
  const pT = Math.max(0, Math.min(100, tunePercent)) / 100;
  const prm = spec.params;

  const ctx: ModelContext = { loadTable: spec.vvcTables?.load, tuneTable: spec.vvcTables?.tune };
  const loadTotal = loadCap(prm, pL, ctx);
  const tuneTotal = tuneCap(prm, pT, ctx);

  const z = spec.solved ? forwardZ(prm, pL, pT, spec.convention, ctx) : null;

  return {
    loadPercent,
    tunePercent,
    currentLoadVvcPf: Math.round((loadTotal - (spec.loadVfcPf || 0)) / Math.max(1, spec.loadVvcCount || 1)),
    currentLoadTotalPf: Math.round(loadTotal),
    currentTuneVvcPf: Math.round((tuneTotal - (spec.tuneVfcPf || 0)) / Math.max(1, spec.tuneVvcCount || 1)),
    currentTuneTotalPf: Math.round(tuneTotal),
    calcZ: z ? { r: Math.round(z.r * 1000) / 1000, x: Math.round(z.x * 100) / 100 } : { r: NaN, x: NaN },
  };
}

// ============================================================================
// 검증용 유틸
// ============================================================================

/**
 * 회로도 공칭값 등 임의의 파라미터를 CTCL에 대입했을 때의 오차 평가
 * 예) evaluateParams(matrix, { lShuntNh:70, cLoad0Pf:520, cLoad100Pf:1420, cLoadBowPf:0,
 *       lSeriesNh:180, cTune0Pf:100, cTune100Pf:1000, cTuneBowPf:0, rLossOhm:0 }, 'zout')
 */
export function evaluateParams(
  matrix: CTCLMatrixData,
  params: MatcherModelParams,
  convention: 'zout' | 'zload' = 'zout',
  tables: { load?: VvcTable; tune?: VvcTable } = {}
): { rmse: number; rmseR: number; rmseX: number; maxAbsError: number; r2: number } {
  const samples = buildSamples(matrix);
  const ctx: ModelContext = { loadTable: normalizeTable(tables.load), tuneTable: normalizeTable(tables.tune) };
  const m = computeMetrics(params, samples, convention, ctx);
  return { rmse: m.rmse, rmseR: m.rmseR, rmseX: m.rmseX, maxAbsError: m.maxAbs, r2: m.r2 };
}

/** 격자 전체 잔차 맵 (오차 히트맵 표시용) */
export function computeResidualGrid(matrix: CTCLMatrixData, spec: MatcherSolvedSpec): ResidualPoint[] {
  if (!spec.solved) return [];
  return buildSamples(matrix).map((s) => {
    const ctx: ModelContext = { loadTable: spec.vvcTables?.load, tuneTable: spec.vvcTables?.tune };
    const z = forwardZ(spec.params, s.pL, s.pT, spec.convention, ctx);
    const cr = z ? z.r : NaN;
    const cx = z ? z.x : NaN;
    return { l: s.l, t: s.t, measR: s.r, measX: s.x, calcR: cr, calcX: cx, errAbs: Math.hypot(cr - s.r, cx - s.x) };
  });
}

function buildSamples(matrix: CTCLMatrixData): Sample[] {
  const { loads, tunes, grid } = matrix;
  const lMin = Math.min(...loads);
  const lMax = Math.max(...loads);
  const tMin = Math.min(...tunes);
  const tMax = Math.max(...tunes);
  const out: Sample[] = [];
  for (const l of loads)
    for (const t of tunes) {
      const pt = grid[l]?.[t];
      if (!pt || !Number.isFinite(pt.r) || !Number.isFinite(pt.x)) continue;
      out.push({
        l,
        t,
        pL: (l - lMin) / (lMax - lMin || 1),
        pT: (t - tMin) / (tMax - tMin || 1),
        r: pt.r,
        x: pt.x,
      });
    }
  return out;
}

// ============================================================================
// 역산 실패 시 반환값 (가짜 정답을 넣지 않음)
// ============================================================================

export function getUnsolvedSpec(message: string): MatcherSolvedSpec {
  const zeroParams: MatcherModelParams = {
    lShuntNh: 0,
    lSeriesNh: 0,
    cLoad0Pf: 0,
    cLoad100Pf: 0,
    cLoadBowPf: 0,
    cTune0Pf: 0,
    cTune100Pf: 0,
    cTuneBowPf: 0,
    rLossOhm: 0,
  };
  return {
    frequencyMhz: 13.56,
    omega: OMEGA,
    shuntInductorNh: NaN,
    loadVvcMinPf: NaN,
    loadVvcMaxPf: NaN,
    loadVvcCount: 0,
    loadVfcPf: NaN,
    loadVfcDesc: '-',
    loadTotalMinPf: NaN,
    loadTotalMaxPf: NaN,
    seriesInductorNh: NaN,
    tuneVvcMinPf: NaN,
    tuneVvcMaxPf: NaN,
    tuneVvcCount: 0,
    tuneVfcPf: NaN,
    tuneVfcDesc: '-',
    tuneTotalMinPf: NaN,
    tuneTotalMaxPf: NaN,
    rmse: NaN,
    fitConfidence: 0,
    samplePointsUsed: 0,
    matcherModelName: 'L-Type Vacuum Matcher (역산 불가)',
    solved: false,
    message,
    convention: 'zout',
    conventionRmse: { zout: null, zload: null },
    vvcCurve: 'linear',
    vvcTables: {},
    params: zeroParams,
    uncertainty: {},
    degeneratePairs: [],
    rmseR: NaN,
    rmseX: NaN,
    maxAbsError: NaN,
    loadDecompositionCandidates: [],
    tuneDecompositionCandidates: [],
    positionRange: { loadMin: 0, loadMax: 0, tuneMin: 0, tuneMax: 0 },
  };
}
