import {
  AnalyzerSettings,
  CTCLMatrixData,
  DelaysRow,
  DeviationRow,
  DeviationStat,
  HWControlEndRFRow,
  HWControlEndStepRow,
  HWControlStartRow,
  HWBoundaryInfo,
  HWCellStatus,
  MonitoringDataRow,
  ParsedLogFile,
  ProcessDataSetRow,
  RawLogRow,
  AnalysisFileResult,
  CriterionState,
  DepoStepCriteriaMap,
} from '../types/pecvd';
import { interpolateCTCL } from './ctclParser';

export function normalizeCriteria(
  criteria?: DepoStepCriteriaMap | ('sih4' | 'rf' | 'ar' | 'h2')[] | null
): DepoStepCriteriaMap {
  if (!criteria) {
    return { sih4: 'include', rf: 'include' };
  }
  if (Array.isArray(criteria)) {
    return {
      sih4: criteria.includes('sih4') ? 'include' : 'exclude',
      rf: criteria.includes('rf') ? 'include' : 'exclude',
    };
  }
  return {
    sih4: criteria.sih4 === 'exclude' ? 'exclude' : 'include',
    rf: criteria.rf === 'exclude' ? 'exclude' : 'include',
    ar: criteria.ar || 'ignore',
    h2: criteria.h2 || 'ignore',
  };
}

export const DEFAULT_SETTINGS: AnalyzerSettings = {
  generation: '6G',
  processChamber: 'A',
  depoGasCol: 'Pyro.SiH4',
  plGasCol: 'Pyro.H2',
  readOffsetSec: -10,
  depoStepCriteria: {
    sih4: 'include',
    rf: 'include',
  },
  rfStableTimeSec: 3.0,
  rampUpPostOffsetSec: 3.0, // Ramping Up 실제 도달 후 시작 시점 n초 (기본값: 3.0초)
  rfRampDownTimeSec: 1.0,
  rsdPreOffsetSec: 1.0, // RSD 진입 전 Time (기본값: 1.0초)
  rsdBandW: 300, // RSD 유지 판정 범위: RSD Power ± 300 W
  rfTolerancePct: 2.0,
  rfOnThresholdDepo: 300,
  rfOnThresholdPL: 500,

  // Analysis interval mode & Ramp filter
  analysisIntervalMode: 'set_reached', // 항상 'Ramping Up 실제 도달 기준' ('set_reached')
  autoFilterRamp: true, // Ramp 구간 자동 필터링 (스마트 모드, 기본값: true)

  // RF Delay Settings
  rfDelayBaseSignal: 'rfForwardAct',
  rfDelayBaseThreshold: 10,
  rfDelayTargetSignal: 'matcherVpp',
  rfDelayTargetThreshold: 1,

  // EC Criteria
  ecRfForwardWarningPct: 2.0, // 양방향 (±2%)
  ecRfForwardAlarmPct: 3.0, // 양방향 (±3%)
  ecRfReflectWarningW: 100, // 상한 (100 W)
  ecRfReflectAlarmW: 200, // 상한 (200 W)
  ecMatcherWarningPct: 2.0, // 상한 (2% - Vpp, Irms Unif.)
  ecMatcherAlarmPct: 3.0, // 상한 (3% - Vpp, Irms Unif.)
  ecVdcWarningV: 15, // 상한 (DC Bias Max−Min 15 V)
  ecVdcAlarmV: 30, // 상한 (DC Bias Max−Min 30 V)
  ecPressureWarningPct: 2.0, // 양방향 (±2%)
  ecPressureAlarmPct: 5.0, // 양방향 (±5%)
  ecPositionWarningPct: 1.0, // 상한 (T/V Position Max−Min 1%)
  ecPositionAlarmPct: 2.0, // 상한 (T/V Position Max−Min 2%)
  ecLiftSpacingWarningPct: null, // 미설정
  ecLiftSpacingAlarmPct: null, // 미설정
  ecGasWarningPct: 3.0, // 양방향 (±3%)
  ecGasAlarmPct: 5.0, // 양방향 (±5%)
  ecHeaterWarningC: 5.0, // 양방향 (±5 ℃)
  ecHeaterAlarmC: 10.0, // 양방향 (±10 ℃)
  ecDelayWarningSec: 0.3, // 상한 (0.3초 초과 Warning)
  ecDelayAlarmSec: 0.5, // 상한 (0.5초 초과 Alarm)
};

/**
 * 판정 기준 Helper
 * - 양방향: |값| >= Alarm 이면 Alarm, |값| >= Warning 이면 Warning
 * - 상한: 값 >= Alarm 이면 Alarm, 값 >= Warning 이면 Warning
 * - 미설정(null/undefined)이거나 값이 없으면 'normal'
 */
export function evaluateLevel(
  val: number | null | undefined,
  direction: 'bidirectional' | 'upper',
  warning: number | null | undefined,
  alarm: number | null | undefined
): 'normal' | 'warning' | 'alarm' {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
    return 'normal';
  }
  const compVal = direction === 'bidirectional' ? Math.abs(val) : val;

  if (alarm !== null && alarm !== undefined && compVal >= alarm) {
    return 'alarm';
  }
  if (warning !== null && warning !== undefined && compVal >= warning) {
    return 'warning';
  }
  return 'normal';
}

function getGasValue(row: RawLogRow, gasCol: string): number {
  const g = gasCol.toLowerCase().replace(/[\s._-]/g, '');
  if (g.includes('sih4')) return row.pyroSiH4;
  if (g.includes('n2o')) return row.pyroN2O;
  if (g.includes('nh3')) return row.pyroNH3;
  if (g.includes('pn2')) return row.pyroPN2;
  if (g.includes('ar')) return row.pyroAr;
  if (g.includes('h2')) return row.pyroH2;
  if (g.includes('nf3')) return row.oxyNF3;
  return (row.allValues[gasCol] as number) || 0;
}

/**
 * Row에서 'T/V Ctrl Mode'가 포함된 모든 컬럼의 값들을 리스트로 추출
 * 'T/V Ctrl Mode Set', 'T/V Ctrl Mode', 'TV Ctrl Mode' 등
 */
export function getAllTvCtrlModesFromRow(r: RawLogRow): string[] {
  const modes: string[] = [];
  const addMode = (val: string | undefined | null) => {
    if (!val) return;
    const s = String(val).trim().toUpperCase();
    if (s && !modes.includes(s)) modes.push(s);
  };

  addMode(r.tvCtrlModeSet);
  addMode(r.tvCtrlMode);

  if (r.allValues) {
    for (const [k, v] of Object.entries(r.allValues)) {
      const cleanKey = k.toLowerCase().replace(/[\s._-]/g, '');
      if (cleanKey.includes('tvctrlmode') || cleanKey.includes('t/vctrlmode') || (/t\/?v.*ctrl.*mode/i.test(k))) {
        addMode(String(v ?? ''));
      }
    }
  }
  return modes;
}

export function getTvCtrlModeFromRow(r: RawLogRow): string {
  const modes = getAllTvCtrlModesFromRow(r);
  return modes.length > 0 ? modes[0] : '';
}

/**
 * T/V가 현재 Pressure 제어 상태인지 확인
 * - 'T/V Ctrl Mode' 포함 항목이 'PRESSURE' (또는 'PRESS')인 경우
 * - 텍스트 모드가 아예 없는 경우 tvPressureSet > 0
 */
export function isTvPressureActive(r: RawLogRow): boolean {
  const modes = getAllTvCtrlModesFromRow(r);
  if (modes.length > 0) {
    return modes.some(m => m.includes('PRESS'));
  }
  return (r.tvPressureSet ?? 0) > 0;
}

/**
 * T/V가 Off (압력 제어 해제) 상태인지 확인:
 * - 'T/V Ctrl Mode'가 포함된 항목이 Pressure -> POSITION 혹은 Pressure -> OPEN으로 상태가 변경된 시점
 */
export function isTvOffOrTransitioned(r: RawLogRow): boolean {
  if (isTvPressureActive(r)) return false;
  const modes = getAllTvCtrlModesFromRow(r);
  if (modes.length > 0) {
    if (modes.some(m => m.includes('POS') || m.includes('OPEN'))) {
      return true;
    }
    return !modes.some(m => m.includes('PRESS'));
  }
  return (r.tvPressureSet ?? 0) <= 0;
}

/**
 * 비(非) 증착 스텝 여부 판정 함수:
 * 1. 배기(Pump), 가스안정화(Stable), 퍼지(Purge), 벤트(Vent), 대기(Idle/Wait)
 * 2. 플라즈마 전처리/표면처리/세정 (H2_PT, N2O_PT, NH3_PT, PT, PT1, Pre-Treatment, Treatment, Clean 등)
 * 단, 'depo' 또는 '증착'이 명시적으로 포함된 스텝은 Deposition 스텝으로 유지
 */
export function isNonDepoStep(stepName: string): boolean {
  if (!stepName) return false;
  const s = stepName.trim();
  // 1. 배기/안정화/퍼지/벤트/대기 스텝 및 Power Lift(PL) 스텝
  if (/(?:pump|pmp|stable|pre_?stable|purge|prg|vent|idle|wait|delay|\bpl\b|\bpl\d+|power_?lift|파워리프트|pin_?up|transfer|펌프|배기|안정|퍼지)/i.test(s)) {
    // 만약 스텝명에 'depo' 또는 '증착'이 명시되어 있다면 제외 대상이 아님
    if (/depo|증착/i.test(s)) {
      return false;
    }
    return true;
  }
  // 2. 플라즈마 전처리/표면처리/세정 스텝 (H2_PT, N2O_PT, PT, Pre-Treatment, Treatment, Clean 등)
  if (/(?:(?:^|[_\s-])(?:pt|pretreat|treatment|treat|clean)(?:[_\s\d-]|$)|_pt$|_pt_|^pt\b|pre_?treat|treatment|clean|전처리|표면처리|세정|세척)/i.test(s)) {
    // 만약 스텝명에 'depo' 또는 '증착'이 명시되어 있다면 전처리 제외 대상이 아님
    if (/depo|증착/i.test(s)) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * RF 플라즈마 방전 스텝 여부 판정 함수
 */
export function isStepRfRows(stepRows: RawLogRow[]): boolean {
  if (stepRows.length === 0) return false;
  const hasRfSignal = stepRows.some(r => {
    const setVal = Math.max(r.rfForwardSetValue ?? 0, r.rfForwardSetValueAct ?? 0);
    const onFlag = (r.rfOn ?? '').trim().toLowerCase();
    return setVal > 0 || onFlag === 'on' || onFlag === '1';
  });
  if (hasRfSignal) return true;

  // 잔류 플라즈마 감쇄(처음 1~2개 행의 일시적 방전 잔여) 제외:
  // 스텝 시작 2행 이후에도 50W 이상 유의미한 전력이 3행 이상 지속되는 경우만 RF 스텝으로 판정
  const sustainedActRows = stepRows.filter((r, idx) => idx >= 2 && (r.rfForwardPowerAct ?? 0) >= 50);
  return sustainedActRows.length >= 3;
}

/**
 * Detect all Deposition / Plasma steps in a log file using 사용자 선택 조건 알고리즘 (SiH4 Gas, RF Power, Ar Gas)
 * 기본값: SiH4 Gas + RF Power 동시 만족 (일반 증착 Depo Step)
 * SiH4 제외 + RF 포함: SiH4 미공급 & RF 플라즈마 방전 스텝 (PowerLift Step 9, 10, 11 등)
 */
/**
 * Step의 대표 이름: 그 Step 행들에서 가장 많이 쓰인 StepName (같으면 먼저 나온 이름)
 * - 장비가 Step 전환 순간 다음 Step 이름을 0.1초 먼저 기록하는 경우가 있어,
 *   경계의 한두 줄 이름 때문에 Step 전체 판정이 바뀌지 않도록 대표 이름으로 판정
 */
export function stepDominantName(stepRows: RawLogRow[]): string {
  const cnt = new Map<string, number>();
  for (const r of stepRows) {
    const n = (r.stepName || '').trim();
    if (n) cnt.set(n, (cnt.get(n) ?? 0) + 1);
  }
  let best = '';
  let bestN = 0;
  cnt.forEach((n, name) => {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  });
  return best;
}

export function detectAllDepoSteps(
  file: ParsedLogFile,
  settings: AnalyzerSettings
): number[] {
  const rows = file.rows;
  if (!rows || rows.length === 0) return [3];

  const criteria = normalizeCriteria(settings.depoStepCriteria);

  const allSteps = Array.from(new Set(rows.map(r => r.step))).sort((a, b) => a - b);
  const depoSteps: number[] = [];

  // RF 방전 행 판정 (Depo Step 판정 공통)
  //  - RF 명령: Fwd Set > 0, Fwd Set(Act) > 0, 또는 RF On = On/1
  //  - 실제 방전: Fwd Act ≥ 50W
  //  - 로그에 RF 명령 열이 없으면 Act만, Act 열이 없으면 명령만으로 판단
  const rfCmdOf = (r: RawLogRow) =>
    (r.rfForwardSetValue ?? 0) > 0 ||
    (r.rfForwardSetValueAct ?? 0) > 0 ||
    (r.rfOn ?? '').trim().toLowerCase() === 'on' ||
    (r.rfOn ?? '').trim() === '1';
  const hasRfCmdInFile = rows.some(rfCmdOf);
  const hasRfActInFile = rows.some(r => (r.rfForwardPowerAct ?? 0) > 0);
  const isRfDischargeRow = (r: RawLogRow) => {
    if (!hasRfActInFile) return rfCmdOf(r);
    return (r.rfForwardPowerAct ?? 0) >= 50 && (!hasRfCmdInFile || rfCmdOf(r));
  };

  // 실제 RF 방전 Step: 방전 행이 1초(10행) 이상 또는 Step 행 수의 30% 이상
  //  (대체 규칙에도 같은 기준 적용 → 앞 Step의 RF Set 값만 남은 Step은 후보가 되지 않음)
  const hasRealDischarge = (stepRows: RawLogRow[]) => {
    const cnt = stepRows.filter(isRfDischargeRow).length;
    return cnt >= 10 || (cnt > 0 && cnt >= stepRows.length * 0.3);
  };

  // 사용자가 SiH4를 필수로 포함하는 일반 증착(Deposition) 스텝을 검색 중인지 여부
  const isStandardDepoSearch = criteria.sih4 === 'include';

  for (const stepNum of allSteps) {
    const stepRows = rows.filter(r => r.step === stepNum);
    if (stepRows.length === 0) continue;

    // 0. Step Name & Spacing 기반 비(非)Depo 스텝 필터링
    // SiH4를 필수로 포함하는 일반 증착(Deposition) 스텝 검색 시에만:
    // Pump, Purge, Stable, PL(Power Lift), Transfer, Spacing >= 3500을 제외합니다.
    // 반대로 SiH4를 '제외(exclude)'로 설정한 경우, 사용자는 PowerLift(PL, Steps 9, 10, 11) 등
    // SiH4가 공급되지 않는 RF 플라즈마 방전 스텝 분석을 명시적으로 요구하는 것이므로 PL/고간격 제외 필터를 해제합니다.
    if (isStandardDepoSearch) {
      // 대표 이름(가장 많이 쓰인 이름) 기준: 경계에 섞인 다음/이전 Step 이름 한 줄로 제외되지 않게
      const hasNonDepoName = isNonDepoStep(stepDominantName(stepRows));
      if (hasNonDepoName) {
        continue; // 배기(Pump), 가스 안정화(Stable), 퍼지(Purge), 파워리프트(PL), 플라즈마 전처리(H2_PT 등) 스텝은 확실히 제외
      }

      // Spacing 필터: 실질적인 RF 방전(>=300W)이 없는 순수 고간격 이송(Transfer) 스텝만 제외 (평균 5000 mils 초과)
      // 실제 공정 스텝 중 초기 하강 과도 구간(9000 -> 750 mils)이나 특수 공정 간격(3500 mils)이 오인 제외되지 않도록 안전 가드
      const validSpacingRows = stepRows.filter(r => (r.liftSpacingSet > 0 || r.liftSpacing > 0));
      if (validSpacingRows.length > 0) {
        const avgSpacing = validSpacingRows.reduce((sum, r) => sum + (r.liftSpacingSet > 0 ? r.liftSpacingSet : r.liftSpacing), 0) / validSpacingRows.length;
        const hasSubstantialRf = stepRows.some(r => (r.rfForwardPowerAct ?? 0) >= 300);
        if (avgSpacing >= 5000 && !hasSubstantialRf) {
          continue; // 5000 mils 이상이고 RF가 없는 순수 Transfer/Wait 스텝만 제외
        }
      }
    } else {
      // SiH4 제외 모드: 이름이 Pump·Vent·Evac·Idle 등인 유휴 Step은 RF가 Step 대부분(50% 이상) 방전하지 않으면 제외
      // (앞 Step(PL 등)에서 넘어온 RF 꼬리 몇 행이나 Set 잔류 값 때문에 PUMP가 남던 문제 방지)
      const domName = stepDominantName(stepRows);
      const isPureIdle = !!domName && /(?:pump|pmp|vent|evac|idle|delay|펌프|배기)/i.test(domName) && !/(?:pl|power_?lift|파워리프트)/i.test(domName);
      if (isPureIdle) {
        const dischargeCnt = stepRows.filter(isRfDischargeRow).length;
        if (dischargeCnt < stepRows.length * 0.5) continue;
      }
    }

    // 1. SiH4 가스 유량 공급 감지: Set값 > 0 이거나, 실제 지속 공급(>=3행)
    const hasSiH4Set = stepRows.some(r => (r.pyroSiH4Set ?? 0) > 0);
    const siH4ActiveRows = stepRows.filter(r => (getGasValue(r, settings.depoGasCol) >= 5) || ((r.pyroSiH4 ?? 0) >= 5));
    const hasSiH4Sustained = siH4ActiveRows.length >= 3 || (siH4ActiveRows.length > 0 && siH4ActiveRows.length >= stepRows.length * 0.2);
    const hasSiH4 = hasSiH4Set || hasSiH4Sustained;

    // 2. RF 플라즈마 방전 감지: 'RF 명령(Fwd Set > 0 또는 RF On)이 있고 Act ≥ 50W인 행'이
    //    1초(10행) 이상 또는 Step 행 수의 30% 이상일 때만 방전 Step으로 인정
    //    (Set 값만 남은 행, 앞 Step에서 넘어온 몇 행짜리 RF 꼬리는 방전으로 보지 않음)
    const hasRf = hasRealDischarge(stepRows);

    // 3. Ar 가스 공급 감지 (실제 유량 >= 10 sccm 또는 Set값 > 0)
    const hasAr = stepRows.some(r => {
      const pyroAct = r.pyroAr ?? 0;
      const pyroSet = r.pyroArSet ?? 0;
      const oxyAct = r.oxyAr ?? 0;
      const oxySet = r.oxyArSet ?? 0;
      return pyroAct >= 10 || pyroSet > 0 || oxyAct >= 10 || oxySet > 0;
    });

    // 4. H2 가스 공급 감지 (실제 유량 >= 10 sccm 또는 Set값 > 0)
    const hasH2 = stepRows.some(r => {
      const pyroAct = r.pyroH2 ?? 0;
      const pyroSet = r.pyroH2Set ?? 0;
      return pyroAct >= 10 || pyroSet > 0;
    });

    let match = true;
    // SiH4 판정: include(반드시 공급), exclude(반드시 0/미공급)
    if (criteria.sih4 === 'include' && !hasSiH4) match = false;
    if (criteria.sih4 === 'exclude' && hasSiH4) match = false;

    // RF 판정: include(반드시 RF 방전), exclude(RF 없음)
    if (criteria.rf === 'include' && !hasRf) match = false;
    if (criteria.rf === 'exclude' && hasRf) match = false;

    // Ar 판정
    if (criteria.ar === 'include' && !hasAr) match = false;
    if (criteria.ar === 'exclude' && hasAr) match = false;

    // H2 판정
    if (criteria.h2 === 'include' && !hasH2) match = false;
    if (criteria.h2 === 'exclude' && hasH2) match = false;

    if (match) {
      depoSteps.push(stepNum);
    }
  }

  // Fallback: 선택 조건을 만족하는 스텝이 없는 경우
  if (depoSteps.length === 0) {
    if (criteria.sih4 === 'exclude' && criteria.rf === 'include') {
      // SiH4 제외 & RF 포함 모드일 때: SiH4가 없고 RF 방전이 있는 스텝(PL 등) 우선 탐색
      const candidatePlSteps = allSteps.filter(s => {
        const stepRows = rows.filter(r => r.step === s);
        const hasSiH4InStep = stepRows.some(r => (r.pyroSiH4Set ?? 0) > 0 || (r.pyroSiH4 ?? 0) >= 10);
        return !hasSiH4InStep && hasRealDischarge(stepRows);
      });
      if (candidatePlSteps.length > 0) {
        return candidatePlSteps;
      }
    }

    // 1순위: 비-Depo 스텝이 아니면서, 공정 가스(SiH4/N2O/NH3 등) Set/유량 공급 AND 실질적 RF 방전(>= 50W)이 있는 스텝
    // 후보 스텝 중 총 RF 방전 에너지가 가장 큰 주 증착 스텝 우선 채택!
    const candidateGasRfSteps = allSteps.filter(s => {
      const stepRows = rows.filter(r => r.step === s);
      const isExcluded = isNonDepoStep(stepDominantName(stepRows));
      if (isExcluded) return false;

      const hasGas = stepRows.some(r =>
        (r.pyroSiH4Set ?? 0) > 0 || (r.pyroSiH4 ?? 0) >= 5 ||
        (r.pyroN2OSet ?? 0) > 0 || (r.pyroN2O ?? 0) >= 10 ||
        (r.pyroNH3Set ?? 0) > 0 || (r.pyroNH3 ?? 0) >= 10
      );
      return hasGas && hasRealDischarge(stepRows);
    });

    if (candidateGasRfSteps.length > 0) {
      candidateGasRfSteps.sort((a, b) => {
        const sumA = rows.filter(r => r.step === a).reduce((acc, r) => acc + (r.rfForwardPowerAct || 0), 0);
        const sumB = rows.filter(r => r.step === b).reduce((acc, r) => acc + (r.rfForwardPowerAct || 0), 0);
        return sumB - sumA;
      });
      depoSteps.push(candidateGasRfSteps[0]);
    } else {
      // 2순위: 비-Depo 스텝 중 실질적 RF 방전이 유지된 스텝 (RF 총 방전 에너지가 가장 큰 스텝 순위)
      const validRfSteps = allSteps.filter(s => {
        const stepRows = rows.filter(r => r.step === s);
        const isExcluded = isNonDepoStep(stepDominantName(stepRows));
        if (isExcluded) return false;
        return hasRealDischarge(stepRows);
      });

      if (validRfSteps.length > 0) {
        validRfSteps.sort((a, b) => {
          const sumA = rows.filter(r => r.step === a).reduce((acc, r) => acc + (r.rfForwardPowerAct || 0), 0);
          const sumB = rows.filter(r => r.step === b).reduce((acc, r) => acc + (r.rfForwardPowerAct || 0), 0);
          return sumB - sumA;
        });
        depoSteps.push(validRfSteps[0]);
      } else {
        // 3순위: Depo 이름이 들어간 스텝 또는 파일 전체에서 RF 파워가 가장 높은 스텝
        const depoNamed = allSteps.find(s => {
          const stepRows = rows.filter(r => r.step === s);
          return stepRows.some(r => /depo|증착/i.test(r.stepName || ''));
        });
        if (depoNamed !== undefined) {
          depoSteps.push(depoNamed);
        } else {
          // 파일 전체에서 RF가 켜진 스텝이 있는지 최종 확인
          const anyRfStep = allSteps
            .map(s => ({
              step: s,
              maxRf: Math.max(...rows.filter(r => r.step === s).map(r => r.rfForwardPowerAct || 0)),
            }))
            .filter(item => item.maxRf >= 50)
            .sort((a, b) => b.maxRf - a.maxRf)[0];

          depoSteps.push(anyRfStep?.step ?? 3);
        }
      }
    }
  }

  return depoSteps;
}

/**
 * Detect Stable Step prior to Deposition step
 * 물리적 제어 상태 기준:
 * 1. RF Power는 켜지지 않는 Step (RF Act < 50W, RF Set == 0, RF On != 'on'/'1')
 * 2. Process Gas(SiH4, N2O, NH3, Ar, PN2, H2 등)가 특정 Set값 또는 실제 유량(>= 10 sccm)으로 공급되는 Step
 * 3. T/V (Throttle Valve / 압력 제어)가 특정 Set값 또는 제어 모드(Mode != 'OPEN' 또는 Pressure Set > 0)로 동작하는 Step
 * 6G, 8.5G, 8.6G 등 레시피마다 스텝 이름이나 컬럼명이 달라도 물리적 파라미터 상태를 기준으로 정확하게 자동 감지
 */
export function detectStableStep(
  file: ParsedLogFile,
  depoStep: number,
  allSteps: number[],
  prevDepoStep = 0
): number {
  if (file.manualStableStep !== undefined && file.manualStableStep !== null) {
    return file.manualStableStep;
  }

  const rows = file.rows;
  // Depo 스텝 직전이자 이전 Depo 스텝(prevDepoStep) 이후의 스텝만 후보로 엄격히 분리 (시간 순 오름차순 정렬)
  const interSteps = allSteps.filter(s => s < depoStep && s > prevDepoStep).sort((a, b) => a - b);

  // Depo 직전에 아무 스텝도 없는 경우 (Direct Depo): depoStep 자신 반환
  if (interSteps.length === 0) {
    return depoStep;
  }

  // 1순위 (사용자 명시 아키텍처): PRESTAB 스텝명 매칭 (가장 선행하는 최초의 PRESTAB 스텝)
  const preStabStep = interSteps.find(s => {
    const sName = (rows.find(r => r.step === s)?.stepName || '').toUpperCase();
    return sName.includes('PRESTAB') || /PRE_?STAB/i.test(sName);
  });
  if (preStabStep !== undefined) {
    return preStabStep;
  }

  // 2순위: STAB 스텝명 매칭 (PRESTAB이 아닌 순수 STAB 스텝)
  const stabStep = interSteps.find(s => {
    const sName = (rows.find(r => r.step === s)?.stepName || '').toUpperCase();
    return (sName.includes('STAB') || /STAB/i.test(sName)) && !sName.includes('PRESTAB');
  });
  if (stabStep !== undefined) {
    return stabStep;
  }

  const hasGasInStep = (stepRows: RawLogRow[]) => {
    return stepRows.some(r =>
      (r.pyroSiH4 ?? 0) >= 10 || (r.pyroSiH4Set ?? 0) > 0 ||
      (r.pyroN2O ?? 0) >= 10 || (r.pyroN2OSet ?? 0) > 0 ||
      (r.pyroNH3 ?? 0) >= 10 || (r.pyroNH3Set ?? 0) > 0 ||
      (r.pyroPN2 ?? 0) >= 10 || (r.pyroPN2Set ?? 0) > 0 ||
      (r.pyroAr ?? 0) >= 10 || (r.pyroArSet ?? 0) > 0 ||
      (r.oxyAr ?? 0) >= 10 || (r.oxyArSet ?? 0) > 0 ||
      (r.pyroH2 ?? 0) >= 10 || (r.pyroH2Set ?? 0) > 0 ||
      (r.oxyNF3 ?? 0) >= 10 || (r.oxyNF3Set ?? 0) > 0
    );
  };

  const hasTvInStep = (stepRows: RawLogRow[]) => {
    return stepRows.some(r => {
      const mode = getTvCtrlModeFromRow(r);
      const isModeCtrl = mode.includes('PRESS') || (mode !== 'OPEN' && mode !== '');
      const hasPressureSet = (r.tvPressureSet ?? 0) > 0;
      const isThrottlingPos = (r.tvPosition ?? 100) > 0 && (r.tvPosition ?? 100) < 99;
      return isModeCtrl || hasPressureSet || isThrottlingPos;
    });
  };

  // 3순위 (스텝명이 특수한 레시피 호환): RF Off + Process Gas 공급 + T/V 제어 3가지 조건 모두 만족하는 가장 인접한 이전 스텝
  const validStableCandidates = interSteps.filter(s => {
    const stepRows = rows.filter(r => r.step === s);
    if (stepRows.length === 0 || isStepRfRows(stepRows)) return false;
    return hasGasInStep(stepRows) && hasTvInStep(stepRows);
  });

  if (validStableCandidates.length > 0) {
    return validStableCandidates[0];
  }

  // 4순위: Gas 또는 T/V 중 하나라도 활성화되어 있고 RF가 없는 스텝
  const partialCandidates = interSteps.filter(s => {
    const stepRows = rows.filter(r => r.step === s);
    if (stepRows.length === 0 || isStepRfRows(stepRows)) return false;
    return hasGasInStep(stepRows) || hasTvInStep(stepRows);
  });

  if (partialCandidates.length > 0) {
    return partialCandidates[0];
  }

  // Fallback: 스텝명 기반 또는 직전 후보 스텝
  const targetPreStep = interSteps.find(s => {
    const sName = rows.filter(r => r.step === s)[0]?.stepName || '';
    return /(?:stable|pre|prestable|purge|wait|delay)/i.test(sName);
  }) ?? interSteps[interSteps.length - 1];

  return targetPreStep;
}

export function analyzeLogFile(
  file: ParsedLogFile,
  settings: AnalyzerSettings,
  ctclMatrix: CTCLMatrixData | null,
  index: number,
  targetDepoStep?: number,
  subIndex = 1,
  totalDepoSteps = 1,
  allDepoSteps?: number[]
): AnalysisFileResult {
  const rows = file.rows;
  const fileNo = index + 1;
  const isMultiStep = totalDepoSteps > 1;
  const displayNo = isMultiStep ? `${fileNo}-${subIndex}` : `${fileNo}`;
  const no = displayNo;

  const rcpName = file.meta.recipeName || file.fileName.replace(/\.csv$/i, '');
  let date = file.meta.date ? file.meta.date.trim() : '';
  const dMatch = date.match(/^(?:20)?(\d{2})[-/.]?(\d{2})[-/.]?(\d{2})/);
  if (dMatch) {
    date = `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`;
  } else if (/^\d{6}$/.test(date)) {
    date = `${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`;
  } else if (file.meta.date) {
    date = file.meta.date.replace(/^\d{4}-?/, '');
  }
  const pc = `Ch_${settings.processChamber}`;

  // 1. Identify Depo Step & Multi-Step context
  const allSteps = Array.from(new Set(rows.map(r => r.step))).sort((a, b) => a - b);
  let depoStep = targetDepoStep;
  if (depoStep === undefined) {
    const detected = detectAllDepoSteps(file, settings);
    depoStep = detected[0] ?? 3;
    if (!allDepoSteps) {
      allDepoSteps = detected;
      totalDepoSteps = detected.length;
    }
  }
  if (!allDepoSteps) {
    allDepoSteps = [depoStep];
  }

  const maxDepoStep = Math.max(...allDepoSteps);
  const isLastDepo = depoStep === maxDepoStep;

  // Depo 이전의 직전 Depo 스텝 경계 계산 (Multi-Depo 단계별 격리)
  const prevDepoList = (allDepoSteps || []).filter(s => s < depoStep!).sort((a, b) => b - a);
  const prevDepoStep = prevDepoList.length > 0 ? prevDepoList[0] : 0;

  // Stable step: Process Gas & T/V Set 기반 물리적 상태 자동 감지 (RF Power 미점화, prevDepoStep 경계 적용)
  const stableStep = detectStableStep(file, depoStep!, allSteps, prevDepoStep);

  // 2. Identify PL Step Start and End & PL Type (Only evaluated after the LAST Depo step in the file!)
  const stepsAfterDepo = Array.from(new Set(rows.filter(r => r.step > maxDepoStep).map(r => r.step))).sort((a, b) => a - b);
  let plStepStart: number | null = file.manualPlStepStart ?? null;
  let plStepEnd: number | null = file.manualPlStepEnd ?? null;
  let plType: 'H2' | 'Ar' | 'none' = 'none';

  // Depo 이후 단계에서 RF 재점화 및 가스 흐름 정밀 분석
  // (LSP 등 다음 스텝의 잔류 측정 전력 264W 등에 낚이지 않도록, RF SetValue > 0, SetValueAct > 0, 또는 RF On == 'On'을 기준으로 판정)
  const hasRfSetInFile = rows.some(r => (r.rfForwardSetValue ?? 0) > 0 || (r.rfForwardSetValueAct ?? 0) > 0);
  const isRfActiveRow = (r: RawLogRow) =>
    (r.rfForwardSetValue ?? 0) > 0 ||
    (r.rfForwardSetValueAct ?? 0) > 0 ||
    (r.rfOn && (r.rfOn.trim().toLowerCase() === 'on' || r.rfOn.trim() === '1')) ||
    (!hasRfSetInFile && (r.rfForwardPowerAct ?? 0) >= 300);
  const isH2ActiveRow = (r: RawLogRow) =>
    r.pyroH2 >= 10;
  const isArActiveRow = (r: RawLogRow) =>
    r.pyroAr >= 10;
  const isPlNamedRow = (r: RawLogRow) =>
    /(?:pl|plasma|post|treat)/i.test(r.stepName || '');

  const plRfSteps = stepsAfterDepo.filter(s => rows.filter(r => r.step === s).some(isRfActiveRow));
  const plH2Steps = stepsAfterDepo.filter(s => rows.filter(r => r.step === s).some(isH2ActiveRow));
  const plArSteps = stepsAfterDepo.filter(s => rows.filter(r => r.step === s).some(isArActiveRow));
  const plNamedSteps = stepsAfterDepo.filter(s => rows.filter(r => r.step === s).some(isPlNamedRow));

  // PL 존재 여부 및 PL 가스 Type 자동 판별
  if (plRfSteps.length > 0) {
    // Depo 이후 RF가 다시 켜지는 구간이 존재함 -> PL 확실!
    const rfRowsAfterDepo = rows.filter(r => plRfSteps.includes(r.step));
    const maxH2InRf = Math.max(0, ...rfRowsAfterDepo.map(r => r.pyroH2));
    const maxArInRf = Math.max(0, ...rfRowsAfterDepo.map(r => r.pyroAr));

    if (maxH2InRf >= 10 && maxH2InRf >= maxArInRf) {
      plType = 'H2';
    } else if (maxArInRf >= 10) {
      plType = 'Ar';
    } else if (maxH2InRf >= 10) {
      plType = 'H2';
    } else {
      plType = plH2Steps.length > 0 ? 'H2' : (plArSteps.length > 0 ? 'Ar' : 'H2');
    }
  } else if (plNamedSteps.length > 0) {
    // 스텝명에 PL/Plasma/Treat가 명시된 경우
    const namedRows = rows.filter(r => plNamedSteps.includes(r.step));
    const maxH2InNamed = Math.max(0, ...namedRows.map(r => r.pyroH2));
    const maxArInNamed = Math.max(0, ...namedRows.map(r => r.pyroAr));
    if (maxH2InNamed >= 10 && maxH2InNamed >= maxArInNamed) plType = 'H2';
    else if (maxArInNamed >= 10) plType = 'Ar';
    else if (maxH2InNamed >= 10) plType = 'H2';
    else plType = 'none';
  } else {
    // Depo 이후 RF도 없고 PL 명칭도 없는 일반 펌프/퍼지 레시피 -> PL 미적용
    plType = 'none';
  }

  // PL Start & End 스텝 자동 계산 (수동 지정이 없을 때)
  if (plType === 'none' && plRfSteps.length === 0 && plNamedSteps.length === 0) {
    // PL 미적용 레시피는 억지로 스텝을 잡지 않고 null ('-') 처리!
    if (file.manualPlStepStart === undefined) plStepStart = null;
    if (file.manualPlStepEnd === undefined) plStepEnd = null;
  } else {
    if (plStepStart === null) {
      // 1순위: 스텝명에 PL_Start 또는 PL이 명시된 첫 스텝
      const explicitPlStartStep = plNamedSteps.find(s => {
        const row = rows.find(r => r.step === s);
        return /(?:pl_?start|pl_?init)/i.test(row?.stepName || '');
      });

      if (explicitPlStartStep !== undefined) {
        plStepStart = explicitPlStartStep;
      } else if (plRfSteps.length > 0) {
        // 2순위: Power Lift의 본질인 RF 플라즈마 방전이 실제로 시작되는 첫 스텝! (Step 6)
        plStepStart = plRfSteps[0];
      } else if (plNamedSteps.length > 0) {
        // 3순위: PL 명칭이 있는 첫 스텝
        plStepStart = plNamedSteps[0];
      } else {
        plStepStart = null;
      }
    }

    if (plStepEnd === null) {
      // 1순위 (사용자 핵심 요구 알고리즘): RF Forward SetValue/Act 또는 실제 RF 방전 전력이
      // 특정 파워(RSD 2000W, PL Power 등)에서 0으로 차단되는 마지막 스텝!
      // 즉, Depo 이후 RF가 실제로 인가/방전되는 가장 마지막 스텝을 PowerLift Step의 최종 스텝으로 판정
      if (plRfSteps.length > 0) {
        plStepEnd = plRfSteps[plRfSteps.length - 1];
      } else {
        // RF 신호 컬럼이 비어있는 경우 Fallback:
        // 스텝명에 PL_End가 명시된 스텝 우선, 그 외 비-방전 펌프/퍼지/대기 스텝을 제외한 순수 PL 스텝
        const explicitPlEndStep = plNamedSteps.slice().reverse().find(s => {
          const row = rows.find(r => r.step === s);
          return /(?:pl_?end)/i.test(row?.stepName || '');
        });

        if (explicitPlEndStep !== undefined) {
          plStepEnd = explicitPlEndStep;
        } else {
          const purePlNamedSteps = plNamedSteps.filter(s => {
            const stepRows = rows.filter(r => r.step === s);
            return !stepRows.some(r => /(?:pump|pmp|purge|prg|vent|wait|delay|idle)/i.test(r.stepName || ''));
          });
          if (purePlNamedSteps.length > 0) {
            plStepEnd = purePlNamedSteps[purePlNamedSteps.length - 1];
          } else if (plNamedSteps.length > 0) {
            plStepEnd = plNamedSteps[plNamedSteps.length - 1];
          } else {
            plStepEnd = plStepStart;
          }
        }
      }
    }
  }

  // 3. Timings in Depo Step
  const depoRows = rows.filter(r => r.step === depoStep);

  // ─────────────────────────────────────────────────────────────
  // BB Mode / 연속 Depo 전환 감지 (Step 경계 단위)
  //  - BB Mode: Step이 넘어가도 RF Power가 꺼지지 않고, 이전 Step에서 쓰던 Gas·Pressure가 다음 Step으로 이어짐
  //  - BB 열: 이름에 'BB'가 들어간 열 (예: 'RF BB.mode'), Enable/True면 BB 전환
  //  - 판단 기준: RF가 경계를 넘어 계속 켜져 있고(앞 Step 마지막 행·뒤 Step 첫 행 Act ≥ RF On 기준, 뒤 Step Set > 0),
  //    뒤 Step 첫 3행 중 BB 플래그가 Enable이거나 뒤(앞) Step도 Depo Step이면 BB 전환.
  //    (BB 열이 없는 로그도 RF가 꺼지지 않고 다음 Depo로 이어지면 RF Off 기준점이 없으므로 BB 전환으로 간주)
  // ─────────────────────────────────────────────────────────────
  const depoFirstIdx = rows.findIndex(r => r.step === depoStep);
  let depoLastIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].step === depoStep) { depoLastIdx = i; break; }
  }
  const bbRfThr = settings.rfOnThresholdDepo ?? 300;
  const rfSetOf = (r: RawLogRow) => (r.rfForwardSetValue > 0 ? r.rfForwardSetValue : r.rfForwardSetValueAct);
  /** 경계 건너편 Step 첫 3행 중 하나라도 Enable이면 true, 모두 Disable이면 false, 값이 없으면 null */
  const flagNear = (startIdx: number, key: 'bbMode' | 'specificGasAdj'): boolean | null => {
    let seen: boolean | null = null;
    const st = rows[startIdx]?.step;
    for (let k = startIdx; k < Math.min(rows.length, startIdx + 3); k++) {
      if (rows[k].step !== st) break;
      const v = rows[k][key];
      if (v === true) return true;
      if (v === false) seen = false;
    }
    return seen;
  };
  /** lastIdx(앞 Step 마지막 행) → firstIdx(뒤 Step 첫 행) 경계 분석. firstIdx Step 쪽 플래그를 사용 */
  const analyzeBoundary = (lastIdx: number, firstIdx: number, otherStep: number): HWBoundaryInfo & { bb: boolean; continuation: boolean } => {
    const a = rows[lastIdx];
    const b = rows[firstIdx];
    const otherIsDepo = (allDepoSteps || []).includes(otherStep);
    const bbFlag = flagNear(firstIdx, 'bbMode');
    const rfContinuous = a.rfForwardPowerAct >= bbRfThr && b.rfForwardPowerAct >= bbRfThr && rfSetOf(b) > 0;
    const specificGas = flagNear(firstIdx, 'specificGasAdj');
    // RF가 경계에서 꺼지지 않았다면 RF Off 기준점 자체가 없으므로, BB 플래그 또는 이어지는 Depo Step이면 BB 전환으로 처리
    const bb = rfContinuous && (bbFlag === true || otherIsDepo);
    // Gas·Pressure 이어짐 판단을 적용할 경계: BB 전환이거나, 바로 이어지는 Step도 Depo (BB False 연속 Depo 포함)
    const continuation = bb || otherIsDepo;
    return { otherStep, otherIsDepo, bbFlag, rfContinuous, specificGas, bb, continuation };
  };
  const endNextIdx = depoLastIdx >= 0 && depoLastIdx + 1 < rows.length && rows[depoLastIdx + 1].step !== depoStep ? depoLastIdx + 1 : -1;
  const startPrevIdx = depoFirstIdx > 0 && rows[depoFirstIdx - 1].step !== depoStep ? depoFirstIdx - 1 : -1;
  const bbEndInfo = endNextIdx >= 0 ? analyzeBoundary(depoLastIdx, endNextIdx, rows[endNextIdx].step) : null;
  const bbStartInfo = startPrevIdx >= 0 ? analyzeBoundary(startPrevIdx, depoFirstIdx, rows[startPrevIdx].step) : null;
  const isBbEnd = Boolean(bbEndInfo?.bb);
  const isContEnd = Boolean(bbEndInfo?.continuation);
  const isContStart = Boolean(bbStartInfo?.continuation);
  /** BB 전환 시 다음 Step의 RF Set (RSD 오인 방지용) */
  const bbNextRfSet = isBbEnd && endNextIdx >= 0 ? rfSetOf(rows[endNextIdx]) : 0;
  const stepSummaryItem = file.stepsSummary?.find(s => s.step === depoStep);
  const currentStepName = stepSummaryItem?.stepName || depoRows[0]?.stepName || '';
  const isPlStep = /(?:pl\b|pl\d+|power_?lift|파워리프트|pin_?up)/i.test(currentStepName) ||
    (settings.depoStepCriteria && normalizeCriteria(settings.depoStepCriteria).sih4 === 'exclude');

  let tOn: number | null = null;
  let tOff: number | null = null;

  let rfOnElapsedSec: number | null = null;
  const firstOnRow = depoRows.find(r => r.rfForwardPowerAct >= 1);
  if (firstOnRow) {
    tOn = firstOnRow.stepAllTime;
    rfOnElapsedSec = firstOnRow.elapsedSec;
  } else {
    // 만약 지정된 depoStep에 RF 방전이 없는 경우, 파일 전체에서 실제 주 RF 방전 시작 시점을 탐색
    const globalFirstOn = rows.find(r => r.rfForwardPowerAct >= 50);
    if (globalFirstOn) {
      tOn = globalFirstOn.stepAllTime;
      rfOnElapsedSec = globalFirstOn.elapsedSec;
    } else if (depoRows.length > 0) {
      rfOnElapsedSec = depoRows[0].elapsedSec;
    }
  }

  const lastRowOfDepo = depoRows.length > 0 ? depoRows[depoRows.length - 1] : null;
  const isRfOnAtStepEnd = Boolean(
    lastRowOfDepo && (
      lastRowOfDepo.rfForwardPowerAct >= (settings.rfOnThresholdDepo ?? 300) ||
      (lastRowOfDepo.rfOn ?? '').trim().toLowerCase() === 'on' ||
      (lastRowOfDepo.rfOn ?? '').trim() === '1'
    )
  );

  const flowingSiH4Rows = depoRows.filter(r => r.pyroSiH4 >= 10);
  // PL 또는 연속 RF 공정 여부:
  // PL은 연속적인 RF 공정이므로 RF가 다음 Step으로 넘어가도 Off되지 않음.
  // 이 경우 Step이 넘어가기 직전의 'Step All Time'을 확인하여 PL End 시점으로 감지.
  const isContinuousRfStep = isPlStep || (isRfOnAtStepEnd && flowingSiH4Rows.length === 0);

  const rfPowerDepoRows = depoRows.filter(r => r.rfForwardPowerAct > settings.rfOnThresholdDepo);
  if (isContinuousRfStep && lastRowOfDepo) {
    // PL은 연속적인 RF 공정이므로 RF가 다음 Step으로 넘어가도 Off되지 않음.
    // Step이 넘어가기 직전 마지막 행의 'Step All Time'을 PL End 시점으로 정확히 감지 (예: 4.2초)
    tOff = lastRowOfDepo.stepAllTime;
  } else if (rfPowerDepoRows.length > 0) {
    const lastRow = rfPowerDepoRows[rfPowerDepoRows.length - 1];
    tOff = lastRow.stepAllTime;
  } else if (depoRows.length > 0) {
    tOff = depoRows[depoRows.length - 1].stepAllTime;
  }

  const totalDepoStepTime = depoRows.length > 0 ? depoRows[depoRows.length - 1].stepAllTime : 0;

  // Representative RF Setpoint for the step:
  // If setRow has 0 (due to negative readOffsetSec on short steps), pick from active rows in this step
  const stepRfSetCandidates = depoRows.map(r => r.rfForwardSetValue).filter(v => v > 0);
  const stepRfSetActCandidates = depoRows.map(r => r.rfForwardSetValueAct).filter(v => v > 0);
  const maxRfSetInStep = stepRfSetCandidates.length > 0 ? Math.max(...stepRfSetCandidates) : 0;
  const maxRfSetActInStep = stepRfSetActCandidates.length > 0 ? Math.max(...stepRfSetActCandidates) : 0;
  let dominantRfSet = maxRfSetActInStep > 0 ? maxRfSetActInStep : maxRfSetInStep;
  if (dominantRfSet <= 0 && rfPowerDepoRows.length > 0) {
    const avgPwr = rfPowerDepoRows.reduce((sum, r) => sum + r.rfForwardPowerAct, 0) / rfPowerDepoRows.length;
    if (avgPwr >= 50) dominantRfSet = Math.round(avgPwr);
  }

  // 4. Read point for Process Data Set Table & 기준Set
  // readOffsetSec(기본 -10초) 적용 시, 스텝 시간(예: 4.2초)보다 offset 절댓값이 크면
  // readTimeThreshold가 음수가 되어 스텝 시작 전(0초, Set값 0)을 참조하는 버그를 완벽 방지!
  const activeDuration = (tOff !== null && tOn !== null && tOff > tOn) ? (tOff - tOn) : (tOff ?? totalDepoStepTime);
  let readTimeThreshold: number;
  if (tOff !== null) {
    if (activeDuration > Math.abs(settings.readOffsetSec)) {
      readTimeThreshold = Math.round((tOff + settings.readOffsetSec) * 10) / 10;
    } else {
      // 10초 미만의 짧은 스텝(PL 등): 스텝 종료 직전(tOff - 0.2초)의 안정된 방전 구간에서 데이터 산출
      readTimeThreshold = Math.max(tOn ?? 0, Math.round((tOff - 0.2) * 10) / 10);
    }
  } else {
    readTimeThreshold = Math.max(0, Math.round((totalDepoStepTime - 0.2) * 10) / 10);
  }

  // RF Off - 10초(readTimeThreshold) 시점의 행을 정확히 찾기:
  // 역순(slice().reverse())으로 탐색할 때는 readTimeThreshold 이하(<=)인 첫 번째 행을 찾아야
  // readTimeThreshold에 가장 근접한(직전) 행을 취득합니다.
  const setRow = depoRows.slice().reverse().find(r => r.stepAllTime <= readTimeThreshold)
    || depoRows.find(r => r.stepAllTime >= readTimeThreshold)
    || depoRows[depoRows.length - 1]
    || rows[0];
  const eTime = setRow ? setRow.stepAllTime : null;

  // 기준Set = RF Forward SetValue(Act) > 0 ? RF Forward SetValue(Act) : RF Forward SetValue
  // dominantRfSet(스텝 내 주방전 Set)과 비교하여, setRow의 값이 RSD 단계나 일시적 드롭 등으로 주방전보다 현저히 낮으면 dominantRfSet 우선 적용
  const rawSetRf = (setRow && setRow.rfForwardSetValueAct > 0)
    ? setRow.rfForwardSetValueAct
    : (setRow && setRow.rfForwardSetValue > 0 ? setRow.rfForwardSetValue : 0);
  const baseSet = (rawSetRf > 0 && dominantRfSet > 0 && rawSetRf >= dominantRfSet * 0.7)
    ? rawSetRf
    : (dominantRfSet > 0 ? dominantRfSet : rawSetRf);

  // t_reach: Depo Step에서 RF Forward Power(Act) >= 기준Set * (1 - 허용오차)인 첫 시간
  // RF 도달 오차는 RF Forward EC Warning % (기본 2.0%)와 일관되게 연계
  const rfTolerance = settings.ecRfForwardWarningPct ?? settings.rfTolerancePct ?? 2.0;
  const tolFactor = 1 - rfTolerance / 100;
  const setReachThreshold = baseSet > 0 ? baseSet * tolFactor : (settings.rfOnThresholdDepo ?? 300);

  let tReach: number | null = null;
  if (baseSet > 0) {
    const reachRow = depoRows.find(r => r.rfForwardPowerAct >= setReachThreshold);
    if (reachRow) {
      tReach = reachRow.stepAllTime;
    }
  }

  // SiH4 차단 시점 감지 (Depo Step에서 SiH4 실제 공급 유량이 차단/급감하는 시점)
  // *주의: pyroSiH4Set은 스텝 끝까지 값이 유지되므로 반드시 실제 유량(pyroSiH4)을 기준으로 감지해야 함
  let sih4CutoffTime: number | null = null;
  if (flowingSiH4Rows.length > 0) {
    const lastFlowing = flowingSiH4Rows[flowingSiH4Rows.length - 1];
    if (lastFlowing.stepAllTime < (totalDepoStepTime - 0.2)) {
      sih4CutoffTime = lastFlowing.stepAllTime;
    }
  }

  // Calculate RF Ramp Up (RF 최초 점화 1W부터 목표 Set의 98% 도달 시점까지)
  // Ramping Up 정상 수정:
  // 1) PL2 등 이전 스텝에서 이미 플라즈마가 방전된 채 연속으로 넘어온 경우: 시작 행부터 이미 목표 도달 상태이므로 Ramp Up = 0.0초
  // 2) PL1 / 일반 점화 스텝: 점화 행(firstIgnitionRow, >=1W) 이후에 목표치(>=98% of 940W)에 도달하는 행(rampUpReachRow) 탐색
  //    목표치 940W 도달 시간 - 점화 시간 = 0.1~0.2초로 정상 산출 (음수 버그 완전 방지)
  let rfRampUp: number | null = null;
  const firstRowOfStep = depoRows[0];
  const isAlreadyDischargingAtStart = Boolean(firstRowOfStep && firstRowOfStep.rfForwardPowerAct >= setReachThreshold);

  if (isAlreadyDischargingAtStart) {
    // 연속 RF 방전 스텝 (PL2, PL3 등)
    rfRampUp = 0.0;
  } else {
    const firstIgnitionRow = depoRows.find(r => r.rfForwardPowerAct >= 1);
    // 반드시 firstIgnitionRow 이후의 행에서만 목표 도달 행을 탐색하도록 보장!
    const rampUpReachRow = firstIgnitionRow
      ? depoRows.find(r => r.stepAllTime >= firstIgnitionRow.stepAllTime && r.rfForwardPowerAct >= setReachThreshold)
      : null;

    if (firstIgnitionRow && rampUpReachRow) {
      const diff = rampUpReachRow.stepAllTime - firstIgnitionRow.stepAllTime;
      rfRampUp = Math.max(0.0, Math.round(diff * 10) / 10);
    } else if (firstIgnitionRow && depoRows.some(r => r.rfForwardPowerAct >= setReachThreshold)) {
      const reachRow = depoRows.find(r => r.rfForwardPowerAct >= setReachThreshold);
      if (reachRow && reachRow.stepAllTime >= firstIgnitionRow.stepAllTime) {
        rfRampUp = Math.max(0.0, Math.round((reachRow.stepAllTime - firstIgnitionRow.stepAllTime) * 10) / 10);
      }
    }
  }

  // RSD (Residual Silane Discharge) vs Ramp Down 감지 시퀀스:
  // Depo Step 후반부에서 SiH4 실제 유량이 차단(0 sccm으로 급감)되는 시점과
  // RF Set/Act 파워가 특정 레벨(예: 2000W 부근)로 계단식(Step) 하강하여 플랫하게 유지되는 구간 감지
  let rsdPower: number | null = null;
  let rsdTime: number | null = null;
  let isRsdDetected = false;

  // 1) 주방전 도달 완료 시점(lastHighPowerRow) 탐색:
  // RSD는 본질적으로 주방전이 완전히 끝난 후 테일 구간에서만 발생하므로,
  // 단시간 증착 스텝(예: Set 5초)에서 초반 Ramp Up(1.8~2.0초) 구간의 파워가 RSD로 오인되는 것을 원천 차단합니다.
  const lastHighPowerRow = depoRows.slice().reverse().find(r => r.rfForwardPowerAct >= setReachThreshold);
  const minRsdSearchTime = lastHighPowerRow ? lastHighPowerRow.stepAllTime : (tReach ?? (tOn ?? 0));

  // 2) 주방전 종료 시점(minRsdSearchTime) 이후의 테일 구간에서
  // RF SetValue/SetValue(Act)가 계단식으로 하강했거나, RF Power(Act)가 주방전 대비 하강하여
  // 잔류 방전(> settings.rfOnThresholdDepo)을 유지하는 순수 RSD 행들 추출
  const rsdShelfRows = depoRows.filter(r => {
    if (r.stepAllTime < minRsdSearchTime) return false;
    const isTailTime = tOff !== null ? r.stepAllTime <= (tOff + 0.1) : true;
    const isSetDown = baseSet > 0 && (
      (r.rfForwardSetValue > 0 && r.rfForwardSetValue < baseSet * 0.85) ||
      (r.rfForwardSetValueAct > 0 && r.rfForwardSetValueAct < baseSet * 0.85)
    );
    const isPwrDown = baseSet > 0 && r.rfForwardPowerAct < (baseSet * 0.85) && r.rfForwardPowerAct > (settings.rfOnThresholdDepo ?? 300);
    return isTailTime && (isSetDown || isPwrDown);
  });

  const rsdThr = settings.rfOnThresholdDepo ?? 300;
  const pwrShelfRows = rsdShelfRows.filter(
    r => r.rfForwardPowerAct > rsdThr && (baseSet <= 0 || r.rfForwardPowerAct < baseSet * 0.85)
  );

  // RSD 판정 (사용자 정의 기준)
  //  1) RSD Power: 주방전 Set을 유지하다가 0이 아닌 낮은 값(주방전 85% 미만)으로 내려간 Fwd Set 값
  //     - Fwd Set이 0으로 기록되는 장비는 Fwd Set(A) 값을 사용, 단일 샘플 글리치를 막기 위해 같은 값이 2행 이상일 때만 인정
  //  2) Start: Set을 내린 뒤 Fwd Act가 'RSD Power ± rsdBandW(기본 300W)' 범위에 처음 들어온 시점
  //  3) End: Start 이후 범위를 2행 연속 벗어난 첫 시점 (다음 Step까지 이어서 탐색, 최대 15초)
  //  4) RSD Time = End - Start (파일 경과 시간 기준), Act가 범위에 들어오지 않으면 0.0초
  //  ※ Set이 0으로 떨어진 뒤 파워가 꺼지는 과정(예: 10,150 → 3,191 → 372 W)은 낮은 Set이 없으므로 RSD 아님
  const rsdBandW = settings.rsdBandW ?? 300;
  const effSet = (r: RawLogRow) => (r.rfForwardSetValue > 0 ? r.rfForwardSetValue : r.rfForwardSetValueAct);
  let rsdSetDropTime: number | null = null;
  {
    const reachIdx = depoRows.findIndex(r => r.rfForwardPowerAct >= setReachThreshold);
    let dropIdx = -1;
    if (baseSet > 0 && reachIdx >= 0) {
      for (let i = reachIdx + 1; i < depoRows.length - 1; i++) {
        const v = effSet(depoRows[i]);
        // BB 전환: Depo 끝에서 Fwd Set이 다음 Step의 Set으로 미리 바뀌는 것은 RSD가 아니라 Step 전환
        // (예: 13,090 → 9,270). 이 시점부터는 다음 Step 영역이므로 탐색 종료
        if (bbNextRfSet > 0 && Math.abs(v - bbNextRfSet) <= Math.max(1, bbNextRfSet * 0.01) && Math.abs(v - baseSet) > Math.max(1, baseSet * 0.01)) {
          break;
        }
        if (v > 0 && v < baseSet * 0.85) {
          const nv = effSet(depoRows[i + 1]);
          if (Math.abs(nv - v) <= Math.max(1, v * 0.01)) {
            dropIdx = i;
            break;
          }
        }
      }
    }
    if (dropIdx >= 0) {
      const dropRow = depoRows[dropIdx];
      const P = Math.round(effSet(dropRow));
      isRsdDetected = true;
      rsdPower = P;
      rsdSetDropTime = dropRow.stepAllTime;

      const inBand = (r: RawLogRow) => Math.abs(r.rfForwardPowerAct - P) <= rsdBandW;
      const gi = rows.indexOf(dropRow);
      const limitSec = dropRow.elapsedSec + 15;
      let startRow: RawLogRow | null = null;
      let endRow: RawLogRow | null = null;
      let lastScanned: RawLogRow | null = null;
      for (let k = Math.max(0, gi); k < rows.length && rows[k].elapsedSec <= limitSec; k++) {
        const r = rows[k];
        lastScanned = r;
        if (!startRow) {
          if (inBand(r) && r.rfForwardPowerAct < setReachThreshold) startRow = r;
          continue;
        }
        if (!inBand(r)) {
          const nx = rows[k + 1];
          if (!nx || !inBand(nx)) {
            endRow = r;
            break;
          }
        }
      }
      if (startRow) {
        const endT = (endRow ?? lastScanned ?? startRow).elapsedSec;
        rsdTime = Math.max(0, Math.round((endT - startRow.elapsedSec) * 10) / 10);
      } else {
        rsdTime = 0.0;
      }
    }
  }

  // Calculate RF Ramp Down:
  // RSD 기능이 적용되었거나, PL/연속 RF 공정으로 스텝 끝에서도 RF가 유지되는 경우 Ramp Down은 0.0으로 처리!
  let rfRampDown: number | null = null;
  if (isRsdDetected || isContinuousRfStep || isRfOnAtStepEnd) {
    rfRampDown = 0.0;
  } else {
    const lastAbove300 = depoRows.slice().reverse().find(r => r.rfForwardPowerAct > settings.rfOnThresholdDepo);
    const lastAboveSetTol = depoRows.slice().reverse().find(r => r.rfForwardPowerAct >= setReachThreshold);
    if (lastAbove300 && lastAboveSetTol) {
      rfRampDown = Math.max(0.0, Math.round((lastAbove300.stepAllTime - lastAboveSetTol.stepAllTime) * 10) / 10);
    }
  }

  // 5. Analysis Window Mode (Depo 정상 방전 분석 구간)
  // 항상 'Ramping Up 실제 도달 기준' + n초 (기본 3.0초)로 설정
  const startPostBuffer = settings.rampUpPostOffsetSec ?? settings.rfStableTimeSec ?? 3.0;
  const actualReachTime = tReach !== null ? tReach : ((tOn !== null ? tOn : 0) + (rfRampUp ?? 1.2));
  const rawWindowStart = actualReachTime + startPostBuffer;

  // RSD 진입 시점 파악 (SiH4 차단 또는 RF Power/Set 계단식 하강 중 가장 이른 시점을 RSD 진입 시점으로 감지)
  let rsdEntryTime: number | null = null;
  if (isRsdDetected) {
    const candidateTimes: number[] = [];
    if (sih4CutoffTime !== null && sih4CutoffTime >= minRsdSearchTime) {
      candidateTimes.push(sih4CutoffTime);
    }
    // Set을 RSD Power로 내린 시점 (Act 응답 지연과 무관한 지시 시점)
    if (rsdSetDropTime !== null) {
      candidateTimes.push(rsdSetDropTime);
    }
    if (candidateTimes.length > 0) {
      rsdEntryTime = Math.min(...candidateTimes);
    }
  }

  // 분석 구간 설정 (종료 시점):
  // 사용자 요구사항 및 공정 분석 매니저 분석 기준 설정:
  // - 일반 공정: RF Off - settings.rfRampDownTimeSec (기본 1.0초)
  // - RSD 공정: RSD 진입 시점 - settings.rsdPreOffsetSec (기본 1.0초) 전까지 엄격히 한정!
  // 이를 통해 RSD 진입 과정에서 일시적으로 발생하는 임피던스 불일치 및 Reflection spike(예: 627W, 665W 등)가
  // 정상 방전 분석 구간에 혼입되어 오경보(Warning/Alarm)가 발생하는 문제를 원천 차단합니다.
  const rsdPreBuffer = settings.rsdPreOffsetSec ?? 1.0;
  const rfOffBuffer = settings.rfRampDownTimeSec ?? 1.0;

  let rawWindowEnd = tOff !== null ? Math.max(rawWindowStart, tOff - rfOffBuffer) : 0;
  if (isRsdDetected && rsdEntryTime !== null) {
    rawWindowEnd = Math.max(rawWindowStart, Math.round((rsdEntryTime - rsdPreBuffer) * 10) / 10);
  }

  let roundedWindowStart = Math.round(rawWindowStart * 10) / 10;
  let roundedWindowEnd = Math.round(rawWindowEnd * 10) / 10;

  // 인위적인 Ramp 필터링 제거: Set의 98% 미만으로 떨어지는 불안정한 행도
  // RF 제너레이터의 실제 이상/드롭 현상이므로 있는 그대로 온전히 포착하여 Deviation 및 Warning/Alarm에 반영
  const windowRows: RawLogRow[] = depoRows.filter(
    r => r.stepAllTime >= roundedWindowStart && r.stepAllTime <= roundedWindowEnd
  );

  let hasRampInWindowWarning = false;
  if (windowRows.length > 0 && baseSet > 0) {
    const minFwdActInWindow = Math.min(...windowRows.map(r => r.rfForwardPowerAct));
    if (minFwdActInWindow < setReachThreshold) {
      hasRampInWindowWarning = true;
    }
  }

  // 유효 증착/방전 종료 시점 (effectiveOffTime) 산출:
  // 1) PL 공정 또는 연속 RF 방전 스텝 (RF가 다음 Step으로 넘어가도 Off되지 않음):
  //    사용자 요구사항: Step이 넘어가기 직전의 'Step All Time'을 확인해서, PL End 시점은 'Step All Time 기준' 4.2초로 감지!
  // 2) SiH4 가스가 공급되는 Depo 스텝인 경우:
  //    박막 증착(Deposition)은 SiH4 전구체와 플라즈마가 공존하는 유효 구간에서만 일어나므로, SiH4 실제 차단 시점(마지막 유량 공급 시점)을 기준으로 산출
  // 3) SiH4 가스가 없는 스텝(Treatment, N2O/NH3 등):
  //    - RSD(후반부 스텝다운 잔류 방전)가 감지된 경우: RSD 시작 시점(rsdEntryTime 또는 tOff - rsdTime)을 차단 기준으로 하여 주방전 시간 산출
  //    - 그 외: RF 차단 시점(tOff)으로 산출
  let effectiveOffTime: number | null = tOff;

  if (isContinuousRfStep && lastRowOfDepo) {
    // PL 연속 공정: 스텝 전환 직전 마지막 행의 Step All Time 기준 (예: 4.2초)
    effectiveOffTime = lastRowOfDepo.stepAllTime;
  } else {
    const hasSiH4InStep = (setRow && setRow.pyroSiH4Set > 0) || flowingSiH4Rows.length > 0;
    if (hasSiH4InStep && flowingSiH4Rows.length > 0) {
      const lastFlowingTime = flowingSiH4Rows[flowingSiH4Rows.length - 1].stepAllTime;
      effectiveOffTime = tOff !== null ? Math.min(lastFlowingTime, tOff) : lastFlowingTime;
    } else if (isRsdDetected && rsdEntryTime !== null) {
      effectiveOffTime = rsdEntryTime;
    } else if (isRsdDetected && rsdTime !== null && tOff !== null) {
      effectiveOffTime = Math.max(0, tOff - rsdTime);
    }
  }

  // Ramp Up 포함 Time (depTimeWithRampUp) 산출:
  // PL 공정(또는 연속 RF 공정):
  // Step All Time이 0초부터 시작하여 초기 Ramp Up 및 위치 이동을 거쳐 PL End 시점(4.2초)까지 도달하므로,
  // PL End 시점의 'Step All Time' 전체(4.2초)가 곧 Ramp Up을 포함한 총 Time이 됨!
  // (기존처럼 tOn(1.1초)을 차감하면 Ramp Up이 빠진 3.1초가 되는 오류 방지)
  const depTimeWithRampUp = (effectiveOffTime !== null)
    ? ((isContinuousRfStep || isPlStep)
        ? Math.round(effectiveOffTime * 10) / 10
        : (tOn !== null ? Math.round((effectiveOffTime - tOn) * 10) / 10 : Math.round(effectiveOffTime * 10) / 10))
    : null;

  const depTimeStable = (effectiveOffTime !== null)
    ? ((isContinuousRfStep || isPlStep)
        ? Math.round(Math.max(0, effectiveOffTime - settings.rfStableTimeSec) * 10) / 10
        : (tOn !== null ? Math.round((effectiveOffTime - tOn - settings.rfStableTimeSec) * 10) / 10 : null))
    : null;

  const depTimeSetReached = (effectiveOffTime !== null && rfRampUp !== null)
    ? ((isContinuousRfStep || isPlStep)
        ? Math.round(Math.max(0, effectiveOffTime - rfRampUp) * 10) / 10
        : (tOn !== null ? Math.round((effectiveOffTime - tOn - rfRampUp) * 10) / 10 : Math.round((effectiveOffTime - rfRampUp) * 10) / 10))
    : null;

  const rfOffsetHomeSpacing = setRow ? Math.round((setRow.liftSpacingSet + setRow.liftPos) * 10) / 10 : null;

  const processData: ProcessDataSetRow = {
    fileId: file.id,
    fileName: file.fileName,
    no,
    rcpName,
    step: depoStep!,
    eTime: eTime !== null ? Math.round(eTime * 10) / 10 : null,
    date,
    pc,
    stepTimeSet: (setRow && setRow.stepTimeSet > 0)
      ? setRow.stepTimeSet
      : (depoRows.find(r => r.stepTimeSet > 0)?.stepTimeSet ?? (setRow ? setRow.stepTimeSet : null)),
    depTimeStable,
    depTimeSetReached,
    depTimeWithRampUp,
    rfOffsetHomeSpacing,
    rfForwardSetValue: (setRow && setRow.rfForwardSetValue > 0)
      ? setRow.rfForwardSetValue
      : (dominantRfSet > 0 ? dominantRfSet : (setRow ? setRow.rfForwardSetValue : null)),
    rfForwardSetValueAct: (setRow && setRow.rfForwardSetValueAct > 0)
      ? setRow.rfForwardSetValueAct
      : (maxRfSetActInStep > 0 ? maxRfSetActInStep : (setRow ? setRow.rfForwardSetValueAct : null)),
    rfRampUp,
    rfRampDown,
    rsdPower,
    rsdTime,
    rfRampValueUp: setRow ? setRow.rfRampValueUp : null,
    rfRampTimeUp: setRow ? setRow.rfRampTimeUp : null,
    tvPressureSet: setRow ? setRow.tvPressureSet : null,
    liftSpacingSet: setRow ? setRow.liftSpacingSet : null,
    oxyNF3Set: setRow ? setRow.oxyNF3Set : null,
    oxyArSet: setRow ? setRow.oxyArSet : null,
    pyroN2OSet: (setRow && setRow.pyroN2OSet > 0) ? setRow.pyroN2OSet : (depoRows.find(r => (r.pyroN2OSet ?? 0) > 0)?.pyroN2OSet ?? (setRow ? setRow.pyroN2OSet : null)),
    pyroNH3Set: (setRow && setRow.pyroNH3Set > 0) ? setRow.pyroNH3Set : (depoRows.find(r => (r.pyroNH3Set ?? 0) > 0)?.pyroNH3Set ?? (setRow ? setRow.pyroNH3Set : null)),
    pyroArSet: (setRow && setRow.pyroArSet > 0) ? setRow.pyroArSet : (depoRows.find(r => (r.pyroArSet ?? 0) > 0)?.pyroArSet ?? (setRow ? setRow.pyroArSet : null)),
    pyroPN2Set: (setRow && setRow.pyroPN2Set > 0) ? setRow.pyroPN2Set : (depoRows.find(r => (r.pyroPN2Set ?? 0) > 0)?.pyroPN2Set ?? (setRow ? setRow.pyroPN2Set : null)),
    pyroSiH4Set: (setRow && setRow.pyroSiH4Set > 0) ? setRow.pyroSiH4Set : (depoRows.find(r => (r.pyroSiH4Set ?? 0) > 0)?.pyroSiH4Set ?? (setRow ? setRow.pyroSiH4Set : null)),
    pyroH2Set: (setRow && setRow.pyroH2Set > 0) ? setRow.pyroH2Set : (depoRows.find(r => (r.pyroH2Set ?? 0) > 0)?.pyroH2Set ?? (setRow ? setRow.pyroH2Set : null)),
    gateIn1Set: setRow ? ((setRow.gateIn1Set && setRow.gateIn1Set > 0) ? setRow.gateIn1Set : (setRow.gateIn1 > 0 ? setRow.gateIn1 : null)) : null,
    gateOut2Set: setRow ? ((setRow.gateOut2Set && setRow.gateOut2Set > 0) ? setRow.gateOut2Set : (setRow.gateOut2 && setRow.gateOut2 > 0 ? setRow.gateOut2 : null)) : null,
    windowIn3Set: setRow ? ((setRow.windowIn3Set && setRow.windowIn3Set > 0) ? setRow.windowIn3Set : (setRow.windowIn3 > 0 ? setRow.windowIn3 : null)) : null,
    windowOut4Set: setRow ? ((setRow.windowOut4Set && setRow.windowOut4Set > 0) ? setRow.windowOut4Set : (setRow.windowOut4 > 0 ? setRow.windowOut4 : null)) : null,
    side1In5Set: setRow ? ((setRow.side1In5Set && setRow.side1In5Set > 0) ? setRow.side1In5Set : (setRow.side1In5 > 0 ? setRow.side1In5 : null)) : null,
    dynamicHeaters: (() => {
      const map: Record<string, number | null> = {};
      if (file.heaterChannelDefs) {
        file.heaterChannelDefs.forEach(def => {
          let s = setRow?.dynamicHeaters?.[def.name]?.set;
          // 'Set'이 붙은 항목에 만약 데이터가 '0'과 같이 값이 없거나 0 이하인 경우 -> Real(Act) 값을 가져옴
          if (s === null || s === undefined || isNaN(s) || s <= 0) {
            const act = setRow?.dynamicHeaters?.[def.name]?.act;
            if (act !== null && act !== undefined && !isNaN(act) && act > 0) {
              s = act;
            } else {
              // setRow에도 없으면 depoRows 구간의 유효한 Real(Act) 값으로 fallback
              const validActs = depoRows
                .map(r => r.dynamicHeaters?.[def.name]?.act)
                .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v > 0);
              if (validActs.length > 0) {
                const avgAct = validActs.reduce((a, b) => a + b, 0) / validActs.length;
                s = Math.round(avgAct * 10) / 10;
              }
            }
          }
          map[def.name] = (s !== undefined && s !== null && s > 0) ? s : null;
        });
      }
      return map;
    })(),
  };

  // 6. Monitoring Data Actual Values (in Analysis Window)
  const calcAvg = (getter: (r: RawLogRow) => number): number | null => {
    if (windowRows.length === 0) return null;
    const vals = windowRows.map(getter).filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (vals.length === 0) return null;
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const avg = sum / vals.length;
    return isNaN(avg) || !isFinite(avg) ? null : Math.round(avg * 100) / 100;
  };

  const calcMax = (getter: (r: RawLogRow) => number): number | null => {
    if (windowRows.length === 0) return null;
    const vals = windowRows.map(getter).filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (vals.length === 0) return null;
    const m = Math.max(...vals);
    return isNaN(m) || !isFinite(m) ? null : m;
  };

  const rfReflectPowerMax = calcMax(r => r.rfReflectPower);
  const tvPositionAvg = calcAvg(r => r.tvPosition);
  const matcherLoadAvg = calcAvg(r => r.matcherLoad);
  const matcherTuneAvg = calcAvg(r => r.matcherTune);
  const matcherVppAvg = calcAvg(r => r.matcherVpp);
  const matcherIrmsAvg = calcAvg(r => r.matcherIrms);
  const matcherDCBiasAvg = calcAvg(r => r.matcherDCBias);

  // RF Reflect Power 판정 (구간 Max 기준)
  const rfReflectAlarmLevel = evaluateLevel(
    rfReflectPowerMax,
    'upper',
    settings.ecRfReflectWarningW,
    settings.ecRfReflectAlarmW
  );

  // T/V Position 평균 100 이상이면 "Full Open" 배지
  const tvPositionIsFullOpen = tvPositionAvg !== null && tvPositionAvg >= 100;

  // Matcher Vpp, Irms, DC Bias 평균이 모두 0이면 흐리게 표시하고 "Matcher 신호 없음"
  const vppVal = matcherVppAvg ?? 0;
  const irmsVal = matcherIrmsAvg ?? 0;
  const dcBiasVal = Math.abs(matcherDCBiasAvg ?? 0);
  const matcherNoSignal = vppVal <= 0.05 && irmsVal <= 0.05 && dcBiasVal <= 0.05;
  const matcherSignalWarning = matcherNoSignal;

  // Bilinear CTCL interpolation (정확한 R, X 임피던스 산출)
  let rfChR: number | null = null;
  let rfChX: number | null = null;
  if (ctclMatrix && matcherLoadAvg !== null && matcherTuneAvg !== null && (matcherLoadAvg > 0 || matcherTuneAvg > 0)) {
    const complex = interpolateCTCL(ctclMatrix, matcherLoadAvg, matcherTuneAvg);
    if (complex) {
      rfChR = complex.r;
      rfChX = complex.x;
    }
  }

  const monitoringData: MonitoringDataRow = {
    fileId: file.id,
    fileName: file.fileName,
    no,
    rcpName,
    stableStep,
    depoStep: depoStep!,
    plStepStart: isLastDepo ? plStepStart : null,
    plStepEnd: isLastDepo ? plStepEnd : null,
    plType: isLastDepo ? plType : 'none',
    rfReflectPowerMax,
    rfReflectAlarmLevel,
    tvPositionAvg: tvPositionAvg !== null ? Math.round(tvPositionAvg * 10) / 10 : null,
    tvPositionIsFullOpen,
    matcherLoadAvg,
    matcherTuneAvg,
    rfChR,
    rfChX,
    matcherVppAvg: matcherVppAvg !== null ? Math.round(matcherVppAvg * 10) / 10 : null,
    matcherIrmsAvg: matcherIrmsAvg !== null ? Math.round(matcherIrmsAvg * 10) / 10 : null,
    matcherDCBiasAvg: matcherDCBiasAvg !== null ? Math.round(matcherDCBiasAvg * 10) / 10 : null,
    matcherSignalWarning,
    matcherNoSignal,
    rsdPower,
    rsdTime,
    dynamicHeaterActs: (() => {
      const map: Record<string, number | null> = {};
      if (file.heaterChannelDefs) {
        file.heaterChannelDefs.forEach(def => {
          const avg = calcAvg(r => {
            const v = r.dynamicHeaters?.[def.name]?.act;
            return v !== undefined && v !== null ? v : NaN;
          });
          map[def.name] = avg;
        });
      }
      return map;
    })(),
  };

  // 7. H/W Control Start Times (0.0 sec = 해당 Step 시작 시점 기준)
  // Stable Step 자체의 시작 시점(0.0초)을 기준으로 산출 (PL Stable, Depo, PL과 동일하게 통일)
  const depoStableRows = rows.filter(r => r.step === stableStep);

  // Depo 이전의 모든 선행 스텝 구간 (시간 순서대로 정렬)
  const interSteps = allSteps.filter(s => s > prevDepoStep && s < depoStep).sort((a, b) => a - b);
  const isPreStabName = (name: string) => /(?:^|[_\s-])pre_?stab(?:[_\s\d-]|$)|pre_?stable/i.test(name) || name.toUpperCase().includes('PRESTAB');
  const isStabName = (name: string) => (!isPreStabName(name)) && (/(?:^|[_\s-])stab(?:[_\s\d-]|$)|stable/i.test(name) || name.toUpperCase().includes('STAB'));

  const preStabSteps = interSteps.filter(s => isPreStabName(rows.find(r => r.step === s)?.stepName || ''));
  const stabSteps = interSteps.filter(s => isStabName(rows.find(r => r.step === s)?.stepName || ''));

  // PL Stable 스텝 판정: plStepStart - 1이 반드시 Depo 스텝(maxDepoStep)보다 뒤에 있는 별도의 가스 안정화 스텝이어야 함!
  const hasSeparatePlStable = isLastDepo && plStepStart !== null && (plStepStart - 1) > maxDepoStep;
  const plStableRows = hasSeparatePlStable && plStepStart !== null ? rows.filter(r => r.step === plStepStart - 1) : [];
  const plRows = (isLastDepo && plStepStart !== null) ? rows.filter(r => r.step === plStepStart) : [];
  const startStep = plStepStart;
  const endStep = plStepEnd;
  const plAllStepsRows = (isLastDepo && startStep !== null)
    ? rows.filter(r => r.step >= startStep && (endStep !== null ? r.step <= Math.max(endStep, startStep) : true))
    : [];

  const plInterSteps = rows.filter(r => r.step > maxDepoStep && !isStepRfRows(rows.filter(sr => sr.step === r.step)));
  const plPreStabSteps = Array.from(new Set(plInterSteps.map(r => r.step))).filter(s => isPreStabName(rows.find(r => r.step === s)?.stepName || ''));
  const plStabSteps = Array.from(new Set(plInterSteps.map(r => r.step))).filter(s => isStabName(rows.find(r => r.step === s)?.stepName || ''));

  // 1) 단일 스텝 내부에서 가스 공급 시작 시점(0 -> Set값 도달 전환점) 감지 헬퍼
  const findGasStartInStepRows = (
    stepRows: RawLogRow[],
    setGetter: (r: RawLogRow) => number | null | undefined,
    actGetter: (r: RawLogRow) => number | null | undefined,
    thresh = 1
  ): number | null => {
    if (stepRows.length === 0) return null;
    const targetSet = Math.max(0, ...stepRows.map(r => setGetter(r) ?? 0));
    const maxAct = Math.max(0, ...stepRows.map(r => actGetter(r) ?? 0));

    if (targetSet <= 0 && maxAct < 5) return null;

    if (targetSet > 0) {
      // 1순위: stepRows 내부에서 0(또는 이전값)에서 targetSet으로 튀어 오른 전환점 포착 (예: Step 6 PRESTAB2 Row 10: 0.3s)
      let switchRow = stepRows.find((r, idx) => {
        const val = setGetter(r) ?? 0;
        if (val < targetSet) return false;
        if (idx === 0) {
          const globalIdx = rows.findIndex(gr => gr === r);
          if (globalIdx > 0) {
            return (setGetter(rows[globalIdx - 1]) ?? 0) < targetSet;
          }
          return true;
        }
        return (setGetter(stepRows[idx - 1]) ?? 0) < targetSet;
      });

      if (!switchRow) {
        // 1-2순위: Set > 0 으로 처음 진입한 행
        switchRow = stepRows.find((r, idx) => {
          const val = setGetter(r) ?? 0;
          if (val <= 0) return false;
          if (idx === 0) {
            const globalIdx = rows.findIndex(gr => gr === r);
            if (globalIdx > 0) {
              return (setGetter(rows[globalIdx - 1]) ?? 0) <= 0;
            }
            return true;
          }
          return (setGetter(stepRows[idx - 1]) ?? 0) <= 0;
        });
      }

      if (switchRow) {
        return Math.round((switchRow.stepAllTime ?? 0) * 10) / 10;
      }
    }

    // 2순위: 실제 유량이 유효 유량(>= thresh)으로 상승 시작한 첫 행
    if (maxAct >= 5) {
      const flowRow = stepRows.find((r, idx) => {
        const act = actGetter(r) ?? 0;
        if (act < thresh) return false;
        if (idx === 0) {
          const globalIdx = rows.findIndex(gr => gr === r);
          if (globalIdx > 0) {
            return (actGetter(rows[globalIdx - 1]) ?? 0) < thresh;
          }
          return true;
        }
        return (actGetter(stepRows[idx - 1]) ?? 0) < thresh;
      }) ?? stepRows.find(r => (actGetter(r) ?? 0) >= thresh);

      if (flowRow) return Math.round((flowRow.stepAllTime ?? 0) * 10) / 10;
    }

    return null;
  };

  /**
   * [사용자 명시 알고리즘]
   * 1. Prestable 스텝: stepName이 'PRESTAB' (Step 6 PRESTAB2 등)
   * 2. Stable 스텝: stepName이 'STAB'
   * 3. 두 Step 모두 가장 선행하는 최초 안정화 (0 -> Set값 변화) 부분이 없다면 Depo. Step 에서 Stable Time 산출!
   */
  const getGasStartTimeWithFallback = (
    setGetter: (r: RawLogRow) => number | null | undefined,
    actGetter: (r: RawLogRow) => number | null | undefined,
    thresh = 1
  ): number | null => {
    // [Tier 1] Prestable 스텝 ('PRESTAB')에서 최초 안정화 (0 -> Set 변화) 탐색 (예: Step 6 PRESTAB2, 0.3초)
    for (const s of preStabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findGasStartInStepRows(stepRows, setGetter, actGetter, thresh);
      if (startSec !== null) return startSec;
    }

    // [Tier 2] Stable 스텝 ('STAB')에서 최초 안정화 (0 -> Set 변화) 탐색
    for (const s of stabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findGasStartInStepRows(stepRows, setGetter, actGetter, thresh);
      if (startSec !== null) return startSec;
    }

    // [Fallback for recipes without explicit PRESTAB/STAB naming]
    if (preStabSteps.length === 0 && stabSteps.length === 0) {
      const nonRfSteps = interSteps.filter(s => !isStepRfRows(rows.filter(r => r.step === s)));
      for (const s of nonRfSteps) {
        const stepRows = rows.filter(r => r.step === s);
        const startSec = findGasStartInStepRows(stepRows, setGetter, actGetter, thresh);
        if (startSec !== null) return startSec;
      }
      if (depoStableRows.length > 0) {
        const startSec = findGasStartInStepRows(depoStableRows, setGetter, actGetter, thresh);
        if (startSec !== null) return startSec;
      }
    }

    // [Tier 3] 두 Step 모두 가장 선행하는 최초 안정화 부분이 없다면 Depo. Step 자체에서 산출!
    return findGasStartInStepRows(depoRows, setGetter, actGetter, thresh);
  };

  const getGasStartTimePlWithFallback = (
    setGetter: (r: RawLogRow) => number | null | undefined,
    actGetter: (r: RawLogRow) => number | null | undefined,
    thresh = 0.1
  ): number | null => {
    for (const s of plPreStabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findGasStartInStepRows(stepRows, setGetter, actGetter, thresh);
      if (startSec !== null) return startSec;
    }
    for (const s of plStabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findGasStartInStepRows(stepRows, setGetter, actGetter, thresh);
      if (startSec !== null) return startSec;
    }
    if (plStableRows.length > 0) {
      const startSec = findGasStartInStepRows(plStableRows, setGetter, actGetter, thresh);
      if (startSec !== null) return startSec;
    }
    return findGasStartInStepRows(plRows, setGetter, actGetter, thresh);
  };

  // 2) Throttle Valve Mode Start 시점 판정 (OPEN/POS -> PRESSURE 전환점)
  const findTvModeStartInStepRows = (stepRows: RawLogRow[]): number | null => {
    if (stepRows.length === 0) return null;
    const isRowPressure = (r: RawLogRow) => {
      const modes = getAllTvCtrlModesFromRow(r);
      if (modes.length > 0) return modes.some(m => m.includes('PRESS'));
      return (r.tvPressureSet ?? 0) > 0;
    };
    const isRowOpenOrPos = (r: RawLogRow) => {
      const modes = getAllTvCtrlModesFromRow(r);
      if (modes.length > 0) {
        if (modes.some(m => m.includes('POS') || m.includes('OPEN'))) return true;
        return !modes.some(m => m.includes('PRESS'));
      }
      return (r.tvPressureSet ?? 0) <= 0;
    };

    const hasPressureInStep = stepRows.some(isRowPressure);
    if (!hasPressureInStep) return null;

    // 1순위: stepRows 내부에서 OPEN/POS -> PRESSURE 전환 행
    let found = stepRows.find((r, idx) => {
      if (!isRowPressure(r)) return false;
      if (idx === 0) {
        const globalIdx = rows.findIndex(gr => gr === r);
        if (globalIdx > 0) {
          return isRowOpenOrPos(rows[globalIdx - 1]);
        }
        return true;
      }
      return isRowOpenOrPos(stepRows[idx - 1]);
    });

    if (found) {
      return Math.round((found.stepAllTime ?? 0) * 10) / 10;
    }

    // 2순위: 첫 PRESSURE 행
    found = stepRows.find(isRowPressure);
    return found ? Math.round((found.stepAllTime ?? 0) * 10) / 10 : null;
  };

  const getModeChangeStartWithFallback = (): number | null => {
    // [Tier 1] Prestable
    for (const s of preStabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findTvModeStartInStepRows(stepRows);
      if (startSec !== null) return startSec;
    }
    // [Tier 2] Stable
    for (const s of stabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findTvModeStartInStepRows(stepRows);
      if (startSec !== null) return startSec;
    }
    // [Fallback for recipes without PRESTAB/STAB named steps]
    if (preStabSteps.length === 0 && stabSteps.length === 0) {
      const nonRfSteps = interSteps.filter(s => !isStepRfRows(rows.filter(r => r.step === s)));
      for (const s of nonRfSteps) {
        const stepRows = rows.filter(r => r.step === s);
        const startSec = findTvModeStartInStepRows(stepRows);
        if (startSec !== null) return startSec;
      }
      if (depoStableRows.length > 0) {
        const startSec = findTvModeStartInStepRows(depoStableRows);
        if (startSec !== null) return startSec;
      }
    }
    // [Tier 3] Depo
    return findTvModeStartInStepRows(depoRows);
  };

  const getModeChangeStartPlWithFallback = (): number | null => {
    for (const s of plPreStabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findTvModeStartInStepRows(stepRows);
      if (startSec !== null) return startSec;
    }
    for (const s of plStabSteps) {
      const stepRows = rows.filter(r => r.step === s);
      const startSec = findTvModeStartInStepRows(stepRows);
      if (startSec !== null) return startSec;
    }
    if (plStableRows.length > 0) {
      const startSec = findTvModeStartInStepRows(plStableRows);
      if (startSec !== null) return startSec;
    }
    return findTvModeStartInStepRows(plRows);
  };

  // 3) RF Power Start 시점: 'RF Forward SetValue'가 0에서 Set값 도달했을 때를 시작시점으로 판정 (해당 Depo Step 전용 격리 산출)
  // Row 2336 (Step All Time = 0.1s, RF On = On, Set = 1480W)을 1순위로 정확히 포착하고 스텝 종료 시간(72.1s)으로 넘어가지 않도록 안전 가드 설정
  const getRfPowerStartTime = (rowList: RawLogRow[]): number | null => {
    if (rowList.length === 0) return null;
    const totalStepDuration = rowList[rowList.length - 1].stepAllTime ?? 0;
    const targetSet = Math.max(0, ...rowList.map(r => Math.max(r.rfForwardSetValue ?? 0, r.rfForwardSetValueAct ?? 0)));
    const maxAct = Math.max(0, ...rowList.map(r => r.rfForwardPowerAct ?? 0));

    const isRowRfOn = (r: RawLogRow) => {
      const s = (r.rfOn ?? '').trim().toLowerCase();
      return s === 'on' || s === '1' || Number(r.rfOn) >= 1;
    };

    const hasAnyRfOnFlag = rowList.some(isRowRfOn);

    // 해당 스텝에 RF Set도 없고 실질적 RF 방전(>= 10W)도 없고 RF On 플래그도 없는 경우 null ('-')
    if (targetSet <= 0 && maxAct < 10 && !hasAnyRfOnFlag) return null;

    // 안전 가드: RF 시작 시점은 스텝 시작 과도 구간(초반 5.0초 이내)에 위치해야 하므로,
    // 스텝 종료/오프 시점(예: 72.1초) 근방의 행은 시작점으로 절대 채택되지 않도록 가드 기준 설정
    const maxAllowedStartTime = totalStepDuration > 5.0 ? 5.0 : Math.max(1.0, totalStepDuration - 0.5);

    // 1순위: RF Forward SetValue가 0에서 목표 Set값(예: 1480W)에 도달한 첫 행 (Row 2336: 0.1s, Set=1480)
    if (targetSet > 0) {
      let setReachedRow = rowList.find((r, idx) => {
        if ((r.stepAllTime ?? 0) > maxAllowedStartTime) return false;
        const val = Math.max(r.rfForwardSetValue ?? 0, r.rfForwardSetValueAct ?? 0);
        if (val < targetSet) return false;
        if (idx === 0) {
          const globalIdx = rows.findIndex(gr => gr === r);
          if (globalIdx > 0) {
            const prevVal = Math.max(rows[globalIdx - 1].rfForwardSetValue ?? 0, rows[globalIdx - 1].rfForwardSetValueAct ?? 0);
            return prevVal < targetSet;
          }
          return true;
        }
        const prevVal = Math.max(rowList[idx - 1].rfForwardSetValue ?? 0, rowList[idx - 1].rfForwardSetValueAct ?? 0);
        return prevVal < targetSet;
      });

      if (!setReachedRow) {
        // 1-2순위: SetValue가 > 0 으로 진입한 첫 행 (스텝 종료 가드 적용)
        setReachedRow = rowList.find((r, idx) => {
          if ((r.stepAllTime ?? 0) > maxAllowedStartTime) return false;
          const val = Math.max(r.rfForwardSetValue ?? 0, r.rfForwardSetValueAct ?? 0);
          if (val <= 0) return false;
          if (idx === 0) {
            const globalIdx = rows.findIndex(gr => gr === r);
            if (globalIdx > 0) {
              const prevVal = Math.max(rows[globalIdx - 1].rfForwardSetValue ?? 0, rows[globalIdx - 1].rfForwardSetValueAct ?? 0);
              return prevVal <= 0;
            }
            return true;
          }
          const prevVal = Math.max(rowList[idx - 1].rfForwardSetValue ?? 0, rowList[idx - 1].rfForwardSetValueAct ?? 0);
          return prevVal <= 0;
        });
      }

      if (setReachedRow) {
        return Math.round((setReachedRow.stepAllTime ?? 0) * 10) / 10;
      }
    }

    // 2순위: RF On 플래그가 Off -> On으로 전환된 첫 행 (Row 2336: 0.1s, RF On = On)
    if (hasAnyRfOnFlag) {
      const rfOnSwitchRow = rowList.find((r, idx) => {
        if ((r.stepAllTime ?? 0) > maxAllowedStartTime) return false;
        if (!isRowRfOn(r)) return false;
        if (idx === 0) {
          const globalIdx = rows.findIndex(gr => gr === r);
          if (globalIdx > 0) {
            return !isRowRfOn(rows[globalIdx - 1]);
          }
          return true;
        }
        return !isRowRfOn(rowList[idx - 1]);
      }) ?? rowList.find(r => isRowRfOn(r) && (r.stepAllTime ?? 0) <= maxAllowedStartTime);

      if (rfOnSwitchRow) {
        return Math.round((rfOnSwitchRow.stepAllTime ?? 0) * 10) / 10;
      }
    }

    // 3순위 (Set 정보 및 On 플래그 부재 시 Fallback): 실제 RF 점화 행 (rfForwardPowerAct >= 10W 전환점)
    const actRow = rowList.find((r, idx) => {
      if ((r.stepAllTime ?? 0) > maxAllowedStartTime) return false;
      const act = r.rfForwardPowerAct ?? 0;
      if (act < 10) return false;
      if (idx === 0) {
        const globalIdx = rows.findIndex(gr => gr === r);
        if (globalIdx > 0) {
          return (rows[globalIdx - 1].rfForwardPowerAct ?? 0) < 10;
        }
        return true;
      }
      return (rowList[idx - 1].rfForwardPowerAct ?? 0) < 10;
    }) ?? rowList.find(r => (r.rfForwardPowerAct ?? 0) >= 10 && (r.stepAllTime ?? 0) <= maxAllowedStartTime);

    if (actRow) {
      return Math.round((actRow.stepAllTime ?? 0) * 10) / 10;
    }

    // 4순위 절대 안전 가드 (스텝 종료 72.1s로 튀는 현상 원천 차단):
    // 스텝 시작부(첫 5개 행 또는 stepAllTime <= 1.0s)에서 RF 활성 신호 탐색
    const earlyActiveRow = rowList.find((r, idx) =>
      idx <= 5 && (isRowRfOn(r) || (r.rfForwardSetValue ?? 0) > 0 || (r.rfForwardPowerAct ?? 0) >= 10)
    );
    if (earlyActiveRow) {
      return Math.round((earlyActiveRow.stepAllTime ?? 0) * 10) / 10;
    }

    // 만약 스텝 전체에서 오직 마지막 행에만 신호가 감지된 비정상적인 경우라도 종료 시점(72.1s) 반환 방지
    return rowList.length > 1 ? Math.round((rowList[1].stepAllTime ?? 0.1) * 10) / 10 : 0.1;
  };

  const hwStart: HWControlStartRow = {
    fileId: file.id,
    fileName: file.fileName,
    no,
    rcpName,
    depoStable_pyroAr: getGasStartTimeWithFallback(r => Math.max(r.pyroArSet ?? 0, r.oxyArSet ?? 0), r => Math.max(r.pyroAr ?? 0, r.oxyAr ?? 0)),
    depoStable_pyroN2O: getGasStartTimeWithFallback(r => r.pyroN2OSet, r => r.pyroN2O),
    depoStable_pyroNH3: getGasStartTimeWithFallback(r => r.pyroNH3Set, r => r.pyroNH3),
    depoStable_pyroPN2: getGasStartTimeWithFallback(r => r.pyroPN2Set, r => r.pyroPN2),
    depoStable_pyroH2: getGasStartTimeWithFallback(r => r.pyroH2Set, r => r.pyroH2),
    depoStable_pyroSiH4: getGasStartTimeWithFallback(r => r.pyroSiH4Set, r => r.pyroSiH4),
    depoStable_tvCtrlMode: getModeChangeStartWithFallback(),
    depo_rfForwardAct: getRfPowerStartTime(depoRows),
    plStable_pyroAr: isLastDepo ? getGasStartTimePlWithFallback(r => Math.max(r.pyroArSet ?? 0, r.oxyArSet ?? 0), r => Math.max(r.pyroAr ?? 0, r.oxyAr ?? 0)) : null,
    plStable_pyroH2: isLastDepo ? getGasStartTimePlWithFallback(r => r.pyroH2Set, r => r.pyroH2) : null,
    plStable_tvCtrlMode: isLastDepo ? getModeChangeStartPlWithFallback() : null,
    pl_rfForwardAct: isLastDepo ? getRfPowerStartTime(plRows) : null,
  };

  // 이전 Step(Depo)에서 이어져 들어온 경우 (BB 전환 또는 연속 Depo):
  // 경계 앞뒤 행 모두에서 이미 켜져 있던 항목은 이 Step에서 새로 시작한 것이 아니므로 '유지' 처리
  if (isContStart && bbStartInfo) {
    const startStatus: Partial<Record<string, HWCellStatus>> = {};
    const prevRow = rows[startPrevIdx];
    const firstRow = rows[depoFirstIdx];
    const startGasDefs: [keyof HWControlStartRow, (r: RawLogRow) => number | null | undefined, (r: RawLogRow) => number | null | undefined][] = [
      ['depoStable_pyroAr', r => Math.max(r.pyroArSet ?? 0, r.oxyArSet ?? 0), r => Math.max(r.pyroAr ?? 0, r.oxyAr ?? 0)],
      ['depoStable_pyroN2O', r => r.pyroN2OSet, r => r.pyroN2O],
      ['depoStable_pyroNH3', r => r.pyroNH3Set, r => r.pyroNH3],
      ['depoStable_pyroPN2', r => r.pyroPN2Set, r => r.pyroPN2],
      ['depoStable_pyroH2', r => r.pyroH2Set, r => r.pyroH2],
      ['depoStable_pyroSiH4', r => r.pyroSiH4Set, r => r.pyroSiH4],
    ];
    for (const [field, setG, actG] of startGasDefs) {
      const hasSet = rows.some(r => (setG(r) ?? 0) > 0);
      const on = (r: RawLogRow) => (hasSet ? (setG(r) ?? 0) > 0.1 : (actG(r) ?? 0) >= 5);
      if (on(prevRow) && on(firstRow)) {
        (hwStart as unknown as Record<string, unknown>)[field] = null;
        startStatus[field] = 'keep';
      }
    }
    const tvPress = (r: RawLogRow) => {
      const modeSet = (r.tvCtrlModeSet || '').trim().toUpperCase();
      const modeAct = (r.tvCtrlMode || '').trim().toUpperCase();
      if (modeSet.includes('PRESS') || modeAct.includes('PRESS')) return true;
      const modes = getAllTvCtrlModesFromRow(r);
      if (modes.some(m => m.includes('PRESS'))) return true;
      if (!modeSet && !modeAct && modes.length === 0) return (r.tvPressureSet ?? 0) > 0;
      return false;
    };
    if (tvPress(prevRow) && tvPress(firstRow)) {
      hwStart.depoStable_tvCtrlMode = null;
      startStatus.depoStable_tvCtrlMode = 'keep';
    }
    if (bbStartInfo.rfContinuous) {
      hwStart.depo_rfForwardAct = null;
      startStatus.depo_rfForwardAct = 'keep';
    }
    hwStart.bbStart = {
      otherStep: bbStartInfo.otherStep,
      otherIsDepo: bbStartInfo.otherIsDepo,
      bbFlag: bbStartInfo.bbFlag,
      rfContinuous: bbStartInfo.rfContinuous,
      specificGas: bbStartInfo.specificGas,
    };
    hwStart.cellStatus = startStatus;
  }
  const plEndStep = isLastDepo ? (plStepEnd ?? plStepStart) : null;
  const plEndRows = plEndStep !== null ? rows.filter(r => r.step === plEndStep) : [];

  // PL RF Off 시점 정밀 계산 (Threshold 10W 이상 실제 점화 기준 및 연속 스텝 추적)
  // settings.rfOnThresholdPL(500W) 고정치로 인해 저전력 PL(예: 100~300W)에서 빈 배열이 되어 스텝 끝(20초 등)으로 잘못 튀는 현상 방지
  // RF Power Off 기준 행(Row) 및 시점 정밀 탐색 (Depo Step 및 PL Step 공통)
  // 1순위: RF SetValue가 양수에서 0W로 떨어지는 첫 행 (예: Depo Row 2020 99.8s, PL Row 2827 10.3s)
  // 2순위: RF On 플래그가 Off가 되는 행
  // 3순위: SetValue > 0 이 유지된 마지막 행의 바로 다음 행
  // 4순위: 스텝 마지막 행
  const getStepRfOffInfo = (baseStep: number | null): { rowIdx: number; stepAllTime: number } | null => {
    if (baseStep === null) return null;
    const baseRows = rows.filter(r => r.step === baseStep);
    if (baseRows.length === 0) return null;

    // 1순위: RF SetValue가 > 0 에서 <= 0 으로 바뀌는 행
    const rfSetDropIdx = rows.findIndex(
      (r, idx) =>
        r.step === baseStep &&
        (r.rfForwardSetValue ?? 0) <= 0 &&
        idx > 0 &&
        rows[idx - 1].step === baseStep &&
        ((rows[idx - 1].rfForwardSetValue ?? 0) > 0)
    );
    if (rfSetDropIdx !== -1) {
      return { rowIdx: rfSetDropIdx, stepAllTime: rows[rfSetDropIdx].stepAllTime };
    }

    // 2순위: RF On 플래그가 Off가 되는 행
    const rfOffFlagIdx = rows.findIndex(
      (r, idx) =>
        r.step === baseStep &&
        r.rfOn &&
        r.rfOn.trim().toLowerCase() === 'off' &&
        idx > 0 &&
        rows[idx - 1].step === baseStep &&
        rows[idx - 1].rfOn &&
        rows[idx - 1].rfOn.trim().toLowerCase() === 'on'
    );
    if (rfOffFlagIdx !== -1) {
      return { rowIdx: rfOffFlagIdx, stepAllTime: rows[rfOffFlagIdx].stepAllTime };
    }

    // 3순위: SetValue > 0 이 유지된 마지막 행의 바로 다음 행
    const lastActiveBaseRow = baseRows.slice().reverse().find(r => (r.rfForwardSetValue ?? 0) > 0 || (r.rfForwardSetValueAct ?? 0) > 0);
    if (lastActiveBaseRow) {
      const activeIdx = rows.findIndex(r => r === lastActiveBaseRow);
      if (activeIdx !== -1 && activeIdx < rows.length - 1) {
        // 다음 행이 다른 Step이면(Step 끝에서 RF가 꺼짐) 그 행의 Step All Time은 다음 Step 기준이므로
        // 현재 Step 기준 시간(마지막 RF 행 + 0.1초)으로 환산
        const nx = rows[activeIdx + 1];
        const t = nx.step === baseStep ? nx.stepAllTime : Math.round(((lastActiveBaseRow.stepAllTime ?? 0) + 0.1) * 10) / 10;
        return { rowIdx: activeIdx + 1, stepAllTime: t };
      }
      return { rowIdx: activeIdx, stepAllTime: lastActiveBaseRow.stepAllTime };
    }

    // 4순위: 스텝 마지막 행
    const lastRow = baseRows[baseRows.length - 1];
    const lastIdx = rows.findIndex(r => r === lastRow);
    return { rowIdx: lastIdx, stepAllTime: lastRow.stepAllTime };
  };

  const depoRfOffInfo = getStepRfOffInfo(depoStep);
  const plRfOffInfo = isLastDepo && plEndStep !== null ? getStepRfOffInfo(plEndStep) : null;

  const rfOffTimeDepo = depoRfOffInfo ? depoRfOffInfo.stepAllTime : (tOff ?? (depoRows.length > 0 ? depoRows[depoRows.length - 1].stepAllTime : 0));
  const plOffTime = plRfOffInfo ? plRfOffInfo.stepAllTime : null;

  /**
   * [방안 2] T/V End 시점: '행(Row) 기반 0.1초 정밀 델타' 산출
   * - RF Set 0W 기준점 행(rfIdx)부터 T/V가 POSITION 또는 OPEN으로 전환된 행까지의 정확한 행 간격 × 0.1초
   * - 스텝 전환 시 시간 리셋(0.0s, 0.1s 등)이 발생해도 행 간격으로 추적하므로 오차 0.0초 보장!
   */
  const calcTvEndOffsetByRow = (
    baseStep: number | null,
    rfOffInfo: { rowIdx: number; stepAllTime: number } | null
  ): { offset: number | null; cumulativeTime: number | null } => {
    if (baseStep === null || !rfOffInfo || rfOffInfo.rowIdx === -1) {
      return { offset: null, cumulativeTime: null };
    }

    const isRowTvPressure = (r: RawLogRow) => {
      const modeSet = (r.tvCtrlModeSet || '').trim().toUpperCase();
      const modeAct = (r.tvCtrlMode || '').trim().toUpperCase();
      if (modeSet.includes('PRESS') || modeAct.includes('PRESS')) return true;

      const modes = getAllTvCtrlModesFromRow(r);
      if (modes.some(m => m.includes('PRESS'))) return true;

      if (!modeSet && !modeAct && modes.length === 0) {
        return (r.tvPressureSet ?? 0) > 0;
      }
      return false;
    };

    const isRowTvOff = (r: RawLogRow) => {
      // PRESSURE 제어 상태면 절대 OFF가 아님 (상호 배타적 보장)
      if (isRowTvPressure(r)) return false;

      const modeSet = (r.tvCtrlModeSet || '').trim().toUpperCase();
      const modeAct = (r.tvCtrlMode || '').trim().toUpperCase();
      if (modeSet.includes('POS') || modeSet.includes('OPEN')) return true;
      if (modeAct.includes('POS') || modeAct.includes('OPEN')) return true;

      const modes = getAllTvCtrlModesFromRow(r);
      if (modes.some(m => m.includes('POS') || m.includes('OPEN'))) return true;

      return (r.tvPressureSet ?? 0) <= 0;
    };

    const rfIdx = rfOffInfo.rowIdx;
    const baseRows = rows.filter(r => r.step === baseStep);
    const baseDuration = baseRows.length > 0 ? (baseRows[baseRows.length - 1].stepAllTime || 0) : 0;

    // 해당 스텝에서 T/V Pressure 제어가 동작한 적이 있는지 확인
    const hasTvPressureInStep = baseRows.some(isRowTvPressure);
    if (!hasTvPressureInStep) {
      return { offset: null, cumulativeTime: null };
    }

    const baseFirstIdx = rows.findIndex(r => r.step === baseStep);

    // 1) RF Off 지점 이전에 이미 T/V가 PRESSURE -> POSITION/OPEN으로 전환된 경우 (스텝 내부 조기 전환)
    // 가스 End 로직(calcGasEndOffsetBySet)과 동일하게 순방향 하강 에지(Falling Edge 전이점) 감지
    let earlyOffIdx = -1;
    for (let i = baseFirstIdx + 1; i <= rfIdx; i++) {
      if (isRowTvPressure(rows[i - 1]) && isRowTvOff(rows[i])) {
        earlyOffIdx = i;
        break;
      }
    }

    if (earlyOffIdx !== -1) {
      const deltaRow = earlyOffIdx - rfIdx;
      const offset = Math.round(deltaRow * 0.1 * 10) / 10;
      const cumTime = (rfOffInfo.stepAllTime ?? baseDuration) + offset;
      return {
        offset,
        cumulativeTime: Math.round(cumTime * 10) / 10,
      };
    }

    // 2) RF Off 지점(rfIdx) 이후부터 순회하여 T/V가 POSITION / OPEN으로 전환된 첫 행 포착
    for (let i = rfIdx; i < rows.length; i++) {
      const r = rows[i];
      if (isRowTvOff(r)) {
        const deltaRow = i - rfIdx;
        const offset = Math.round(deltaRow * 0.1 * 10) / 10;
        const cumTime = (rfOffInfo.stepAllTime ?? baseDuration) + offset;
        return {
          offset,
          cumulativeTime: Math.round(cumTime * 10) / 10,
        };
      }
      if (r.step > baseStep + 2) break;
    }

    return {
      offset: 0.0,
      cumulativeTime: Math.round(baseDuration * 10) / 10,
    };
  };

  /**
   * [방안 3] 모든 Gas End 시점: 'Gas Set 컬럼' 기반 차단 감지
   * - 유량 센서 측정값(Act)의 잔류 드리프트 대신 레시피 Gas Set 컬럼이 0sccm으로 떨어지는 행을 감지
   * - RF Set 0W 기준점 행(rfIdx)과의 행 델타 × 0.1초로 오프셋 산출 (SiH4 조기 차단 시 정상 음수 산출)
   */
  const calcGasEndOffsetBySet = (
    baseStep: number | null,
    setGetter: (r: RawLogRow) => number | null | undefined,
    actGetter: (r: RawLogRow) => number | null | undefined,
    rfOffInfo: { rowIdx: number; stepAllTime: number } | null,
    gasThreshold = 0.1
  ): { offset: number | null; cumulativeTime: number | null } => {
    if (baseStep === null || !rfOffInfo || rfOffInfo.rowIdx === -1) {
      return { offset: null, cumulativeTime: null };
    }

    const baseRows = rows.filter(r => r.step === baseStep);
    if (baseRows.length === 0) return { offset: null, cumulativeTime: null };

    // 해당 스텝에서 해당 가스가 공급된 적이 있는지 확인
    const hasGasSetInStep = baseRows.some(r => (setGetter(r) ?? 0) > gasThreshold);
    const hasGasActInStep = baseRows.some(r => (actGetter(r) ?? 0) >= 5);
    if (!hasGasSetInStep && !hasGasActInStep) {
      return { offset: null, cumulativeTime: null };
    }

    const rfIdx = rfOffInfo.rowIdx;
    const baseFirstIdx = rows.findIndex(r => r.step === baseStep);
    const baseLastRow = baseRows[baseRows.length - 1];
    const baseDuration = baseLastRow.stepAllTime || 0;

    // Set 컬럼 데이터 존재 여부
    const hasSetData = rows.some(r => (setGetter(r) ?? 0) > 0);
    const valGetter = hasSetData ? (r: RawLogRow) => (setGetter(r) ?? 0) : (r: RawLogRow) => (actGetter(r) ?? 0);
    const thresh = hasSetData ? gasThreshold : 5;

    // 1) RF Off 이전(스텝 내부)에서 가스 Set이 0으로 떨어진 경우 (예: SiH4 Set이 4400 -> 0sccm으로 조기 차단)
    let earlyGasDropIdx = -1;
    for (let i = baseFirstIdx + 1; i <= rfIdx; i++) {
      const prevVal = valGetter(rows[i - 1]);
      const currVal = valGetter(rows[i]);
      if (prevVal > thresh && currVal <= thresh) {
        earlyGasDropIdx = i;
        break;
      }
    }

    if (earlyGasDropIdx !== -1) {
      const deltaRow = earlyGasDropIdx - rfIdx;
      const offset = Math.round(deltaRow * 0.1 * 10) / 10;
      const cumTime = (rfOffInfo.stepAllTime ?? baseDuration) + offset;
      return {
        offset,
        cumulativeTime: Math.round(cumTime * 10) / 10,
      };
    }

    // 2) RF Off 시점 이후에서 가스 Set이 0으로 떨어진 경우
    for (let i = rfIdx; i < rows.length; i++) {
      const r = rows[i];
      const val = valGetter(r);
      if (val <= thresh) {
        const deltaRow = i - rfIdx;
        const offset = Math.round(deltaRow * 0.1 * 10) / 10;
        const cumTime = (rfOffInfo.stepAllTime ?? baseDuration) + offset;
        return {
          offset,
          cumulativeTime: Math.round(cumTime * 10) / 10,
        };
      }
      if (r.step > baseStep + 2) break;
    }

    return {
      offset: 0.0,
      cumulativeTime: Math.round(baseDuration * 10) / 10,
    };
  };

  // ─────────────────────────────────────────────────────────────
  // BB / 연속 Depo 전환 시 End 기준점과 칸 상태
  //  - BB 전환(RF가 꺼지지 않고 다음 Step으로 이어짐): 0.0초 = 다음 Step 전환 시점(다음 Step의 Step All Time 0.0에 해당하는 행)
  //    · Power: 다음 Step의 새 Set ± 허용오차(RF Forward 주의 %)에 2행 연속 들어온 시점 → '전환'
  //  - 연속 경계(BB 전환 또는 바로 다음 Step도 Depo):
  //    · Gas: 경계 앞뒤 행 모두에서 흐르고 있으면 '유지' (값 없음), 아니면 실제 차단 시점
  //    · T/V: 경계 앞뒤 모두 PRESSURE 제어면 Pressure Set이 같을 때 '유지', 다르면 새 Set 도달까지 '전환'
  //  - '유지'/'전환' 칸은 주의·경보 판정에서 제외 (화면에서 처리)
  // ─────────────────────────────────────────────────────────────
  // BB 전환 기준 행(0.0초): 다음 Step의 Step All Time 0.0 시점에 해당하는 행
  //  - 다음 Step 첫 행이 Step All Time 0.1로 기록되는 로그(#9 등)는 그 직전 행(Depo 마지막 행)이 0.0초
  //    → 다음 Step 행들의 시간이 원본 로그의 Step All Time과 같은 숫자로 표시됨
  //  - 첫 행이 0.0이면 다음 Step 첫 행이 0.0초
  const bbRefIdx = (() => {
    if (!isBbEnd) return -1;
    const lead = rows[endNextIdx].stepAllTime ?? 0;
    return lead > 0.05 && lead <= 0.15 && endNextIdx - 1 >= depoFirstIdx ? endNextIdx - 1 : endNextIdx;
  })();
  const endRefInfo: { rowIdx: number; stepAllTime: number } | null = isBbEnd
    ? { rowIdx: bbRefIdx, stepAllTime: totalDepoStepTime }
    : depoRfOffInfo;
  const endCellStatus: Partial<Record<string, HWCellStatus>> = {};

  /** 행 i → 행 j 사이 경과 시간(초, 부호 있음). 같은 Step 안에서는 Step All Time 차이, 그 외 행 간격 0.1초 */
  const spanSec = (i: number, j: number): number => {
    if (i === j) return 0;
    const lo = Math.min(i, j);
    const hi = Math.max(i, j);
    let sum = 0;
    for (let k = lo + 1; k <= hi; k++) {
      const a = rows[k - 1];
      const b = rows[k];
      const d = (b.stepAllTime ?? 0) - (a.stepAllTime ?? 0);
      sum += a.step === b.step && d > 0 && d <= 2 ? d : 0.1;
    }
    const v = Math.round(sum * 10) / 10;
    return j >= i ? v : -v;
  };
  const isTvPressureRow = (r: RawLogRow) => {
    const modeSet = (r.tvCtrlModeSet || '').trim().toUpperCase();
    const modeAct = (r.tvCtrlMode || '').trim().toUpperCase();
    if (modeSet.includes('PRESS') || modeAct.includes('PRESS')) return true;
    const modes = getAllTvCtrlModesFromRow(r);
    if (modes.some(m => m.includes('PRESS'))) return true;
    if (!modeSet && !modeAct && modes.length === 0) return (r.tvPressureSet ?? 0) > 0;
    return false;
  };
  /** 가장 많이 나온 값 (0 제외) */
  const modeOf = (vals: number[]): number => {
    const cnt = new Map<number, number>();
    vals.filter(v => v > 0).forEach(v => cnt.set(v, (cnt.get(v) ?? 0) + 1));
    let best = 0;
    let bestN = 0;
    cnt.forEach((n, v) => { if (n > bestN) { best = v; bestN = n; } });
    return best;
  };
  type GasGetter = (r: RawLogRow) => number | null | undefined;
  /** 가스가 해당 행에서 흐르는지: Set 데이터가 있으면 Set > 0.1, 없으면 Act ≥ 5 */
  const makeGasOn = (setG: GasGetter, actG: GasGetter) => {
    const hasSet = rows.some(r => (setG(r) ?? 0) > 0);
    return (r: RawLogRow) => (hasSet ? (setG(r) ?? 0) > 0.1 : (actG(r) ?? 0) >= 5);
  };
  /** 연속 경계(lastIdx → firstIdx)에서 가스가 끊기지 않고 이어지는지 */
  const gasContinues = (setG: GasGetter, actG: GasGetter, lastIdx: number, firstIdx: number) => {
    if (lastIdx < 0 || firstIdx < 0) return false;
    const on = makeGasOn(setG, actG);
    return on(rows[lastIdx]) && on(rows[firstIdx]);
  };
  const endNextStepRows = endNextIdx >= 0 ? rows.filter(r => r.step === rows[endNextIdx].step) : [];
  /** '전환' 칸의 Act 도달 시간 (툴팁용, 키 = 필드 이름) */
  const endActReach: Partial<Record<string, number | null>> = {};
  /**
   * Set이 다음 Step 값(target)으로 바뀐 행 찾기
   * - 다음 Step 첫 행이 이미 target이면, Depo 끝쪽으로 거슬러 올라가 target이 시작된 첫 행 (Step 전환 전에 미리 바뀐 경우 음수)
   * - 아니면 다음 Step 안에서 target이 처음 나온 행
   */
  const findSetChangeIdx = (getter: (r: RawLogRow) => number, target: number): number | null => {
    if (endNextIdx < 0 || target <= 0) return null;
    const near = (v: number) => Math.abs(v - target) <= Math.max(1, target * 0.01);
    if (near(getter(rows[endNextIdx]))) {
      let k = endNextIdx;
      while (k - 1 >= depoFirstIdx && near(getter(rows[k - 1]))) k--;
      return k;
    }
    for (let k = endNextIdx + 1; k < rows.length && rows[k].step === rows[endNextIdx].step; k++) {
      if (near(getter(rows[k]))) return k;
    }
    return null;
  };

  const calcGasEndBb = (field: string, setG: GasGetter, actG: GasGetter): { offset: number | null; cumulativeTime: number | null } => {
    if (isContEnd && gasContinues(setG, actG, depoLastIdx, endNextIdx)) {
      endCellStatus[field] = 'keep';
      return { offset: null, cumulativeTime: null };
    }
    return calcGasEndOffsetBySet(depoStep, setG, actG, endRefInfo);
  };

  const calcTvEndBb = (): { offset: number | null; cumulativeTime: number | null } => {
    if (isContEnd && endNextIdx >= 0 && isTvPressureRow(rows[depoLastIdx]) && isTvPressureRow(rows[endNextIdx])) {
      const pDepo = modeOf(depoRows.filter(isTvPressureRow).map(r => r.tvPressureSet ?? 0));
      const pNext = modeOf(endNextStepRows.filter(isTvPressureRow).map(r => r.tvPressureSet ?? 0));
      if (pDepo <= 0 || pNext <= 0 || Math.abs(pNext - pDepo) <= Math.max(1, pDepo * 0.005)) {
        endCellStatus.depo_tvCtrlMode = 'keep';
        return { offset: null, cumulativeTime: null };
      }
      // Pressure Set 변경: 표 값 = Pressure Set이 다음 Step 값으로 바뀐 시점 (다른 End 칸과 같은 Set 기준)
      // 툴팁 = Pressure Act가 새 Set ± T/V Pressure 주의 %(기본 2%)에 2행 연속 들어온 시점
      endCellStatus.depo_tvCtrlMode = 'trans';
      const refIdx = endRefInfo ? endRefInfo.rowIdx : endNextIdx;
      const tolP = (settings.ecPressureWarningPct ?? 2) / 100;
      const inP = (r: RawLogRow | undefined) => !!r && r.step === rows[endNextIdx].step && Math.abs((r.tvPressure ?? 0) - pNext) <= pNext * tolP;
      endActReach.depo_tvCtrlMode = null;
      for (let k = endNextIdx; k < rows.length && rows[k].step === rows[endNextIdx].step; k++) {
        if (inP(rows[k]) && inP(rows[k + 1])) {
          endActReach.depo_tvCtrlMode = spanSec(refIdx, k);
          break;
        }
      }
      const setIdx = findSetChangeIdx(r => r.tvPressureSet ?? 0, pNext);
      if (setIdx === null) return { offset: null, cumulativeTime: null };
      const off = spanSec(refIdx, setIdx);
      return { offset: off, cumulativeTime: Math.round(((endRefInfo?.stepAllTime ?? totalDepoStepTime) + off) * 10) / 10 };
    }
    return calcTvEndOffsetByRow(depoStep, endRefInfo);
  };

  // Power (BB 전환):
  //  - 표 값 = Fwd Set이 다음 Step 값으로 바뀐 시점 (0.0초 = Step 전환 기준 행, 미리 바뀌면 음수). 다음 Step Set이 같으면 '유지'
  //  - 툴팁 = Fwd Act가 새 Set ± RF Forward 주의 %(기본 2%)에 2행 연속 들어온 시점
  let bbPowerTrans: number | null = null;
  if (isBbEnd) {
    const nextRfSet = modeOf(endNextStepRows.map(rfSetOf));
    const lastDepoSet = rfSetOf(rows[depoLastIdx - 1] ?? rows[depoLastIdx]);
    const prevSet = depoLastIdx >= 1 && rows[depoLastIdx - 1].step === depoStep ? lastDepoSet : baseSet;
    if (nextRfSet > 0 && Math.abs(nextRfSet - prevSet) <= Math.max(1, prevSet * 0.01) && Math.abs(nextRfSet - baseSet) <= Math.max(1, baseSet * 0.01)) {
      endCellStatus.depo_rfForwardAct = 'keep';
    } else {
      endCellStatus.depo_rfForwardAct = 'trans';
      const setIdx = findSetChangeIdx(rfSetOf, nextRfSet);
      bbPowerTrans = setIdx !== null ? spanSec(bbRefIdx, setIdx) : null;
      const inRf = (r: RawLogRow | undefined) => {
        if (!r || r.step !== rows[endNextIdx].step) return false;
        const sv = rfSetOf(r);
        return sv > 0 && Math.abs(r.rfForwardPowerAct - sv) <= sv * (rfTolerance / 100);
      };
      endActReach.depo_rfForwardAct = null;
      for (let k = endNextIdx; k < rows.length && rows[k].step === rows[endNextIdx].step; k++) {
        if (inRf(rows[k]) && inRf(rows[k + 1])) {
          endActReach.depo_rfForwardAct = spanSec(bbRefIdx, k);
          break;
        }
      }
    }
  }

  // Depo Control End Time 계산 (T/V 및 Gas 7종 Set 기반)
  const tvDepoTiming = calcTvEndBb();
  const gasDepoSiH4 = calcGasEndBb('depo_pyroSiH4', r => r.pyroSiH4Set, r => r.pyroSiH4);
  const gasDepoN2O = calcGasEndBb('depo_pyroN2O', r => r.pyroN2OSet, r => r.pyroN2O);
  const gasDepoNH3 = calcGasEndBb('depo_pyroNH3', r => r.pyroNH3Set, r => r.pyroNH3);
  const gasDepoPN2 = calcGasEndBb('depo_pyroPN2', r => r.pyroPN2Set, r => r.pyroPN2);
  const gasDepoH2 = calcGasEndBb('depo_pyroH2', r => r.pyroH2Set, r => r.pyroH2);
  const gasDepoAr = calcGasEndBb('depo_pyroAr', r => Math.max(r.pyroArSet ?? 0, r.oxyArSet ?? 0), r => Math.max(r.pyroAr ?? 0, r.oxyAr ?? 0));
  const depoRefTime = isBbEnd ? totalDepoStepTime : rfOffTimeDepo;

  // PL Control End Time 계산 (T/V 및 Gas 2종: Ar, H2 Set 기반)
  const tvPlTiming = isLastDepo ? calcTvEndOffsetByRow(plEndStep, plRfOffInfo) : { offset: null, cumulativeTime: null };
  const gasPlAr = isLastDepo ? calcGasEndOffsetBySet(plEndStep, r => Math.max(r.pyroArSet ?? 0, r.oxyArSet ?? 0), r => Math.max(r.pyroAr ?? 0, r.oxyAr ?? 0), plRfOffInfo) : { offset: null, cumulativeTime: null };
  const gasPlH2 = isLastDepo ? calcGasEndOffsetBySet(plEndStep, r => r.pyroH2Set, r => r.pyroH2, plRfOffInfo) : { offset: null, cumulativeTime: null };

  const hwEndRF: HWControlEndRFRow = {
    fileId: file.id,
    fileName: file.fileName,
    no,
    rcpName,
    depo_rfForwardAct: isBbEnd ? bbPowerTrans : 0.0,
    depo_tvCtrlMode: tvDepoTiming.offset,
    depo_pyroSiH4: gasDepoSiH4.offset,
    depo_pyroAr: gasDepoAr.offset,
    depo_pyroN2O: gasDepoN2O.offset,
    depo_pyroNH3: gasDepoNH3.offset,
    depo_pyroPN2: gasDepoPN2.offset,
    depo_pyroH2: gasDepoH2.offset,
    pl_rfForwardAct: isLastDepo && plOffTime !== null ? 0.0 : null,
    pl_tvCtrlMode: tvPlTiming.offset,
    pl_pyroAr: gasPlAr.offset,
    pl_pyroH2: gasPlH2.offset,
    endRef: isBbEnd ? 'stepChange' : 'rfOff',
    bbEnd: bbEndInfo && bbEndInfo.continuation
      ? { otherStep: bbEndInfo.otherStep, otherIsDepo: bbEndInfo.otherIsDepo, bbFlag: bbEndInfo.bbFlag, rfContinuous: bbEndInfo.rfContinuous, specificGas: bbEndInfo.specificGas }
      : null,
    cellStatus: endCellStatus,
    actReach: endActReach,
  };

  const totalStepTimeStable = depoStableRows.length > 0 ? (depoStableRows[depoStableRows.length - 1].stepAllTime || 15.0) : 15.0;
  const totalStepTimePL = (isLastDepo && plRows.length > 0) ? plRows[plRows.length - 1].stepAllTime : null;

  const hwEndStep: HWControlEndStepRow = {
    fileId: file.id,
    fileName: file.fileName,
    no,
    rcpName,
    totalStepTimeStable: Math.round(totalStepTimeStable * 10) / 10,
    totalStepTimeDepo: Math.round(totalDepoStepTime * 10) / 10,
    totalStepTimePL: totalStepTimePL !== null ? Math.round(totalStepTimePL * 10) / 10 : null,
    depo_rfOffTime: Math.round(depoRefTime * 10) / 10,
    depo_rfForwardAct: isBbEnd
      ? (bbPowerTrans !== null ? Math.round((depoRefTime + bbPowerTrans) * 10) / 10 : null)
      : Math.round(rfOffTimeDepo * 10) / 10,
    depo_tvCtrlMode: tvDepoTiming.cumulativeTime,
    depo_pyroSiH4: gasDepoSiH4.cumulativeTime,
    depo_pyroAr: gasDepoAr.cumulativeTime,
    depo_pyroN2O: gasDepoN2O.cumulativeTime,
    depo_pyroNH3: gasDepoNH3.cumulativeTime,
    depo_pyroPN2: gasDepoPN2.cumulativeTime,
    depo_pyroH2: gasDepoH2.cumulativeTime,
    pl_rfOffTime: isLastDepo && plOffTime !== null ? Math.round(plOffTime * 10) / 10 : null,
    pl_rfForwardAct: isLastDepo && plOffTime !== null ? Math.round(plOffTime * 10) / 10 : null,
    pl_tvCtrlMode: tvPlTiming.cumulativeTime,
    pl_pyroAr: gasPlAr.cumulativeTime,
    pl_pyroH2: gasPlH2.cumulativeTime,
    endRef: isBbEnd ? 'stepChange' : 'rfOff',
    cellStatus: endCellStatus,
  };

  // 9. Delays
  // ① (시작) RF On -> RF FWD (Act) ≥ 10W 소요시간
  // ② (시작) RF FWD (Act) ≥ 10W 시점 -> Matcher Vdc ≤ -10V 시점까지 소요시간
  const isRfOnFlag = (r: RawLogRow) => {
    const s = String(r.rfOn ?? '').trim().toLowerCase();
    return s === 'on' || s === '1' || Number(r.rfOn) >= 1;
  };

  const rfOnRow = depoRows.find(isRfOnFlag) ?? rows.find(r => r.step >= depoStep && isRfOnFlag(r)) ?? depoRows[0];
  const rfActRow = depoRows.find(r => (r.rfForwardPowerAct ?? 0) >= 10);
  const matcherVdcRow = depoRows.find(r => r.matcherDCBias !== null && r.matcherDCBias !== undefined && r.matcherDCBias <= -10)
    ?? depoRows.find(r => (r.matcherVpp ?? 0) >= 10 || (r.matcherIrms ?? 0) >= 1);

  const rfOnTime = rfOnRow ? Math.round((rfOnRow.stepAllTime ?? 0) * 10) / 10 : null;
  const rfForwardPowerActTime = rfActRow ? Math.round((rfActRow.stepAllTime ?? 0) * 10) / 10 : null;
  const matcherVdcTime = matcherVdcRow ? Math.round((matcherVdcRow.stepAllTime ?? 0) * 10) / 10 : null;
  const matcherVppTime = matcherVdcTime;

  // ① RF Delay: RF On -> RF FWD (Act) ≥ 10W
  const rfDelay = (rfOnRow && rfActRow)
    ? Math.round(Math.max(0, rfActRow.elapsedSec - rfOnRow.elapsedSec) * 10) / 10
    : null;

  // ② Matcher Delay: RF FWD (Act) ≥ 10W -> Matcher Vdc ≤ -10V
  const matcherDelay = (rfActRow && matcherVdcRow)
    ? Math.round(Math.max(0, matcherVdcRow.elapsedSec - rfActRow.elapsedSec) * 10) / 10
    : null;

  const calcGasDelay = (actualGetter: (r: RawLogRow) => number, setGetter: (r: RawLogRow) => number): number | null => {
    const firstSet = rows.find(r => setGetter(r) >= 1);
    const firstAct = rows.find(r => actualGetter(r) >= 1);
    if (!firstSet || !firstAct) return null;
    return Math.round((firstAct.elapsedSec - firstSet.elapsedSec) * 10) / 10;
  };

  const delays: DelaysRow = {
    fileId: file.id,
    fileName: file.fileName,
    no,
    rcpName,
    rfOnTime,
    rfForwardPowerActTime,
    matcherVdcTime,
    matcherVppTime,
    rfDelay,
    matcherDelay,
    gasDelay_oxyNF3: calcGasDelay(r => r.oxyNF3, r => r.oxyNF3Set),
    gasDelay_pyroAr: calcGasDelay(r => r.pyroAr, r => r.pyroArSet) ?? calcGasDelay(r => r.oxyAr, r => r.oxyArSet),
    gasDelay_pyroN2O: calcGasDelay(r => r.pyroN2O, r => r.pyroN2OSet),
    gasDelay_pyroNH3: calcGasDelay(r => r.pyroNH3, r => r.pyroNH3Set),
    gasDelay_pyroPN2: calcGasDelay(r => r.pyroPN2, r => r.pyroPN2Set),
    gasDelay_pyroSiH4: calcGasDelay(r => r.pyroSiH4, r => r.pyroSiH4Set),
    gasDelay_pyroH2: calcGasDelay(r => r.pyroH2, r => r.pyroH2Set),
  };

  // 10. Deviation and Uniformity in Analysis Window
  // RF Forward & Gas & Pressure & Lift: Set 대비 편차 % = (Min 또는 Max - 기준Set) / 기준Set * 100
  // Min 편차와 Max 편차 셀은 각각 따로 판정
  const buildDevStatPct = (
    getter: (r: RawLogRow) => number,
    setValue: number | null | undefined,
    warningPct: number | null | undefined,
    alarmPct: number | null | undefined,
    customRows?: RawLogRow[]
  ): DeviationStat => {
    const targetRows = (customRows && customRows.length > 0) ? customRows : windowRows;
    if (targetRows.length === 0) {
      return { min: null, max: null, minAlarmLevel: 'normal', maxAlarmLevel: 'normal', alarmLevel: 'normal' };
    }
    const vals = targetRows.map(getter).filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (vals.length === 0) {
      return { min: null, max: null, minAlarmLevel: 'normal', maxAlarmLevel: 'normal', alarmLevel: 'normal' };
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

    let minDevPct: number | null = null;
    let maxDevPct: number | null = null;

    if (setValue !== null && setValue !== undefined && setValue > 0) {
      minDevPct = Math.round(((min - setValue) / setValue) * 1000) / 10;
      maxDevPct = Math.round(((max - setValue) / setValue) * 1000) / 10;
    }

    const minAlarmLevel = evaluateLevel(minDevPct, 'bidirectional', warningPct, alarmPct);
    const maxAlarmLevel = evaluateLevel(maxDevPct, 'bidirectional', warningPct, alarmPct);
    const alarmLevel: 'normal' | 'warning' | 'alarm' =
      minAlarmLevel === 'alarm' || maxAlarmLevel === 'alarm'
        ? 'alarm'
        : minAlarmLevel === 'warning' || maxAlarmLevel === 'warning'
        ? 'warning'
        : 'normal';

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      minDevPct,
      maxDevPct,
      minDev: minDevPct,
      maxDev: maxDevPct,
      minAlarmLevel,
      maxAlarmLevel,
      alarmLevel,
      isWarning: alarmLevel === 'warning',
      isAlarm: alarmLevel === 'alarm',
    };
  };

  // Uniformity % = (Max - Min) / (2 × |평균|) * 100 (평균은 절대값 사용)
  // 대상: Matcher Vpp, Matcher Irms, Matcher DC Bias, T/V Position
  // 방향: 상한
  const buildUniformityStat = (
    getter: (r: RawLogRow) => number,
    warningPct: number | null | undefined,
    alarmPct: number | null | undefined,
    mode: 'unif' | 'range' = 'unif'
  ): DeviationStat => {
    if (windowRows.length === 0) {
      return { min: null, max: null, alarmLevel: 'normal' };
    }
    const vals = windowRows.map(getter).filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (vals.length === 0) {
      return { min: null, max: null, alarmLevel: 'normal' };
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const absAvg = Math.abs(avg);

    let uniformityPct: number | null = null;
    if (max !== null && min !== null && (max + min) !== 0) {
      uniformityPct = Math.round(((max - min) / (max + min)) * 1000) / 10;
    } else if (absAvg > 0.0001) {
      uniformityPct = Math.round(((max - min) / (2 * absAvg)) * 1000) / 10;
    }

    const range = Math.round((max - min) * 10) / 10;
    // 판정값: 'unif' = Unif.%, 'range' = Max − Min 편차 절대값 (Vdc: V, T/V Position: %)
    const alarmLevel = evaluateLevel(mode === 'range' ? range : uniformityPct, 'upper', warningPct, alarmPct);

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      uniformityPct,
      range,
      alarmLevel,
      isWarning: alarmLevel === 'warning',
      isAlarm: alarmLevel === 'alarm',
    };
  };

  // Heater Zone: 비율이 아니라 온도 차이로 계산 (℃)
  // Min 편차(℃) = Min - Set, Max 편차(℃) = Max - Set
  // 대상: Gate In 1, Window In 3, Window Out 4, Side 1 In 5
  // 방향: 양방향 (Warning 5 ℃, Alarm 10 ℃)
  const buildHeaterDevStat = (
    getter: (r: RawLogRow) => number,
    setValue: number | null | undefined
  ): DeviationStat => {
    if (windowRows.length === 0) {
      return { min: null, max: null, isHeaterC: true, minAlarmLevel: 'normal', maxAlarmLevel: 'normal', alarmLevel: 'normal' };
    }
    const vals = windowRows.map(getter).filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (vals.length === 0) {
      return { min: null, max: null, isHeaterC: true, minAlarmLevel: 'normal', maxAlarmLevel: 'normal', alarmLevel: 'normal' };
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

    let minDev: number | null = null;
    let maxDev: number | null = null;
    let minDevPct: number | null = null;
    let maxDevPct: number | null = null;

    if (setValue !== null && setValue !== undefined && setValue > 0) {
      minDev = Math.round((min - setValue) * 10) / 10;
      maxDev = Math.round((max - setValue) * 10) / 10;
      minDevPct = Math.round(((min - setValue) / setValue) * 1000) / 10;
      maxDevPct = Math.round(((max - setValue) / setValue) * 1000) / 10;
    }

    const minAlarmLevel = evaluateLevel(minDev, 'bidirectional', settings.ecHeaterWarningC, settings.ecHeaterAlarmC);
    const maxAlarmLevel = evaluateLevel(maxDev, 'bidirectional', settings.ecHeaterWarningC, settings.ecHeaterAlarmC);
    const alarmLevel: 'normal' | 'warning' | 'alarm' =
      minAlarmLevel === 'alarm' || maxAlarmLevel === 'alarm'
        ? 'alarm'
        : minAlarmLevel === 'warning' || maxAlarmLevel === 'warning'
        ? 'warning'
        : 'normal';

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      minDev,
      maxDev,
      minDevPct,
      maxDevPct,
      isHeaterC: true,
      minAlarmLevel,
      maxAlarmLevel,
      alarmLevel,
      isWarning: alarmLevel === 'warning',
      isAlarm: alarmLevel === 'alarm',
    };
  };

  // RF Reflect Power: Min, Max(W)와 "Forward 대비 비율 %" = Max / 기준Set * 100
  // "편차"라는 열 이름은 쓰지 않음. 판정은 Max(W) 기준 상한(Warning 100W, Alarm 200W)
  const reflectVals = windowRows.map(r => r.rfReflectPower).filter(v => v !== null && !isNaN(v) && isFinite(v));
  const minReflect = reflectVals.length > 0 ? Math.min(...reflectVals) : null;
  const maxReflect = reflectVals.length > 0 ? Math.max(...reflectVals) : null;

  let minReflectDevPct: number | null = null;
  let maxReflectDevPct: number | null = null;
  if (baseSet > 0) {
    if (minReflect !== null) minReflectDevPct = Math.round((minReflect / baseSet) * 1000) / 10;
    if (maxReflect !== null) maxReflectDevPct = Math.round((maxReflect / baseSet) * 1000) / 10;
  }

  const rfReflectStat: DeviationStat = {
    min: minReflect !== null ? Math.round(minReflect * 10) / 10 : null,
    max: maxReflect !== null ? Math.round(maxReflect * 10) / 10 : null,
    minDev: minReflect !== null ? Math.round(minReflect * 10) / 10 : null,
    maxDev: maxReflect !== null ? Math.round(maxReflect * 10) / 10 : null,
    minDevPct: minReflectDevPct,
    maxDevPct: maxReflectDevPct,
    isReflectW: true,
    ratioToForwardPct: maxReflectDevPct,
    minAlarmLevel: 'normal',
    maxAlarmLevel: rfReflectAlarmLevel,
    alarmLevel: rfReflectAlarmLevel,
    isWarning: rfReflectAlarmLevel === 'warning',
    isAlarm: rfReflectAlarmLevel === 'alarm',
  };

  // SiH4 및 공정 가스 유효 공급 구간 재설정 (SiH4 밸브가 닫히기 전, 즉 RSD 진입 직전 시점으로 유효 구간 재설정)
  // Step 종료 부근 SiH4가 차단되어 0 sccm으로 떨어진 tail 행들이 분석 구간에 포함되어 -100% 편차가 발생하는 오류 완벽 방지
  const getGasActiveWindowRows = (getter: (r: RawLogRow) => number, setVal: number | null | undefined): RawLogRow[] => {
    // 1. windowRows 내부에서 SiH4 차단(RSD 진입) 전 & 실제 가스가 유효하게 공급되는 정상 공급 행만 추출
    const inWindow = windowRows.filter(r => {
      if (sih4CutoffTime !== null && r.stepAllTime >= (sih4CutoffTime - 0.05)) {
        return false;
      }
      if (setVal && setVal > 0) {
        return getter(r) >= (setVal * 0.3);
      }
      return getter(r) >= 10;
    });
    if (inWindow.length > 0) return inWindow;

    // 2. 만약 windowRows에 해당 조건 행이 없다면 depoRows의 정상 공급 구간에서 추출
    const validDepoRows = depoRows.filter(r => {
      const endLimit = sih4CutoffTime !== null ? Math.min(roundedWindowEnd, sih4CutoffTime) : roundedWindowEnd;
      const isTimeValid = r.stepAllTime >= roundedWindowStart && r.stepAllTime <= endLimit;
      if (!isTimeValid) return false;
      if (setVal && setVal > 0) {
        return getter(r) >= (setVal * 0.3);
      }
      return getter(r) >= 10;
    });

    return validDepoRows.length > 0 ? validDepoRows : windowRows;
  };

  const sih4ActiveRows = getGasActiveWindowRows(r => r.pyroSiH4, processData.pyroSiH4Set);

  const deviation: DeviationRow = {
    fileId: file.id,
    fileName: file.fileName,
    no,
    rcpName,
    step: depoStep!,
    timeRangeDesc: `${roundedWindowStart}s ~ ${roundedWindowEnd}s`,
    hasRampInWindowWarning,
    rfForward: buildDevStatPct(
      r => r.rfForwardPowerAct,
      baseSet > 0 ? baseSet : null,
      settings.ecRfForwardWarningPct,
      settings.ecRfForwardAlarmPct
    ),
    rfReflect: rfReflectStat,
    matcherVpp: buildUniformityStat(r => r.matcherVpp, settings.ecMatcherWarningPct, settings.ecMatcherAlarmPct),
    matcherIrms: buildUniformityStat(r => r.matcherIrms, settings.ecMatcherWarningPct, settings.ecMatcherAlarmPct),
    matcherDCBias: buildUniformityStat(r => Math.abs(r.matcherDCBias), settings.ecVdcWarningV ?? 15, settings.ecVdcAlarmV ?? 30, 'range'),
    tvPressure: buildDevStatPct(
      r => r.tvPressure,
      processData.tvPressureSet,
      settings.ecPressureWarningPct,
      settings.ecPressureAlarmPct
    ),
    tvPosition: buildUniformityStat(r => r.tvPosition, settings.ecPositionWarningPct, settings.ecPositionAlarmPct, 'range'),
    liftSpacing: buildDevStatPct(
      r => r.liftSpacing,
      processData.liftSpacingSet,
      settings.ecLiftSpacingWarningPct,
      settings.ecLiftSpacingAlarmPct
    ),
    oxyNF3: buildDevStatPct(r => r.oxyNF3, processData.oxyNF3Set, settings.ecGasWarningPct, settings.ecGasAlarmPct, getGasActiveWindowRows(r => r.oxyNF3, processData.oxyNF3Set)),
    oxyAr: buildDevStatPct(r => r.oxyAr, processData.oxyArSet, settings.ecGasWarningPct, settings.ecGasAlarmPct, getGasActiveWindowRows(r => r.oxyAr, processData.oxyArSet)),
    pyroN2O: buildDevStatPct(r => r.pyroN2O, processData.pyroN2OSet, settings.ecGasWarningPct, settings.ecGasAlarmPct, getGasActiveWindowRows(r => r.pyroN2O, processData.pyroN2OSet)),
    pyroNH3: buildDevStatPct(r => r.pyroNH3, processData.pyroNH3Set, settings.ecGasWarningPct, settings.ecGasAlarmPct, getGasActiveWindowRows(r => r.pyroNH3, processData.pyroNH3Set)),
    pyroAr: buildDevStatPct(r => r.pyroAr, processData.pyroArSet, settings.ecGasWarningPct, settings.ecGasAlarmPct, getGasActiveWindowRows(r => r.pyroAr, processData.pyroArSet)),
    pyroPN2: buildDevStatPct(r => r.pyroPN2, processData.pyroPN2Set, settings.ecGasWarningPct, settings.ecGasAlarmPct, getGasActiveWindowRows(r => r.pyroPN2, processData.pyroPN2Set)),
    pyroSiH4: buildDevStatPct(r => r.pyroSiH4, processData.pyroSiH4Set, settings.ecGasWarningPct, settings.ecGasAlarmPct, sih4ActiveRows),
    pyroH2: buildDevStatPct(r => r.pyroH2, processData.pyroH2Set, settings.ecGasWarningPct, settings.ecGasAlarmPct, getGasActiveWindowRows(r => r.pyroH2, processData.pyroH2Set)),
    gateIn1: buildHeaterDevStat(r => r.gateIn1, processData.gateIn1Set),
    gateOut2: buildHeaterDevStat(r => (r.gateOut2 ?? r.gateIn1), processData.gateOut2Set),
    windowIn3: buildHeaterDevStat(r => r.windowIn3, processData.windowIn3Set),
    windowOut4: buildHeaterDevStat(r => r.windowOut4, processData.windowOut4Set),
    side1In5: buildHeaterDevStat(r => r.side1In5, processData.side1In5Set),
    dynamicHeaterDevs: (() => {
      const map: Record<string, DeviationStat> = {};
      if (file.heaterChannelDefs) {
        file.heaterChannelDefs.forEach(def => {
          const setVal = processData.dynamicHeaters?.[def.name];
          map[def.name] = buildHeaterDevStat(
            r => {
              const actVal = r.dynamicHeaters?.[def.name]?.act;
              return actVal !== undefined && actVal !== null ? actVal : NaN;
            },
            setVal
          );
        });
      }
      return map;
    })(),
  };

  const depoStepName = stepSummaryItem?.stepName || `Step ${depoStep}`;

  return {
    fileId: file.id,
    resultId: `${file.id}_step_${depoStep}_${subIndex}`,
    fileName: file.fileName,
    no,
    displayNo,
    subIndex,
    totalDepoStepsInFile: totalDepoSteps,
    allDepoStepsInFile: allDepoSteps,
    depoStepName,
    rcpName,
    date,
    pc,
    depoStep: depoStep!,
    stableStep,
    plStepStart,
    plStepEnd,
    dynamicHeaterDefs: file.heaterChannelDefs || [],
    tOn,
    tOff,
    rfOnElapsedSec,
    tReach,
    baseSet,
    windowStart: roundedWindowStart,
    windowEnd: roundedWindowEnd,
    intervalMode: settings.analysisIntervalMode || 'set_reached',
    hasRampInWindowWarning,
    eTime,
    totalDepoStepTime,
    processData,
    monitoringData,
    hwStart,
    hwEndRF,
    hwEndStep,
    delays,
    deviation,
  };
}

/**
 * Run analysis on a parsed log file, returning an AnalysisFileResult for each detected Depo Step.
 * If the file contains multiple Depo steps (e.g. 3 Depo Steps), it produces sub-results #No-1, #No-2, #No-3
 * implementing [방안 A 서브 로우 분할 구조].
 */
export function analyzeLogFileSteps(
  file: ParsedLogFile,
  settings: AnalyzerSettings,
  ctclMatrix: CTCLMatrixData | null,
  index: number
): AnalysisFileResult[] {
  const allDetected = detectAllDepoSteps(file, settings);
  const depoSteps =
    file.manualDepoStep !== undefined && file.manualDepoStep !== null
      ? [file.manualDepoStep]
      : allDetected;
  const totalSteps = depoSteps.length;
  // 레시피 고유의 전체 증착 스텝 목록 (수동 지정 스텝이 별도인 경우도 합집합으로 보존)
  const allRecipeDepoSteps = Array.from(
    new Set([...allDetected, ...(file.manualDepoStep !== null && file.manualDepoStep !== undefined ? [file.manualDepoStep] : [])])
  ).sort((a, b) => a - b);

  return depoSteps.map((stepNum, sIdx) => {
    return analyzeLogFile(
      file,
      settings,
      ctclMatrix,
      index,
      stepNum,
      sIdx + 1,
      totalSteps,
      allRecipeDepoSteps
    );
  });
}
