export interface TechSlateStepItem {
  stepNo: number;
  stepName: string;
  recipeItem: string;
  actualVal: string;
  targetVal: string;
  deviation: string;
  status: 'OK' | 'WARN' | 'ERR';
  unit?: string;
}

export interface BentoRecipeLogItem {
  recipeId: string;
  process: string;
  startTime: string;
  status: 'Completed' | 'Running' | 'Warning' | 'Standby';
  operator: string;
}

export interface BentoGanttTask {
  id: string;
  category: string;
  label: string;
  startPct: number;
  widthPct: number;
  color: string;
  subTracks?: { label: string; startPct: number; widthPct: number; color: string }[];
}

export const TECH_SLATE_SAMPLE = {
  lotId: 'FAB-A123',
  waferNo: '14',
  waferDesc: 'Wafer lot',
  status: 'RUNNING',
  elapsed: '45min elapsed',
  stability: '99.2%',
  sih4Flow: '48.1 sccm',
  yieldEst: '97.8%',
  sequenceSteps: [
    { name: '0', dur: '', active: false },
    { name: 'Wait/Rot', dur: '45min', active: false },
    { name: 'PreHeat', dur: '15min', active: false },
    { name: 'MainEtch', dur: '45min', active: true },
    { name: 'PostEtch', dur: '75min', active: false },
    { name: 'Cool', dur: '45min', active: false },
  ],
  tableRows: [
    {
      stepNo: 10,
      stepName: 'Wafer Load',
      recipeItem: 'Cassette ID',
      actualVal: '12',
      targetVal: '12',
      deviation: '0',
      status: 'OK' as const,
    },
    {
      stepNo: 20,
      stepName: 'SiH4 Gas Stabilize',
      recipeItem: 'SiH4 Flow',
      actualVal: '48.1 sccm',
      targetVal: '50 sccm',
      deviation: '-1.9 sccm',
      status: 'WARN' as const,
    },
    {
      stepNo: 30,
      stepName: 'Main Etch',
      recipeItem: 'RF Power',
      actualVal: '598 W',
      targetVal: '600 W',
      deviation: '-2 W',
      status: 'OK' as const,
    },
    {
      stepNo: 40,
      stepName: 'Main Etch',
      recipeItem: 'Bias Power',
      actualVal: '199 W',
      targetVal: '200 W',
      deviation: '-1 W',
      status: 'OK' as const,
    },
    {
      stepNo: 50,
      stepName: 'Post Etch Clean',
      recipeItem: 'Ar Flow',
      actualVal: '101 sccm',
      targetVal: '100 sccm',
      deviation: '+1 sccm',
      status: 'OK' as const,
    },
    {
      stepNo: 60,
      stepName: 'Wafer Unload',
      recipeItem: 'Cassette ID',
      actualVal: '12',
      targetVal: '12',
      deviation: '0',
      status: 'OK' as const,
    },
  ],
  rfChartPoints: [
    { t: '00:00', val: 0 },
    { t: '05:00', val: 120 },
    { t: '10:00', val: 590 },
    { t: '15:00', val: 601 },
    { t: '20:00', val: 598 },
    { t: '25:00', val: 599 },
    { t: '30:00', val: 598 },
    { t: '35:00', val: 602 },
    { t: '40:00', val: 598 },
    { t: '45:00', val: 598 },
  ],
  sih4ChartPoints: [
    { t: '00:00', val: 0 },
    { t: '05:00', val: 20 },
    { t: '10:00', val: 49.5 },
    { t: '15:00', val: 48.8 },
    { t: '20:00', val: 48.0 },
    { t: '25:00', val: 48.3 },
    { t: '30:00', val: 48.1 },
    { t: '35:00', val: 48.2 },
    { t: '40:00', val: 48.1 },
    { t: '45:00', val: 48.1 },
  ],
};

export const SOFT_BENTO_SAMPLE = {
  headerTitle: 'Fab Manufacturing Analytics',
  headerSubtitle: 'Overview & Process Status',
  kpiCards: [
    {
      id: 'yield',
      label: 'Yield Rate',
      value: '94.8%',
      trend: '+1.2%',
      isPositive: true,
      sparkline: [88, 90, 89, 92, 93, 91, 94.8],
      color: '#3182F6',
    },
    {
      id: 'cycle',
      label: 'Cycle Time',
      value: '28.5 Days',
      trend: '-1.1%',
      isPositive: true,
      sparkline: [31, 30.5, 30, 29.8, 29.2, 28.9, 28.5],
      color: '#10B981',
    },
    {
      id: 'throughput',
      label: 'Throughput',
      value: '12,500 Wafers/Week',
      trend: '+3.4%',
      isPositive: true,
      sparkline: [11200, 11500, 11800, 11950, 12100, 12300, 12500],
      color: '#F59E0B',
    },
    {
      id: 'oee',
      label: 'Equipment Efficiency',
      value: '170%',
      trend: '+0.5%',
      isPositive: true,
      sparkline: [162, 165, 164, 167, 168, 169, 170],
      color: '#8B5CF6',
    },
  ],
  recipeLogs: [
    {
      recipeId: '100101',
      process: 'Deposition',
      startTime: 'Aug 21, 01:00 PM',
      status: 'Completed' as const,
      operator: 'Gerry Kim',
    },
    {
      recipeId: '100102',
      process: 'Plasma Etch',
      startTime: 'Aug 21, 01:15 PM',
      status: 'Completed' as const,
      operator: 'Gerry Kim',
    },
    {
      recipeId: '100103',
      process: 'Plasma Etch',
      startTime: 'Aug 21, 01:30 PM',
      status: 'Completed' as const,
      operator: 'David Ahn',
    },
    {
      recipeId: '100104',
      process: 'Plasma Etch',
      startTime: 'Aug 21, 01:45 PM',
      status: 'Warning' as const,
      operator: 'Sam Smith',
    },
    {
      recipeId: '100105',
      process: 'Plasma Etch',
      startTime: 'Aug 21, 02:00 PM',
      status: 'Running' as const,
      operator: 'David Ahn',
    },
    {
      recipeId: '100106',
      process: 'Plasma Etch',
      startTime: 'Aug 21, 02:15 PM',
      status: 'Running' as const,
      operator: 'Sam Smith',
    },
  ],
  ganttTracks: [
    {
      id: 'depo',
      category: 'Deposition',
      bars: [
        { label: 'Depo Main Step', start: 10, width: 25, color: '#3182F6' },
        { label: 'Depo Cap Step', start: 40, width: 20, color: '#60A5FA' },
      ],
    },
    {
      id: 'deg',
      category: 'Degradation',
      bars: [
        { label: 'Stabilize Hold', start: 15, width: 30, color: '#F59E0B' },
      ],
    },
    {
      id: 'etch',
      category: 'Plasma Etch',
      bars: [
        { label: 'RF Strike & Main Etch', start: 50, width: 35, color: '#0284C7' },
        { label: 'Over Etch', start: 88, width: 10, color: '#38BDF8' },
      ],
    },
    {
      id: 'schedule',
      category: 'Planned Schedule',
      bars: [
        { label: 'Lot Target Window', start: 5, width: 90, color: '#94A3B8' },
      ],
    },
  ],
};

export const PURE_CLEAN_SAMPLE = {
  processName: 'PECVD GI_SIO_IRUJA Deposition',
  lotId: 'LOT_260917_01',
  waferId: 'SUB_002',
  status: 'COMPLETED',
  chamber: 'CH_A',
  recipeStep: 'Step 3 / 8',
  metrics: [
    { label: 'Deposition Time', val: '65.7s', target: '65.0s', diff: '+0.7s', status: 'OK' },
    { label: 'RF Power (Act)', val: '3,842 W', target: '3,850 W', diff: '-8 W', status: 'OK' },
    { label: 'Matcher Load/Tune', val: '62.7 / 50.7', target: '62.5 / 50.5', diff: 'Optimal', status: 'OK' },
    { label: 'Impedance R+jX', val: '0.34 - 3.67j', target: '0.33 - 3.70j', diff: 'Matched', status: 'OK' },
    { label: 'SiH4 Gas Flow', val: '1,402 sccm', target: '1,400 sccm', diff: '+2 sccm', status: 'OK' },
    { label: 'T/V Throttle Pres.', val: '781 mTorr', target: '780 mTorr', diff: '+1 mTorr', status: 'OK' },
  ],
  sequenceStages: [
    { step: 1, name: 'Pump / Purge', dur: '10.0s', color: '#94A3B8' },
    { step: 2, name: 'Gas Stabilize', dur: '15.0s', color: '#F59E0B' },
    { step: 3, name: 'Main Depo (RF ON)', dur: '65.7s', color: '#3182F6' },
    { step: 4, name: 'Pump Out', dur: '10.0s', color: '#64748B' },
    { step: 5, name: 'Gas Flush', dur: '10.0s', color: '#A855F7' },
    { step: 6, name: 'PL Treatment', dur: '25.0s', color: '#06B6D4' },
  ],
  conditionRows: [
    { item: 'RF Forward SetValue', set: '3,850 W', act: '3,842 W', dev: '-8 W', state: 'OK' },
    { item: 'RF Reflect Power', set: '< 50 W', act: '19.1 W', dev: '정상', state: 'OK' },
    { item: 'Matcher Vpp', set: '1,420 V', act: '1,412.9 V', dev: '-7.1 V', state: 'OK' },
    { item: 'Matcher Irms', set: '142 A', act: '140.4 A', dev: '-1.6 A', state: 'OK' },
    { item: 'Matcher DC Bias (Vdc)', set: '-50 V', act: '-52.7 V', dev: '-2.7 V', state: 'OK' },
    { item: 'Pyro.SiH4 Flow', set: '1,400 sccm', act: '1,402 sccm', dev: '+2 sccm', state: 'OK' },
    { item: 'Pyro.N2O Flow', set: '43,000 sccm', act: '43,060 sccm', dev: '+60 sccm', state: 'OK' },
    { item: 'T/V Position (Angle)', set: '55.0 %', act: '56.0 %', dev: '+1.0 %', state: 'OK' },
  ],
  sparklineData: [
    { time: '0s', rf: 0, sih4: 0, vpp: 0 },
    { time: '10s', rf: 50, sih4: 1380, vpp: 200 },
    { time: '20s', rf: 3840, sih4: 1401, vpp: 1410 },
    { time: '30s', rf: 3845, sih4: 1403, vpp: 1414 },
    { time: '40s', rf: 3841, sih4: 1400, vpp: 1412 },
    { time: '50s', rf: 3842, sih4: 1402, vpp: 1413 },
    { time: '60s', rf: 3840, sih4: 1399, vpp: 1411 },
    { time: '65s', rf: 2000, sih4: 0, vpp: 800 },
  ],
};
