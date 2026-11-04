import * as XLSX from 'xlsx';
import { AnalysisFileResult, AnalyzerSettings } from '../types/pecvd';

/**
 * Copy 2D array / table data to clipboard in TSV format
 */
export async function copyTableToClipboard(headers: string[], rows: (string | number | null | undefined)[][]): Promise<boolean> {
  try {
    const lines = [
      headers.join('\t'),
      ...rows.map(row => row.map(cell => (cell === null || cell === undefined ? '-' : cell)).join('\t')),
    ];
    const text = lines.join('\n');
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * Export full results to multi-sheet .xlsx workbook
 */
export function exportResultsToExcel(results: AnalysisFileResult[], settings: AnalyzerSettings, filename = 'PECVD_Process_Analysis_R1.xlsx'): void {
  const wb = XLSX.utils.book_new();

  // Dynamic heaters list across results
  const allHeaterNames = Array.from(new Set(results.flatMap(r => r.dynamicHeaterDefs?.map(d => d.name) || [])));
  const useDynamicHeaters = allHeaterNames.length > 0;

  // 1. 공정 Data Set Sheet (24열: E.Time, PC 제외 및 RSD 이동 포맷 동기화)
  const processDataHeaders = [
    'No.', 'RCP Name', 'Depo. Step', 'Date',
    'Depo. Time: Set(sec)', 'Depo. Time: Ramp Up 포함 Time(sec)',
    'Lift: Home Spacing(mils)',
    'RF Power(W)',
    'RF Ramping: Up(W/sec)', 'RF Ramping: Down(W/sec)',
    'Pres.(mTorr)', 'Spacing(mils)',
    'N2O(sccm)', 'NH3(sccm)', 'Ar(sccm)', 'PN2(sccm)', 'SiH4(sccm)', 'H2(sccm)',
    ...(useDynamicHeaters
      ? allHeaterNames.map(name => `${name}(℃)`)
      : ['Gate 1(℃)', 'Win In 3(℃)', 'Win Out 4(℃)', 'Side 5(℃)'])
  ];
  const processDataRows = results.map(r => {
    const p = r.processData;
    const actualDepTime = p.depTimeWithRampUp !== null && p.depTimeWithRampUp !== undefined
      ? Number(p.depTimeWithRampUp.toFixed(1))
      : (p.depTimeSetReached !== null ? Number(p.depTimeSetReached.toFixed(1)) : '-');
    const heaterValues = useDynamicHeaters
      ? allHeaterNames.map(name => {
          const val = p.dynamicHeaters?.[name] ?? r.monitoringData?.dynamicHeaterActs?.[name];
          return val !== null && val !== undefined && val > 0 ? Number(val.toFixed(1)) : '-';
        })
      : [
          p.gateIn1Set !== null ? Number(p.gateIn1Set.toFixed(1)) : '-',
          p.windowIn3Set !== null ? Number(p.windowIn3Set.toFixed(1)) : '-',
          p.windowOut4Set !== null ? Number(p.windowOut4Set.toFixed(1)) : '-',
          p.side1In5Set !== null ? Number(p.side1In5Set.toFixed(1)) : '-'
        ];

    return [
      p.no, p.rcpName, p.step, p.date,
      p.stepTimeSet !== null ? Number(p.stepTimeSet.toFixed(1)) : '-',
      actualDepTime,
      p.rfOffsetHomeSpacing !== null ? Math.round(p.rfOffsetHomeSpacing) : '-',
      p.rfForwardSetValue !== null ? Math.round(p.rfForwardSetValue) : '-',
      p.rfRampUp !== null ? Number(p.rfRampUp.toFixed(1)) : (p.rfRampValueUp !== null ? Number(p.rfRampValueUp.toFixed(1)) : '-'),
      p.rfRampDown !== null ? Number(p.rfRampDown.toFixed(1)) : '-',
      p.tvPressureSet !== null ? Math.round(p.tvPressureSet) : '-',
      p.liftSpacingSet !== null ? Math.round(p.liftSpacingSet) : '-',
      p.pyroN2OSet !== null ? Math.round(p.pyroN2OSet) : '-',
      p.pyroNH3Set !== null ? Math.round(p.pyroNH3Set) : '-',
      p.pyroArSet !== null ? Math.round(p.pyroArSet) : '-',
      p.pyroPN2Set !== null ? Math.round(p.pyroPN2Set) : '-',
      p.pyroSiH4Set !== null ? Math.round(p.pyroSiH4Set) : '-',
      p.pyroH2Set !== null ? Math.round(p.pyroH2Set) : '-',
      ...heaterValues
    ];
  });
  const wsProcess = XLSX.utils.aoa_to_sheet([processDataHeaders, ...processDataRows]);
  XLSX.utils.book_append_sheet(wb, wsProcess, '공정 Data Set');

  // 2. Monitoring Data Sheet
  const monHeaders = [
    'No.', 'RCP Name', 'Stable Step', 'Depo Step', 'PL Step Start', 'PL Step End',
    'Max RF Ref. Power', 'T/V Position Avg',
    'RSD Power (W)', 'RSD Time (sec)',
    'Matcher Load Avg', 'Matcher Tune Avg',
    'RF Ch. R (Ω)', 'RF Ch. X (Ω)', 'Matcher Vpp Avg', 'Matcher Irms Avg', 'Matcher DC Bias Avg'
  ];
  const monRows = results.map(r => {
    const m = r.monitoringData;
    const rsdP = m.rsdPower ?? r.processData?.rsdPower;
    const rsdT = m.rsdTime ?? r.processData?.rsdTime;
    return [
      m.no, m.rcpName, m.stableStep ?? '-', m.depoStep, m.plStepStart ?? '-', m.plStepEnd ?? '-',
      m.rfReflectPowerMax !== null ? Number(m.rfReflectPowerMax.toFixed(1)) : '-',
      m.tvPositionAvg !== null ? Number(m.tvPositionAvg.toFixed(1)) : '-',
      rsdP !== null && rsdP !== undefined ? Math.round(rsdP) : '-',
      rsdT !== null && rsdT !== undefined ? Number(rsdT.toFixed(1)) : '-',
      m.matcherLoadAvg !== null ? Number(m.matcherLoadAvg.toFixed(1)) : '-',
      m.matcherTuneAvg !== null ? Number(m.matcherTuneAvg.toFixed(1)) : '-',
      m.rfChR !== null ? Number(m.rfChR.toFixed(2)) : '-',
      m.rfChX !== null ? Number(m.rfChX.toFixed(2)) : '-',
      m.matcherVppAvg !== null ? Math.round(m.matcherVppAvg) : '-',
      m.matcherIrmsAvg !== null ? Math.round(m.matcherIrmsAvg) : '-',
      m.matcherDCBiasAvg !== null ? Number(m.matcherDCBiasAvg.toFixed(1)) : '-'
    ];
  });
  const wsMon = XLSX.utils.aoa_to_sheet([monHeaders, ...monRows]);
  XLSX.utils.book_append_sheet(wb, wsMon, 'Monitoring Data');

  // 3. HW Control Start
  const startHeaders = [
    'No.', 'RCP Name',
    'Depo Stable: N2O', 'Depo Stable: NH3', 'Depo Stable: PN2', 'Depo Stable: H2', 'Depo Stable: SiH4', 'Depo Stable: T/V',
    'Depo: RF Power(Act)',
    'PL Stable: Ar', 'PL Stable: H2', 'PL Stable: T/V',
    'PL: RF Power(Act)'
  ];
  const startRows = results.map(r => {
    const s = r.hwStart;
    return [
      s.no, s.rcpName,
      s.depoStable_pyroN2O ?? '-', s.depoStable_pyroNH3 ?? '-', s.depoStable_pyroPN2 ?? '-', s.depoStable_pyroH2 ?? '-', s.depoStable_pyroSiH4 ?? '-', s.depoStable_tvCtrlMode ?? '-',
      s.depo_rfForwardAct ?? '-',
      s.plStable_pyroAr ?? '-', s.plStable_pyroH2 ?? '-', s.plStable_tvCtrlMode ?? '-',
      s.pl_rfForwardAct ?? '-'
    ];
  });
  const wsStart = XLSX.utils.aoa_to_sheet([startHeaders, ...startRows]);
  XLSX.utils.book_append_sheet(wb, wsStart, 'HW Control Start');

  // 4. HW Control End (RF Off 기준)
  const endRFHeaders = [
    'No.', 'RCP Name',
    'Depo: RF Power(A)', 'Depo: T/V', 'Depo: SiH4', 'Depo: Ar', 'Depo: N2O', 'Depo: NH3', 'Depo: PN2', 'Depo: H2',
    'PL: RF Power(A)', 'PL: T/V', 'PL: Ar', 'PL: H2'
  ];
  const endRFRows = results.map(r => {
    const e = r.hwEndRF;
    return [
      e.no, e.rcpName,
      e.depo_rfForwardAct ?? '-', e.depo_tvCtrlMode ?? '-', e.depo_pyroSiH4 ?? '-', e.depo_pyroAr ?? '-', e.depo_pyroN2O ?? '-', e.depo_pyroNH3 ?? '-', e.depo_pyroPN2 ?? '-', e.depo_pyroH2 ?? '-',
      e.pl_rfForwardAct ?? '-', e.pl_tvCtrlMode ?? '-', e.pl_pyroAr ?? '-', e.pl_pyroH2 ?? '-'
    ];
  });
  const wsEndRF = XLSX.utils.aoa_to_sheet([endRFHeaders, ...endRFRows]);
  XLSX.utils.book_append_sheet(wb, wsEndRF, 'HW End (RF Off 기준)');

  // 5. Delays (RF Delay & Matcher Delay + 7 gases)
  const delayHeaders = [
    'No.', 'RCP Name',
    'RF Delay (sec)', 'Matcher Delay (sec)',
    'NF3 (sec)', 'Ar (sec)', 'N2O (sec)', 'NH3 (sec)', 'PN2 (sec)', 'SiH4 (sec)', 'H2 (sec)'
  ];
  const delayRows = results.map(r => {
    const d = r.delays;
    return [
      d.no, d.rcpName,
      d.rfDelay ?? '-', d.matcherDelay ?? '-',
      d.gasDelay_oxyNF3 ?? '-', d.gasDelay_pyroAr ?? '-', d.gasDelay_pyroN2O ?? '-', d.gasDelay_pyroNH3 ?? '-', d.gasDelay_pyroPN2 ?? '-', d.gasDelay_pyroSiH4 ?? '-', d.gasDelay_pyroH2 ?? '-'
    ];
  });
  const wsDelay = XLSX.utils.aoa_to_sheet([delayHeaders, ...delayRows]);
  XLSX.utils.book_append_sheet(wb, wsDelay, 'Delay Time');

  // 6. 편차 & Uniformity
  const devHeaders = [
    'No.', 'RCP Name', '구간', 'Step',
    'RF Power Min(W)', 'RF Power Min Dev(%)', 'RF Power Max(W)', 'RF Power Max Dev(%)',
    'Vpp Min(V)', 'Vpp Max(V)', 'Vpp Unif.(%)',
    'Irms Min(A)', 'Irms Max(A)', 'Irms Unif.(%)',
    'DC Bias Min(V)', 'DC Bias Max(V)', 'DC Bias Unif.(%)',
    'T/V Press Min(mTorr)', 'T/V Press Min Dev(%)', 'T/V Press Max(mTorr)', 'T/V Press Max Dev(%)',
    'T/V Pos Min(%)', 'T/V Pos Max(%)', 'T/V Pos Unif.(%)',
    'Lift Spacing Min(mm)', 'Lift Spacing Min Dev(%)', 'Lift Spacing Max(mm)', 'Lift Spacing Max Dev(%)',
    'SiH4 Min(sccm)', 'SiH4 Min Dev(%)', 'SiH4 Max(sccm)', 'SiH4 Max Dev(%)',
    'N2O Min(sccm)', 'N2O Min Dev(%)', 'N2O Max(sccm)', 'N2O Max Dev(%)',
    'NH3 Min(sccm)', 'NH3 Min Dev(%)', 'NH3 Max(sccm)', 'NH3 Max Dev(%)',
    'PN2 Min(sccm)', 'PN2 Min Dev(%)', 'PN2 Max(sccm)', 'PN2 Max Dev(%)',
    'H2 Min(sccm)', 'H2 Min Dev(%)', 'H2 Max(sccm)', 'H2 Max Dev(%)',
    ...(useDynamicHeaters
      ? allHeaterNames.flatMap(name => [
          `${name} Min(℃)`, `${name} Min Dev(℃)`, `${name} Max(℃)`, `${name} Max Dev(℃)`
        ])
      : [
          'Gate In 1 Min(℃)', 'Gate In 1 Min Dev(℃)', 'Gate In 1 Max(℃)', 'Gate In 1 Max Dev(℃)',
          'Win In 3 Min(℃)', 'Win In 3 Min Dev(℃)', 'Win In 3 Max(℃)', 'Win In 3 Max Dev(℃)',
          'Win Out 4 Min(℃)', 'Win Out 4 Min Dev(℃)', 'Win Out 4 Max(℃)', 'Win Out 4 Max Dev(℃)',
          'Side In 5 Min(℃)', 'Side In 5 Min Dev(℃)', 'Side In 5 Max(℃)', 'Side In 5 Max Dev(℃)'
        ])
  ];
  const devRows = results.map(r => {
    const d = r.deviation;
    const heaterStats = useDynamicHeaters
      ? allHeaterNames.flatMap(name => {
          const stat = d.dynamicHeaterDevs?.[name] ?? (name === 'Gate In 1' ? d.gateIn1 : { min: '-', minDev: '-', max: '-', maxDev: '-' });
          return [
            stat.min !== null && stat.min !== undefined ? stat.min : '-',
            stat.minDev !== null && stat.minDev !== undefined ? stat.minDev : '-',
            stat.max !== null && stat.max !== undefined ? stat.max : '-',
            stat.maxDev !== null && stat.maxDev !== undefined ? stat.maxDev : '-'
          ];
        })
      : [
          d.gateIn1.min ?? '-', d.gateIn1.minDev ?? '-', d.gateIn1.max ?? '-', d.gateIn1.maxDev ?? '-',
          d.windowIn3.min ?? '-', d.windowIn3.minDev ?? '-', d.windowIn3.max ?? '-', d.windowIn3.maxDev ?? '-',
          d.windowOut4.min ?? '-', d.windowOut4.minDev ?? '-', d.windowOut4.max ?? '-', d.windowOut4.maxDev ?? '-',
          d.side1In5.min ?? '-', d.side1In5.minDev ?? '-', d.side1In5.max ?? '-', d.side1In5.maxDev ?? '-'
        ];

    return [
      d.no, d.rcpName, `${r.windowStart} ~ ${r.windowEnd} (sec)`, d.step,
      d.rfForward.min !== null && d.rfForward.min !== undefined ? Math.round(d.rfForward.min) : '-', d.rfForward.minDevPct ?? '-', d.rfForward.max !== null && d.rfForward.max !== undefined ? Math.round(d.rfForward.max) : '-', d.rfForward.maxDevPct ?? '-',
      d.matcherVpp.min !== null && d.matcherVpp.min !== undefined ? Math.round(d.matcherVpp.min) : '-', d.matcherVpp.max !== null && d.matcherVpp.max !== undefined ? Math.round(d.matcherVpp.max) : '-', d.matcherVpp.uniformityPct ?? '-',
      d.matcherIrms.min !== null && d.matcherIrms.min !== undefined ? Math.round(d.matcherIrms.min) : '-', d.matcherIrms.max !== null && d.matcherIrms.max !== undefined ? Math.round(d.matcherIrms.max) : '-', d.matcherIrms.uniformityPct ?? '-',
      d.matcherDCBias.min !== null && d.matcherDCBias.min !== undefined ? Math.round(d.matcherDCBias.min) : '-', d.matcherDCBias.max !== null && d.matcherDCBias.max !== undefined ? Math.round(d.matcherDCBias.max) : '-', d.matcherDCBias.uniformityPct ?? '-',
      d.tvPressure.min !== null && d.tvPressure.min !== undefined ? Math.round(d.tvPressure.min) : '-', d.tvPressure.minDevPct ?? '-', d.tvPressure.max !== null && d.tvPressure.max !== undefined ? Math.round(d.tvPressure.max) : '-', d.tvPressure.maxDevPct ?? '-',
      d.tvPosition.min ?? '-', d.tvPosition.max ?? '-', d.tvPosition.uniformityPct ?? '-',
      d.liftSpacing.min !== null && d.liftSpacing.min !== undefined ? Math.round(d.liftSpacing.min) : '-', d.liftSpacing.minDevPct ?? '-', d.liftSpacing.max !== null && d.liftSpacing.max !== undefined ? Math.round(d.liftSpacing.max) : '-', d.liftSpacing.maxDevPct ?? '-',
      d.pyroSiH4.min !== null && d.pyroSiH4.min !== undefined ? Math.round(d.pyroSiH4.min) : '-', d.pyroSiH4.minDevPct ?? '-', d.pyroSiH4.max !== null && d.pyroSiH4.max !== undefined ? Math.round(d.pyroSiH4.max) : '-', d.pyroSiH4.maxDevPct ?? '-',
      d.pyroN2O.min !== null && d.pyroN2O.min !== undefined ? Math.round(d.pyroN2O.min) : '-', d.pyroN2O.minDevPct ?? '-', d.pyroN2O.max !== null && d.pyroN2O.max !== undefined ? Math.round(d.pyroN2O.max) : '-', d.pyroN2O.maxDevPct ?? '-',
      d.pyroNH3.min !== null && d.pyroNH3.min !== undefined ? Math.round(d.pyroNH3.min) : '-', d.pyroNH3.minDevPct ?? '-', d.pyroNH3.max !== null && d.pyroNH3.max !== undefined ? Math.round(d.pyroNH3.max) : '-', d.pyroNH3.maxDevPct ?? '-',
      d.pyroPN2.min !== null && d.pyroPN2.min !== undefined ? Math.round(d.pyroPN2.min) : '-', d.pyroPN2.minDevPct ?? '-', d.pyroPN2.max !== null && d.pyroPN2.max !== undefined ? Math.round(d.pyroPN2.max) : '-', d.pyroPN2.maxDevPct ?? '-',
      d.pyroH2.min !== null && d.pyroH2.min !== undefined ? Math.round(d.pyroH2.min) : '-', d.pyroH2.minDevPct ?? '-', d.pyroH2.max !== null && d.pyroH2.max !== undefined ? Math.round(d.pyroH2.max) : '-', d.pyroH2.maxDevPct ?? '-',
      ...heaterStats
    ];
  });
  const wsDev = XLSX.utils.aoa_to_sheet([devHeaders, ...devRows]);
  XLSX.utils.book_append_sheet(wb, wsDev, '편차 & Uniformity');

  // 7. HW End (Step시작 기준, 1:1 matching image.png)
  const endStepHeaders = [
    'No.', 'RCP Name',
    'Total Step: Depo. (sec)', 'Total Step: PL (sec)',
    'Depo: RF Off (sec)', 'Depo: RF Power(Act) (sec)', 'Depo: T/V (sec)', 'Depo: SiH4 (sec)', 'Depo: Ar (sec)', 'Depo: N2O (sec)', 'Depo: NH3 (sec)', 'Depo: PN2 (sec)', 'Depo: H2 (sec)',
    'PL: RF Off (sec)', 'PL: RF Power(Act) (sec)', 'PL: T/V (sec)', 'PL: Ar (sec)', 'PL: H2 (sec)'
  ];
  const endStepRows = results.map(r => {
    const s = r.hwEndStep;
    return [
      s.no, s.rcpName,
      s.totalStepTimeDepo ?? '-', s.totalStepTimePL ?? '-',
      s.depo_rfOffTime ?? '-', s.depo_rfForwardAct ?? '-', s.depo_tvCtrlMode ?? '-', s.depo_pyroSiH4 ?? '-', s.depo_pyroAr ?? '-', s.depo_pyroN2O ?? '-', s.depo_pyroNH3 ?? '-', s.depo_pyroPN2 ?? '-', s.depo_pyroH2 ?? '-',
      s.pl_rfOffTime ?? '-', s.pl_rfForwardAct ?? '-', s.pl_tvCtrlMode ?? '-', s.pl_pyroAr ?? '-', s.pl_pyroH2 ?? '-'
    ];
  });
  const wsEndStep = XLSX.utils.aoa_to_sheet([endStepHeaders, ...endStepRows]);
  XLSX.utils.book_append_sheet(wb, wsEndStep, 'HW End (Step시작 기준)');

  // 7. EC 기준
  const ecHeaders = ['분류', '항목', 'Warning 기준', 'Alarm 기준', '방향'];
  const ecRows = [
    ['RF Generator', 'Forward Power (Set 대비 편차 %)', `±${settings.ecRfForwardWarningPct ?? 2}%`, `±${settings.ecRfForwardAlarmPct ?? 3}%`, '양방향(±)'],
    ['RF Generator', 'Reflect Power (구간 Max W)', `${settings.ecRfReflectWarningW ?? 100} W`, `${settings.ecRfReflectAlarmW ?? 200} W`, '상한'],
    ['Matcher', 'Vpp Uniformity %', `${settings.ecMatcherWarningPct ?? 2}%`, `${settings.ecMatcherAlarmPct ?? 3}%`, '상한'],
    ['Matcher', 'Irms Uniformity %', `${settings.ecMatcherWarningPct ?? 2}%`, `${settings.ecMatcherAlarmPct ?? 3}%`, '상한'],
    ['Matcher', 'DC Bias Uniformity %', `${settings.ecMatcherWarningPct ?? 2}%`, `${settings.ecMatcherAlarmPct ?? 3}%`, '상한'],
    ['Throttle Valve', 'Pressure (Set 대비 편차 %)', `±${settings.ecPressureWarningPct ?? 2}%`, `±${settings.ecPressureAlarmPct ?? 5}%`, '양방향(±)'],
    ['Throttle Valve', 'Position Uniformity %', `${settings.ecPositionWarningPct ?? 0.5}%`, `${settings.ecPositionAlarmPct ?? 1.0}%`, '상한'],
    ['Lift Spacing', 'Lift Spacing (Set 대비 편차 %)', settings.ecLiftSpacingWarningPct ? `±${settings.ecLiftSpacingWarningPct}%` : '미설정', settings.ecLiftSpacingAlarmPct ? `±${settings.ecLiftSpacingAlarmPct}%` : '미설정', '양방향(±)'],
    ['Gas', '전체 Gas 유량 (Set 대비 편차 %)', `±${settings.ecGasWarningPct ?? 3}%`, `±${settings.ecGasAlarmPct ?? 5}%`, '양방향(±)'],
    ['Heater Zone', 'Heater Temp (온도차 ℃)', `±${settings.ecHeaterWarningC ?? 5} ℃`, `±${settings.ecHeaterAlarmC ?? 10} ℃`, '양방향(±)'],
  ];
  const wsEC = XLSX.utils.aoa_to_sheet([ecHeaders, ...ecRows]);
  XLSX.utils.book_append_sheet(wb, wsEC, 'EC 기준');

  // Write file
  XLSX.writeFile(wb, filename);
}
