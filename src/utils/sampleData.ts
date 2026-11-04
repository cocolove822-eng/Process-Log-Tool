import { ComplexNumber, CTCLMatrixData, ParsedLogFile, RawLogRow, StepSummary } from '../types/pecvd';

/**
 * Generate full sample CTCL matrix (Load 0..100, Tune 0..100)
 * Calibrated so Load 62.73, Tune 50.71 gives R = 0.34, X = -3.67
 */
export function createSampleCTCLMatrix(): CTCLMatrixData {
  const loads: number[] = [];
  const tunes: number[] = [];
  const grid: Record<number, Record<number, ComplexNumber>> = {};

  for (let l = 0; l <= 100; l += 1) {
    loads.push(l);
    grid[l] = {};
    for (let t = 0; t <= 100; t += 1) {
      // Base impedance formula
      const baseR = 0.15 + (l / 100) * 0.3 + (t / 100) * 0.05;
      const baseX = -10.0 + (l / 100) * 8.0 + (t / 100) * 2.0;

      grid[l][t] = {
        r: Math.round(baseR * 100) / 100,
        x: Math.round(baseX * 100) / 100,
      };
    }
  }

  // Exact calibration around Load 62..63 and Tune 50..51
  grid[62][50] = { r: 0.33, x: -3.73 };
  grid[63][50] = { r: 0.35, x: -3.65 };
  grid[62][51] = { r: 0.33, x: -3.72 };
  grid[63][51] = { r: 0.35, x: -3.64 };

  // Other recipes calibration (e.g. GI_SiN: Load 68.0, Tune 50.2 -> R=0.3, X=-3.9)
  grid[68][50] = { r: 0.30, x: -3.90 };
  grid[68][51] = { r: 0.30, x: -3.88 };

  // ILD_SiOx: Load 62.3, Tune 50.2 -> R=0.3, X=-3.5
  grid[62][50] = { r: 0.30, x: -3.52 };
  grid[63][50] = { r: 0.31, x: -3.48 };

  // Re-verify exact GI_SIO_IRUJA:
  grid[62][50] = { r: 0.33, x: -3.73 };
  grid[63][50] = { r: 0.35, x: -3.65 };
  grid[62][51] = { r: 0.33, x: -3.72 };
  grid[63][51] = { r: 0.35, x: -3.64 };

  return {
    fileName: 'CTCL_Matrix_Sample.xlsx',
    sheetName: 'CTCL_Matrix',
    availableSheets: ['CTCL_Matrix', 'Config'],
    loads,
    tunes,
    grid,
  };
}

interface RecipeConfig {
  fileName: string;
  recipeName: string;
  cid: string;
  lotId: string;
  substrateId: string;
  date: string;
  depoStep: number;
  stableStep: number;
  plStart: number;
  plEnd: number;
  tOn: number;
  tOff: number;
  totalDepoTime: number;
  rfForwardSet: number;
  tvPressureSet: number;
  tvPosAvg: number;
  liftSpacingSet: number;
  gases: {
    oxyNF3Set?: number;
    oxyArSet?: number;
    pyroN2OSet?: number;
    pyroNH3Set?: number;
    pyroArSet?: number;
    pyroPN2Set?: number;
    pyroSiH4Set?: number;
    pyroH2Set?: number;
  };
  matcher: {
    loadAvg: number;
    tuneAvg: number;
    vppAvg: number;
    irmsAvg: number;
    dcBiasAvg: number;
    vppTime: number;
    forward10Time: number;
  };
  delays: {
    siH4Delay: number;
    h2Delay: number;
  };
  depoEndOffsets: {
    siH4Offset: number; // e.g. -2.1
    n2oOffset: number;  // e.g. +1.0
  };
}

export function generateSampleFiles(): ParsedLogFile[] {
  const configs: RecipeConfig[] = [
    {
      fileName: '260917_GI_SiOx.01.csv',
      recipeName: 'GI_SIO_IRUJA',
      cid: 'CH_A',
      lotId: 'LOT_260917_01',
      substrateId: 'SUB_002',
      date: '2026-09-17',
      depoStep: 3,
      stableStep: 2,
      plStart: 6,
      plEnd: 8,
      tOn: 3.1,
      tOff: 65.1,
      totalDepoTime: 65.7,
      rfForwardSet: 3850,
      tvPressureSet: 780,
      tvPosAvg: 56.0,
      liftSpacingSet: 0,
      gases: {
        pyroN2OSet: 43060,
        pyroArSet: 56400,
        pyroPN2Set: 970,
        pyroSiH4Set: 1400,
      },
      matcher: {
        loadAvg: 62.73,
        tuneAvg: 50.71,
        vppAvg: 1412.9,
        irmsAvg: 140.4,
        dcBiasAvg: -52.7,
        vppTime: 2.4,
        forward10Time: 3.1,
      },
      delays: {
        siH4Delay: 0.2,
        h2Delay: 0.2,
      },
      depoEndOffsets: {
        siH4Offset: -2.1,
        n2oOffset: 1.0,
      },
    },
    {
      fileName: '260917_GI_SiN.01.csv',
      recipeName: 'GI_SIN_IRUJA',
      cid: 'CH_A',
      lotId: 'LOT_260917_02',
      substrateId: 'SUB_003',
      date: '2026-09-17',
      depoStep: 3,
      stableStep: 2,
      plStart: 6,
      plEnd: 8,
      tOn: 2.8,
      tOff: 105.0,
      totalDepoTime: 105.6,
      rfForwardSet: 4700,
      tvPressureSet: 1100,
      tvPosAvg: 68.0,
      liftSpacingSet: 650,
      gases: {
        pyroNH3Set: 9400,
        pyroPN2Set: 27040,
        pyroSiH4Set: 1420,
        pyroH2Set: 3550,
      },
      matcher: {
        loadAvg: 68.0,
        tuneAvg: 50.2,
        vppAvg: 1748.0,
        irmsAvg: 179.0,
        dcBiasAvg: -89.2,
        vppTime: 2.0,
        forward10Time: 2.8,
      },
      delays: {
        siH4Delay: 0.1,
        h2Delay: 0.2,
      },
      depoEndOffsets: {
        siH4Offset: -1.7,
        n2oOffset: 0.0,
      },
    },
    {
      fileName: '260917_ILD_SiOx.01.csv',
      recipeName: 'ILD_SIO_IRUJA',
      cid: 'CH_A',
      lotId: 'LOT_260917_03',
      substrateId: 'SUB_004',
      date: '2026-09-17',
      depoStep: 3,
      stableStep: 2,
      plStart: 6,
      plEnd: 8,
      tOn: 2.3,
      tOff: 40.5,
      totalDepoTime: 41.1,
      rfForwardSet: 10500,
      tvPressureSet: 700,
      tvPosAvg: 62.3,
      liftSpacingSet: 0,
      gases: {
        pyroN2OSet: 99500,
        pyroPN2Set: 4320,
        pyroSiH4Set: 4320,
      },
      matcher: {
        loadAvg: 62.3,
        tuneAvg: 50.2,
        vppAvg: 2443.0,
        irmsAvg: 236.0,
        dcBiasAvg: -80.9,
        vppTime: 1.7,
        forward10Time: 2.3,
      },
      delays: {
        siH4Delay: 0.1,
        h2Delay: 0.2,
      },
      depoEndOffsets: {
        siH4Offset: -2.1,
        n2oOffset: 1.0,
      },
    },
    {
      fileName: '260917_ILD_SiN.01.csv',
      recipeName: 'ILD_SIN_IRUJA',
      cid: 'CH_A',
      lotId: 'LOT_260917_04',
      substrateId: 'SUB_005',
      date: '2026-09-17',
      depoStep: 3,
      stableStep: 2,
      plStart: 6,
      plEnd: 8,
      tOn: 2.5,
      tOff: 57.8,
      totalDepoTime: 58.4,
      rfForwardSet: 10810,
      tvPressureSet: 1500,
      tvPosAvg: 57.9,
      liftSpacingSet: 1000,
      gases: {
        pyroNH3Set: 13000,
        pyroPN2Set: 3700,
        pyroSiH4Set: 17500,
      },
      matcher: {
        loadAvg: 57.9,
        tuneAvg: 53.4,
        vppAvg: 2161.0,
        irmsAvg: 215.0,
        dcBiasAvg: -78.0,
        vppTime: 1.9,
        forward10Time: 2.5,
      },
      delays: {
        siH4Delay: 0.1,
        h2Delay: 0.4,
      },
      depoEndOffsets: {
        siH4Offset: -2.1,
        n2oOffset: 1.0,
      },
    },
    {
      fileName: '260917_a-Si_Single.01.csv',
      recipeName: 'A4_a-Si_Single',
      cid: 'CH_A',
      lotId: 'LOT_260917_05',
      substrateId: 'SUB_001',
      date: '2026-09-17',
      depoStep: 5,
      stableStep: 4,
      plStart: 0,
      plEnd: 0,
      tOn: 2.5,
      tOff: 68.1,
      totalDepoTime: 69.1,
      rfForwardSet: 1480,
      tvPressureSet: 1450,
      tvPosAvg: 50.0,
      liftSpacingSet: 750,
      gases: {
        pyroArSet: 84240,
        pyroSiH4Set: 1400,
      },
      matcher: {
        loadAvg: 50.0,
        tuneAvg: 50.0,
        vppAvg: 0.0,
        irmsAvg: 0.0,
        dcBiasAvg: 0.0,
        vppTime: 0,
        forward10Time: 2.5,
      },
      delays: {
        siH4Delay: 0.1,
        h2Delay: 0.0,
      },
      depoEndOffsets: {
        siH4Offset: -0.6,
        n2oOffset: 0.0,
      },
    },
  ];

  return configs.map((cfg, fileIdx) => buildLogFileFromConfig(cfg, fileIdx));
}

function buildLogFileFromConfig(cfg: RecipeConfig, fileIdx: number): ParsedLogFile {
  const rows: RawLogRow[] = [];
  const baseTimeMs = new Date('2026-09-17T09:00:00.000Z').getTime() + fileIdx * 3600000;
  let currentElapsedSec = 0;
  let rowIndex = 1;

  // Step definitions:
  // Step 1: Pump / Gas Purge (10 sec)
  // Step 2: Stable Step (20 sec)
  // Step 3: Depo Step (totalDepoTime sec)
  // Step 4: Pump Out (10 sec)
  // Step 5: Gas Flush (10 sec)
  // Step 6: PL Step Start (15 sec)
  // Step 7: PL Step (15 sec)
  // Step 8: PL Step End (10 sec)
  const isMultiDepo = fileIdx === 1;
  const stepDurations: { step: number; name: string; dur: number }[] = isMultiDepo
    ? [
        { step: 1, name: 'Pump', dur: 10 },
        { step: 2, name: 'Stable 1', dur: 15 },
        { step: 3, name: 'Depo 1 (Buffer)', dur: 30 },
        { step: 4, name: 'Stable 2', dur: 15 },
        { step: 5, name: 'Depo 2 (Main)', dur: 40 },
        { step: 6, name: 'Stable 3', dur: 15 },
        { step: 7, name: 'Depo 3 (Cap)', dur: 35 },
        { step: 8, name: 'PumpOut', dur: 10 },
        { step: 9, name: 'PL_Start', dur: 15 },
        { step: 10, name: 'PL_End', dur: 10 },
      ]
    : cfg.depoStep === 5
    ? [
        { step: 1, name: 'Pump', dur: 10 },
        { step: 2, name: 'Purge', dur: 10 },
        { step: 3, name: 'PreHeat', dur: 15 },
        { step: 4, name: 'Stable', dur: 20 },
        { step: 5, name: 'Depo', dur: cfg.totalDepoTime },
        { step: 6, name: 'PumpOut', dur: 15 },
      ]
    : [
        { step: 1, name: 'Pump', dur: 10 },
        { step: 2, name: 'Stable', dur: 20 },
        { step: 3, name: 'Depo', dur: cfg.totalDepoTime },
        { step: 4, name: 'PumpOut', dur: 10 },
        { step: 5, name: 'Purge', dur: 10 },
        { step: 6, name: 'PL_Start', dur: 15 },
        { step: 7, name: 'PL_Hold', dur: 15 },
        { step: 8, name: 'PL_End', dur: 10 },
      ];

  const stepsSummary: StepSummary[] = [];

  stepDurations.forEach(sd => {
    const startSec = currentElapsedSec;
    const numRows = Math.round(sd.dur * 10);

    for (let i = 0; i <= numRows; i++) {
      const stepAllTime = Math.round((i * 0.1) * 10) / 10;
      const elapsedSec = Math.round((startSec + stepAllTime) * 10) / 10;
      const timestampMs = baseTimeMs + Math.round(elapsedSec * 1000);
      const d = new Date(timestampMs);
      const timeStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')} ` +
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;

      // Default values
      let rfOn = 'Off';
      let rfForwardSetValue = 0;
      let rfForwardSetValueAct = 0;
      let rfForwardPowerAct = 0;
      let rfReflectPower = 0;
      let matcherLoad = cfg.matcher.loadAvg;
      let matcherTune = cfg.matcher.tuneAvg;
      let matcherVpp = 0;
      let matcherIrms = 0;
      let matcherDCBias = 0;
      let tvPressure = 0;
      let tvPressureSet = 0;
      let tvPosition = 100;
      let tvPositionSet = 100;
      let tvCtrlModeSet = 'OPEN';
      let liftPos = 0;
      let liftSpacing = cfg.liftSpacingSet;
      let liftSpacingSet = cfg.liftSpacingSet;

      // Gas actuals & sets
      let oxyNF3 = 0, oxyNF3Set = cfg.gases.oxyNF3Set || 0;
      let oxyAr = 0, oxyArSet = cfg.gases.oxyArSet || 0;
      let pyroN2O = 0, pyroN2OSet = cfg.gases.pyroN2OSet || 0;
      let pyroNH3 = 0, pyroNH3Set = cfg.gases.pyroNH3Set || 0;
      let pyroAr = 0, pyroArSet = cfg.gases.pyroArSet || 0;
      let pyroPN2 = 0, pyroPN2Set = cfg.gases.pyroPN2Set || 0;
      let pyroSiH4 = 0, pyroSiH4Set = cfg.gases.pyroSiH4Set || 0;
      let pyroH2 = 0, pyroH2Set = cfg.gases.pyroH2Set || 0;

      // Heater zones
      let gateIn1 = 370, gateIn1Set = 370;
      let gateOut2Set = 370;
      let windowIn3 = 375, windowIn3Set = 375;
      let windowOut4 = 375, windowOut4Set = 375;
      let side1In5 = 370, side1In5Set = 370;

      // Stable Step behavior
      const isStableStep = isMultiDepo ? (sd.step === 2 || sd.step === 4 || sd.step === 6) : (sd.step === cfg.stableStep);
      if (isStableStep) {
        tvCtrlModeSet = 'PRESSURE';
        tvPressureSet = cfg.tvPressureSet;
        tvPressure = cfg.tvPressureSet * 0.99;
        tvPosition = cfg.tvPosAvg;

        if (pyroSiH4Set > 0) pyroSiH4 = pyroSiH4Set * 0.99;
        if (pyroN2OSet > 0) pyroN2O = pyroN2OSet * 0.99;
        if (pyroNH3Set > 0) pyroNH3 = pyroNH3Set * 0.99;
        if (pyroPN2Set > 0) pyroPN2 = pyroPN2Set * 0.99;
        if (pyroArSet > 0) pyroAr = pyroArSet * 0.99;
        if (pyroH2Set > 0) pyroH2 = pyroH2Set * 0.99;
      }

      // Depo Step behavior
      const isDepoStep = isMultiDepo ? (sd.step === 3 || sd.step === 5 || sd.step === 7) : (sd.step === cfg.depoStep);
      if (isDepoStep) {
        const stepRfSet = isMultiDepo ? (sd.step === 3 ? 4500 : (sd.step === 5 ? 4700 : 4200)) : cfg.rfForwardSet;
        const stepSiH4Set = isMultiDepo ? (sd.step === 3 ? 1200 : (sd.step === 5 ? 1420 : 1100)) : (cfg.gases.pyroSiH4Set || 0);

        rfForwardSetValue = stepRfSet;
        pyroSiH4Set = stepSiH4Set;
        tvPressureSet = cfg.tvPressureSet;
        liftSpacingSet = cfg.liftSpacingSet;

        // Pressure
        tvCtrlModeSet = 'PRESSURE';
        tvPressure = cfg.tvPressureSet;
        tvPosition = cfg.tvPosAvg;

        // Gases flow with small variation
        const noise = ((i % 5) - 2) * 0.002;
        if (pyroSiH4Set > 0) pyroSiH4 = pyroSiH4Set * (1 + noise);
        if (pyroN2OSet > 0) pyroN2O = pyroN2OSet * (1 + noise);
        if (pyroNH3Set > 0) pyroNH3 = pyroNH3Set * (1 + noise);
        if (pyroPN2Set > 0) pyroPN2 = pyroPN2Set * (1 + noise);
        if (pyroArSet > 0) pyroAr = pyroArSet * (1 + noise);
        if (pyroH2Set > 0) pyroH2 = pyroH2Set * (1 + noise);

        const tOffThisStep = isMultiDepo ? (sd.dur - 0.6) : cfg.tOff;
        // Turn off SiH4 early according to offset (e.g. -2.1 sec before tOff)
        if (cfg.depoEndOffsets.siH4Offset < 0 && stepAllTime > (tOffThisStep + cfg.depoEndOffsets.siH4Offset)) {
          pyroSiH4 = 0;
        }

        // RF On between tOn and tOff
        if (stepAllTime >= cfg.tOn && stepAllTime <= tOffThisStep) {
          rfOn = 'On';
          // RSD 2000W 유지 구간 (1.1초 동안 2000W 유지)
          const isRsdPeriod = stepAllTime > (tOffThisStep - 1.1);
          if (isRsdPeriod) {
            rfForwardSetValue = 2000;
            rfForwardPowerAct = 2000;
          } else if (stepAllTime >= cfg.matcher.forward10Time) {
            rfForwardPowerAct = Math.round(stepRfSet * 0.998);
          } else {
            rfForwardPowerAct = 50;
          }
          rfReflectPower = fileIdx === 0 ? 19.1 : (fileIdx === 1 ? 56.0 : (fileIdx === 2 ? 100.0 : 11.8));

          matcherLoad = cfg.matcher.loadAvg;
          matcherTune = cfg.matcher.tuneAvg;
          matcherVpp = cfg.matcher.vppAvg;
          matcherIrms = cfg.matcher.irmsAvg;
          matcherDCBias = cfg.matcher.dcBiasAvg;
        } else if (stepAllTime < cfg.tOn) {
          rfForwardPowerAct = 0;
        } else {
          // After tOff
          rfForwardPowerAct = 0;
          rfOn = 'Off';
        }

        // Matcher Vpp turn-on time
        if (stepAllTime >= cfg.matcher.vppTime && stepAllTime <= tOffThisStep) {
          matcherVpp = cfg.matcher.vppAvg;
        }
      }

      // PL Steps behavior
      const isPlStep = isMultiDepo ? (sd.step === 9 || sd.step === 10) : (cfg.plStart > 0 && sd.step >= cfg.plStart && sd.step <= cfg.plEnd);
      if (isPlStep) {
        pyroH2Set = 2000;
        pyroArSet = 10000;
        pyroH2 = 2000;
        pyroAr = 10000;

        // PL RF treatment runs actively from plStart to plEnd
        rfOn = 'On';
        rfForwardSetValue = 2500;
        rfForwardPowerAct = 2500;
      }

      const rowObj: RawLogRow = {
        rowIndex,
        timeStr,
        timestampMs,
        elapsedSec,
        stepCount: sd.step,
        step: sd.step,
        stepName: sd.name,
        stepTime: stepAllTime,
        stepAllTime,
        stepTimeSet: sd.dur,

        oxyNF3,
        oxyNF3Set,
        oxyAr,
        oxyArSet,
        pyroN2O,
        pyroN2OSet,
        pyroNH3,
        pyroNH3Set,
        pyroAr,
        pyroArSet,
        pyroSiH4,
        pyroSiH4Set,
        pyroPN2,
        pyroPN2Set,
        pyroH2,
        pyroH2Set,

        tvPressureSet,
        tvPressure,
        tvPositionSet,
        tvPosition,
        tvCtrlModeSet,

        liftPos,
        liftSpacingSet,
        liftSpacing,

        matcherLoad,
        matcherTune,
        matcherVpp,
        matcherIrms,
        matcherDCBias,

        rfOn,
        rfForwardSetValue,
        rfForwardSetValueAct,
        rfForwardPowerAct,
        rfReflectPower,
        rfRampValueUp: 0,
        rfRampTimeUp: 0,

        rpscForward: 0,
        rpscReflect: 0,

        gateIn1Set,
        gateIn1,
        gateOut2Set,
        windowIn3Set,
        windowIn3,
        windowOut4Set,
        windowOut4,
        side1In5Set,
        side1In5,

        allValues: {
          'Time': timeStr,
          'Step': sd.step,
          'Step Name': sd.name,
          'Step All Time': stepAllTime,
          'RF Forward Power(Act)': rfForwardPowerAct,
          'T/V Pressure': tvPressure,
          'T/V Position': tvPosition,
          'Matcher Load': matcherLoad,
          'Matcher Tune': matcherTune,
          'Matcher Vpp': matcherVpp,
          'Matcher Irms': matcherIrms,
          'Matcher DC Bias': matcherDCBias,
          'Pyro.SiH4': pyroSiH4,
          'Pyro.N2O': pyroN2O,
          'Pyro.NH3': pyroNH3,
          'Pyro.PN2': pyroPN2,
          'Pyro.Ar': pyroAr,
          'Pyro.H2': pyroH2,
        },
      };

      rows.push(rowObj);
      rowIndex++;
    }

    stepsSummary.push({
      step: sd.step,
      stepName: sd.name,
      rowCount: numRows + 1,
      durationSec: sd.dur,
      startElapsedSec: Math.round(startSec * 10) / 10,
      endElapsedSec: Math.round((startSec + sd.dur) * 10) / 10,
    });

    currentElapsedSec += sd.dur;
  });

  return {
    id: `sample_${fileIdx}_${cfg.recipeName}`,
    fileName: cfg.fileName,
    meta: {
      cid: cfg.cid,
      lotId: cfg.lotId,
      substrateId: cfg.substrateId,
      recipeName: cfg.recipeName,
      date: cfg.date,
    },
    headers: [
      'Time', 'Step', 'Step Name', 'Step Time', 'Step All Time', 'Step Time Set',
      'RF On', 'RF Forward SetValue', 'RF Forward SetValue(Act)', 'RF Forward Power(Act)', 'RF Reflect Power',
      'Matcher Load', 'Matcher Tune', 'Matcher Vpp', 'Matcher Irms', 'Matcher DC Bias',
      'T/V Pressure Set', 'T/V Pressure', 'T/V Position Set', 'T/V Position', 'T/V Ctrl Mode Set',
      'Lift Spacing Set', 'Lift Spacing', 'Lift Pos',
      'Pyro.SiH4', 'Pyro.SiH4 Set', 'Pyro.N2O', 'Pyro.N2O Set', 'Pyro.NH3', 'Pyro.NH3 Set',
      'Pyro.PN2', 'Pyro.PN2 Set', 'Pyro.Ar', 'Pyro.Ar Set', 'Pyro.H2', 'Pyro.H2 Set',
      'Gate In 1', 'Gate In 1 Set', 'Window In 3', 'Window In 3 Set', 'Window Out 4', 'Window Out 4 Set', 'Side 1 In 5', 'Side 1 In 5 Set'
    ],
    missingColumns: [],
    rows,
    stepsSummary,
    heaterChannelDefs: [
      { id: 'gate_in_1', name: 'GateIn1', rawSetName: 'Gate In 1 Set', rawActName: 'Gate In 1' },
      { id: 'gate_out_2', name: 'GateOut2', rawSetName: 'Gate Out 2 Set', rawActName: 'Gate Out 2' },
      { id: 'win_in_3', name: 'WinIn3', rawSetName: 'Window In 3 Set', rawActName: 'Window In 3' },
      { id: 'win_out_4', name: 'WinOut4', rawSetName: 'Window Out 4 Set', rawActName: 'Window Out 4' },
      { id: 'side_in_5', name: 'SideIn5', rawSetName: 'Side 1 In 5 Set', rawActName: 'Side 1 In 5' },
    ],
  };
}
