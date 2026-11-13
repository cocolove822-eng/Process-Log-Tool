/**
 * Types and interfaces for PECVD Process Log Analyzer
 */

export interface LogMetadata {
  cid: string;
  lotId: string;
  substrateId: string;
  recipeName: string;
  date: string;
}

export interface RawLogRow {
  rowIndex: number;
  timeStr: string;
  timestampMs: number;
  elapsedSec: number; // Elapsed from start of file in seconds
  stepCount: number;
  step: number;
  stepName: string;
  stepTime: number;
  stepAllTime: number;
  stepTimeSet: number;

  // Gas actual & set
  oxyNF3: number;
  oxyNF3Set: number;
  oxyAr: number;
  oxyArSet: number;
  pyroN2O: number;
  pyroN2OSet: number;
  pyroNH3: number;
  pyroNH3Set: number;
  pyroAr: number;
  pyroArSet: number;
  pyroSiH4: number;
  pyroSiH4Set: number;
  pyroPN2: number;
  pyroPN2Set: number;
  pyroH2: number;
  pyroH2Set: number;

  // Pressure & Throttle Valve
  tvPressureSet: number;
  tvPressure: number;
  tvPositionSet: number;
  tvPosition: number;
  tvCtrlModeSet: string; // 'OPEN' | 'PRESSURE' | 'POSITION'
  tvCtrlMode?: string;

  // Lift
  liftPos: number;
  liftSpacingSet: number;
  liftSpacing: number;
  liftVelocity?: number | null;
  liftAccDec?: number | null;

  // Matcher
  matcherLoad: number;
  matcherTune: number;
  matcherVpp: number;
  matcherIrms: number;
  matcherDCBias: number;

  // RF
  rfOn: string; // 'On' | 'Off'
  rfForwardSetValue: number;
  rfForwardSetValueAct: number;
  rfForwardPowerAct: number;
  rfReflectPower: number;
  rfRampValueUp: number;
  rfRampTimeUp: number;
  /** RF BB Mode 플래그 ('BB'가 들어간 열, Enable/True = true). 열이 없거나 값을 읽을 수 없으면 null */
  bbMode?: boolean | null;
  /** Specific.Gas.Adj 플래그 (Enable/True = true). 열이 없으면 null */
  specificGasAdj?: boolean | null;

  // RPSC
  rpscForward: number;
  rpscReflect: number;

  // Heater Zones
  gateIn1Set: number;
  gateIn1: number;
  gateOut2Set: number;
  gateOut2?: number | null;
  windowIn3Set: number;
  windowIn3: number;
  windowOut4Set: number;
  windowOut4: number;
  side1In5Set: number;
  side1In5: number;

  // Dynamic Heater Channels (for multi-zone 6G / 8.5G / 8.6G lines)
  dynamicHeaters?: Record<string, { set: number | null; act: number | null }>;

  // Extra raw key-values
  allValues: Record<string, string | number>;
}

export interface HeaterChannelDef {
  id: string;
  name: string;
  rawSetName?: string | null;
  rawActName?: string | null;
}

export interface ParsedLogFile {
  id: string;
  fileName: string;
  meta: LogMetadata;
  headers: string[];
  missingColumns: string[];
  rows: RawLogRow[];
  stepsSummary: StepSummary[];
  heaterChannelDefs?: HeaterChannelDef[];
  manualDepoStep?: number | null;
  manualStableStep?: number | null;
  manualPlStepStart?: number;
  manualPlStepEnd?: number;
}

export interface StepSummary {
  step: number;
  stepName: string;
  rowCount: number;
  durationSec: number;
  startElapsedSec: number;
  endElapsedSec: number;
}

export interface ComplexNumber {
  r: number; // Real part (Ω)
  x: number; // Imaginary part (Ω)
}

export interface CTCLMatrixData {
  fileName: string;
  sheetName: string;
  availableSheets: string[];
  loads: number[]; // e.g. 0 to 100
  tunes: number[]; // e.g. 0 to 100
  grid: Record<number, Record<number, ComplexNumber>>; // [load][tune] = {r, x}
  /** 원본 엑셀 축 형식: 'fraction' = 0~1 비율이라 ×100 해서 %로 바꿈, 'percent' = 원래 0~100 */
  axisScale?: 'fraction' | 'percent';
}

export type CriterionState = 'include' | 'exclude' | 'ignore';

export interface DepoStepCriteriaMap {
  sih4: CriterionState;
  rf: CriterionState;
  ar?: CriterionState;
  h2?: CriterionState;
}

export interface AnalyzerSettings {
  generation: string; // '6G'
  processChamber: string; // 'A' -> 'Ch_A'
  depoGasCol: string; // 'Pyro.SiH4'
  plGasCol: string; // 'Pyro.H2'
  readOffsetSec: number; // -10
  depoStepCriteria?: DepoStepCriteriaMap; // Depo Step 판정 조건 3-State (기본값: { sih4: 'include', rf: 'include', ar: 'ignore' })
  rfStableTimeSec: number; // 3.0
  rampUpPostOffsetSec?: number; // Ramping Up 실제 도달 후 시작 시점 n초 (기본값: 3.0초)
  rfRampDownTimeSec: number; // 1.0
  rsdPreOffsetSec: number; // 1.0 (RSD 진입 전 시간 sec, 기본값: 1.0)
  rsdBandW?: number; // 300 (RSD 유지 판정 범위: RSD Power ± W, 기본값: 300)
  rfTolerancePct: number; // 2%
  rfOnThresholdDepo: number; // 300 W
  rfOnThresholdPL: number; // 500 W

  // Analysis interval mode & Ramp filter
  analysisIntervalMode: 'set_reached' | 'rf_on'; // 항상 'Ramping Up 실제 도달 기준' ('set_reached')
  autoFilterRamp: boolean; // Ramp 구간 자동 필터링 (스마트 모드, 기본값 true)

  // RF Delay Calculation Settings (엔지니어 선택 파라미터)
  rfDelayBaseSignal?: 'rfForwardAct' | 'rfForwardSet' | 'rfOnFlag'; // 기본값 'rfForwardAct'
  rfDelayBaseThreshold?: number; // 기본값 10
  rfDelayTargetSignal?: 'matcherVpp' | 'matcherIrms' | 'rfReflect'; // 기본값 'matcherVpp'
  rfDelayTargetThreshold?: number; // 기본값 1
  gasDelayReference?: string; // 기본값 'Gas Set > 0'

  // EC Criteria
  ecRfForwardWarningPct: number | null; // 2% (양방향)
  ecRfForwardAlarmPct: number | null; // 3% (양방향)
  ecRfReflectWarningW: number | null; // 100 W (상한)
  ecRfReflectAlarmW: number | null; // 200 W (상한)
  ecMatcherWarningPct: number | null; // 2% (상한 - Vpp, Irms Unif.)
  ecMatcherAlarmPct: number | null; // 3% (상한)
  ecPressureWarningPct: number | null; // 2% (양방향)
  ecPressureAlarmPct: number | null; // 5% (양방향)
  ecPositionWarningPct: number | null; // T/V Position Max−Min 1% (상한)
  ecPositionAlarmPct: number | null; // T/V Position Max−Min 2% (상한)
  ecVdcWarningV?: number | null; // Matcher DC Bias(Vdc) Max−Min 15 V (상한)
  ecVdcAlarmV?: number | null; // Matcher DC Bias(Vdc) Max−Min 30 V (상한)
  ecLiftSpacingWarningPct: number | null; // null (미설정, 양방향)
  ecLiftSpacingAlarmPct: number | null; // null (미설정, 양방향)
  ecGasWarningPct: number | null; // 3% (양방향)
  ecGasAlarmPct: number | null; // 5% (양방향)
  ecHeaterWarningC: number | null; // 5 ℃ (양방향)
  ecHeaterAlarmC: number | null; // 10 ℃ (양방향)
  ecDelayWarningSec: number | null; // 0.3 초 (상한 - RF, Matcher, Gas Delay)
  ecDelayAlarmSec: number | null; // 0.5 초 (상한 - RF, Matcher, Gas Delay)

  // Legacy field aliases
  ecMatcherAlarmPctLegacy?: number;
  ecSusceptorWarningC?: number;
  ecSusceptorAlarmC?: number;
}

export interface ProcessDataSetRow {
  fileId: string;
  fileName: string;
  no: number | string;
  rcpName: string;
  step: number;
  eTime: number | null;
  date: string;
  pc: string;
  stepTimeSet: number | null;
  depTimeStable: number | null;
  depTimeSetReached: number | null;
  depTimeWithRampUp?: number | null;
  rfOffsetHomeSpacing: number | null;
  rfForwardSetValue: number | null;
  rfForwardSetValueAct: number | null;
  rfRampUp: number | null;
  rfRampDown: number | null;
  rsdPower: number | null;
  rsdTime: number | null;
  rfRampValueUp: number | null;
  rfRampTimeUp: number | null;
  tvPressureSet: number | null;
  liftSpacingSet: number | null;

  // Gas Sets
  oxyNF3Set: number | null;
  oxyArSet: number | null;
  pyroN2OSet: number | null;
  pyroNH3Set: number | null;
  pyroArSet: number | null;
  pyroPN2Set: number | null;
  pyroSiH4Set: number | null;
  pyroH2Set: number | null;

  // Heater Sets (Standard 4 zones)
  gateIn1Set: number | null;
  gateOut2Set: number | null;
  windowIn3Set: number | null;
  windowOut4Set: number | null;
  side1In5Set: number | null;

  // Dynamic Heaters (map zone name to Set value)
  dynamicHeaters?: Record<string, number | null>;
}

export interface MonitoringDataRow {
  fileId: string;
  fileName: string;
  no: number | string;
  rcpName: string;
  stableStep: number | null;
  depoStep: number;
  plStepStart: number | null;
  plStepEnd: number | null;
  plType?: 'H2' | 'Ar' | 'none';
  rfReflectPowerMax: number | null;
  rfReflectAlarmLevel?: 'normal' | 'warning' | 'alarm';
  tvPositionAvg: number | null;
  tvPositionIsFullOpen?: boolean;
  matcherLoadAvg: number | null;
  matcherTuneAvg: number | null;
  rfChR: number | null;
  rfChX: number | null;
  matcherVppAvg: number | null;
  matcherIrmsAvg: number | null;
  matcherDCBiasAvg: number | null;
  matcherSignalWarning?: boolean;
  matcherNoSignal?: boolean;
  rsdPower?: number | null;
  rsdTime?: number | null;
  dynamicHeaterActs?: Record<string, number | null>;
}

/**
 * H/W Control 칸 상태 (BB Mode / 연속 Depo 전환)
 * - 'keep'  : 이전/다음 Step으로 끊기지 않고 이어짐 → "유지" 표시, 값 없음, 판정 제외
 * - 'trans' : Set이 다음 Step 값으로 바뀐 시점 → "전환 x.x" 표시, 판정 제외 (Act 도달 시간은 툴팁)
 */
export type HWCellStatus = 'keep' | 'trans';

/** Step 경계(이전 Step → Depo 또는 Depo → 다음 Step)의 BB / 연속 전환 정보 */
export interface HWBoundaryInfo {
  /** 경계 건너편 Step 번호 */
  otherStep: number;
  /** 경계 건너편 Step이 Depo Step인지 (연속 Depo) */
  otherIsDepo: boolean;
  /** 로그의 BB 열이 Enable/True인지 (열이 없으면 null) */
  bbFlag: boolean | null;
  /** RF가 꺼지지 않고 Step 경계를 넘어감 */
  rfContinuous: boolean;
  /** Specific.Gas.Adj 값 (열이 없으면 null) */
  specificGas: boolean | null;
}

export interface HWControlStartRow {
  fileId: string;
  fileName: string;
  no: number | string;
  rcpName: string;
  // Depo Stable Step
  depoStable_pyroAr?: number | null;
  depoStable_pyroN2O: number | null;
  depoStable_pyroNH3: number | null;
  depoStable_pyroPN2: number | null;
  depoStable_pyroH2: number | null;
  depoStable_pyroSiH4: number | null;
  depoStable_tvCtrlMode: number | null;
  // Depo Step
  depo_rfForwardAct: number | null;
  depo_rfInitialActPower?: number | null;
  // PL Stable Step
  plStable_pyroAr: number | null;
  plStable_pyroH2: number | null;
  plStable_tvCtrlMode: number | null;
  // PL Step
  pl_rfForwardAct: number | null;
  /** 이전 Step(Depo)에서 이어져 들어온 경우의 경계 정보 (없으면 일반 Start) */
  bbStart?: HWBoundaryInfo | null;
  /** 칸별 상태 (키 = 필드 이름). 'keep'이면 "유지" */
  cellStatus?: Partial<Record<string, HWCellStatus>>;
}

export interface HWControlEndRFRow {
  fileId: string;
  fileName: string;
  no: number | string;
  rcpName: string;
  // Depo Step (0.0 sec = RF Power Off)
  depo_rfForwardAct: number | null;
  depo_tvCtrlMode: number | null;
  depo_pyroSiH4: number | null;
  depo_pyroAr?: number | null;
  depo_pyroN2O: number | null;
  depo_pyroNH3: number | null;
  depo_pyroPN2: number | null;
  depo_pyroH2: number | null;
  // PL Step (0.0 sec = RF Power Off)
  pl_rfForwardAct: number | null;
  pl_tvCtrlMode: number | null;
  pl_pyroAr: number | null;
  pl_pyroH2: number | null;
  /** RF Off(0.0초) → 다음 Step 전환까지 시간 (BB 전환이면 null) */
  depo_rfOffToStep?: number | null;
  pl_rfOffToStep?: number | null;
  /**
   * End 기준점: 'rfOff' = 0.0초가 RF Power Off (기본),
   * 'stepChange' = BB 전환으로 RF가 꺼지지 않아 0.0초가 다음 Step 전환 시점
   */
  endRef?: 'rfOff' | 'stepChange';
  /** 다음 Step(Depo)으로 이어지는 경우의 경계 정보 (없으면 일반 End) */
  bbEnd?: HWBoundaryInfo | null;
  /** 칸별 상태 (키 = 필드 이름). 'keep' = "유지", 'trans' = "전환 x.x" */
  cellStatus?: Partial<Record<string, HWCellStatus>>;
  /** '전환' 칸의 Act 도달 시간(초, 툴팁용). 표 값은 Set이 바뀐 시점 */
  actReach?: Partial<Record<string, number | null>>;
}

export interface HWControlEndStepRow {
  fileId: string;
  fileName: string;
  no: number | string;
  rcpName: string;
  // Total Step Time
  totalStepTimeStable?: number | null;
  totalStepTimeDepo: number | null;
  totalStepTimePL: number | null;
  // Depo Step (0.0 sec = Step Start)
  depo_rfOffTime: number | null;
  depo_rfForwardAct: number | null;
  depo_tvCtrlMode: number | null;
  depo_pyroSiH4: number | null;
  depo_pyroAr?: number | null;
  depo_pyroN2O: number | null;
  depo_pyroNH3: number | null;
  depo_pyroPN2: number | null;
  depo_pyroH2: number | null;
  // PL Step (0.0 sec = Step Start)
  pl_rfOffTime: number | null;
  pl_rfForwardAct: number | null;
  pl_tvCtrlMode: number | null;
  pl_pyroAr: number | null;
  pl_pyroH2: number | null;
  /** End 기준점 (HWControlEndRFRow.endRef와 동일) */
  endRef?: 'rfOff' | 'stepChange';
  /** 칸별 상태 (HWControlEndRFRow.cellStatus와 동일) */
  cellStatus?: Partial<Record<string, HWCellStatus>>;
}

export interface DelaysRow {
  fileId: string;
  fileName: string;
  no: number | string;
  rcpName: string;
  // RF & Matcher Delays
  rfOnTime?: number | null;
  rfForwardPowerActTime: number | null;
  matcherVdcTime?: number | null;
  matcherVppTime: number | null;
  rfDelay: number | null; // ① (시작) RF On -> RF FWD (Act) ≥ 10W 소요시간
  matcherDelay: number | null; // ② (시작) RF FWD (Act) ≥ 10W -> Matcher Vdc ≤ -10V 소요시간
  // Gas Delays
  gasDelay_oxyNF3: number | null;
  gasDelay_pyroAr: number | null;
  gasDelay_pyroN2O: number | null;
  gasDelay_pyroNH3: number | null;
  gasDelay_pyroPN2: number | null;
  gasDelay_pyroSiH4: number | null;
  gasDelay_pyroH2: number | null;
}

export interface DeviationStat {
  min: number | null;
  max: number | null;
  avg?: number | null;
  minDevPct?: number | null; // % (or null)
  maxDevPct?: number | null; // % (or null)
  minDev?: number | null; // % or ℃ or W
  maxDev?: number | null; // % or ℃ or W
  isHeaterC?: boolean; // true if unit is ℃
  isReflectW?: boolean; // true if deviation value is in Watts (W)
  uniformityPct?: number | null;
  /** Max − Min (판정값이 Unif. 대신 편차 절대값인 항목: Vdc, T/V Position) */
  range?: number | null;
  ratioToForwardPct?: number | null; // For RF Reflect Power: Max / 기준Set * 100
  minAlarmLevel?: 'normal' | 'warning' | 'alarm'; // Min 편차 개별 판정
  maxAlarmLevel?: 'normal' | 'warning' | 'alarm'; // Max 편차 개별 판정
  alarmLevel?: 'normal' | 'warning' | 'alarm'; // Overall / Uniformity 판정
  isWarning?: boolean;
  isAlarm?: boolean;
}

export interface DeviationRow {
  fileId: string;
  fileName: string;
  no: number | string;
  rcpName: string;
  step: number;
  timeRangeDesc: string; // e.g. "All" or "Depo Window"
  hasRampInWindowWarning?: boolean;

  rfForward: DeviationStat;
  rfReflect: DeviationStat;
  matcherVpp: DeviationStat;
  matcherIrms: DeviationStat;
  matcherDCBias: DeviationStat;
  tvPressure: DeviationStat;
  tvPosition: DeviationStat;
  liftSpacing: DeviationStat;

  // Gases
  oxyNF3: DeviationStat;
  oxyAr: DeviationStat;
  pyroN2O: DeviationStat;
  pyroNH3: DeviationStat;
  pyroAr: DeviationStat;
  pyroPN2: DeviationStat;
  pyroSiH4: DeviationStat;
  pyroH2: DeviationStat;

  // Heaters (Standard 4/5 zones)
  gateIn1: DeviationStat;
  gateOut2: DeviationStat;
  windowIn3: DeviationStat;
  windowOut4: DeviationStat;
  side1In5: DeviationStat;

  // Dynamic Heaters 편차
  dynamicHeaterDevs?: Record<string, DeviationStat>;
}

export interface AnalysisFileResult {
  fileId: string;
  resultId?: string;
  fileName: string;
  no: number | string;
  displayNo: string; // e.g. "1" or "2-1", "2-2", "2-3"
  subIndex?: number; // 1, 2, 3...
  fileIndex?: number; // 0, 1, 2...
  totalDepoStepsInFile?: number;
  allDepoStepsInFile?: number[];
  depoStepName?: string;
  rcpName: string;
  date: string;
  pc: string;

  // Step detection
  depoStep: number;
  stableStep: number;
  plStepStart: number | null;
  plStepEnd: number | null;

  // Dynamic Heater Definitions
  dynamicHeaterDefs?: HeaterChannelDef[];

  // Timing & Interval
  tOn: number | null;
  tOff: number | null;
  rfOnElapsedSec?: number | null;
  tReach: number | null;
  baseSet: number | null;
  windowStart: number | null;
  windowEnd: number | null;
  intervalMode: 'rf_on' | 'set_reached';
  hasRampInWindowWarning?: boolean;
  eTime: number | null;
  totalDepoStepTime: number | null;

  // Tables
  processData: ProcessDataSetRow;
  monitoringData: MonitoringDataRow;
  hwStart: HWControlStartRow;
  hwEndRF: HWControlEndRFRow;
  hwEndStep: HWControlEndStepRow;
  delays: DelaysRow;
  deviation: DeviationRow;
}
