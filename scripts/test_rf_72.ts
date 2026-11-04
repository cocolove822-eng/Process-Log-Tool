// Test edge cases for getRfPowerStartTime returning 72.1
import { RawLogRow } from '../src/types/pecvd';

function createMockRow(step: number, stepAllTime: number, rfSet: number, rfAct: number): RawLogRow {
  return {
    rowIndex: 1,
    timeStr: '',
    timestampMs: 0,
    elapsedSec: 0,
    stepCount: step,
    step,
    stepName: '',
    stepTime: 0,
    stepAllTime,
    stepTimeSet: 70.4,
    oxyNF3: 0, oxyNF3Set: 0, oxyAr: 0, oxyArSet: 0,
    pyroN2O: 0, pyroN2OSet: 0, pyroNH3: 0, pyroNH3Set: 0,
    pyroAr: 0, pyroArSet: 0, pyroSiH4: 0, pyroSiH4Set: 0,
    pyroPN2: 0, pyroPN2Set: 0, pyroH2: 0, pyroH2Set: 0,
    tvPressureSet: 0, tvPressure: 0, tvPositionSet: 0, tvPosition: 0,
    tvCtrlModeSet: '', tvCtrlMode: '',
    liftPos: 0, liftSpacingSet: 0, liftSpacing: 0, liftVelocity: null, liftAccDec: null,
    matcherLoad: 0, matcherTune: 0, matcherVpp: 0, matcherIrms: 0, matcherDCBias: 0,
    rfOn: '',
    rfForwardSetValue: rfSet,
    rfForwardSetValueAct: 0,
    rfForwardPowerAct: rfAct,
    rfReflectPower: 0,
    rfRampValueUp: 0,
    rfRampTimeUp: 0,
    rpscForward: 0, rpscReflect: 0,
    gateIn1Set: 0, gateIn1: 0, gateOut2Set: 0, gateOut2: null,
    windowIn3Set: 0, windowIn3: 0, windowOut4Set: 0, windowOut4: 0,
    side1In5Set: 0, side1In5: 0,
    dynamicHeaters: {},
    allValues: {}
  };
}

// Let's test what rows could cause 72.1:
// Scenario A: What if throughout Step 12, rfForwardSetValue is 0 (not parsed),
// and rfForwardPowerAct is 0, BUT at the very last row (72.1s) there is a spike or rfOff row?
// Scenario B: What if targetSet > 0, but what if at 72.1s...
// Scenario C: What if depoRows has only 1 row or what if depoRows is a different step?
// Scenario D: What if rfForwardSetValue was 1480 from the start, but at 72.1s it reached a new target? (e.g. RSD or ramp?)

const testRows: RawLogRow[] = [];
// Step 11 STAB3 (ends at 8.3s)
testRows.push(createMockRow(11, 8.3, 0, 0));

// Step 12 A_SI (starts at 0.0s, ends at 72.1s)
// What if in Step 12:
// Row 0 (0.0s): rfSet = 0, rfAct = 0
// Row 1 (0.1s): rfSet = 1480, rfAct = 0
// ...
// Row N (72.1s): rfSet = 0, rfAct = 0
