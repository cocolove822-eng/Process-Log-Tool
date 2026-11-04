import { parseRawLogCsv } from '../src/utils/csvParser';
import { analyzeLogFileSteps, DEFAULT_SETTINGS } from '../src/utils/analyzer';

// Let's test how depo_rfForwardAct can become 72.1s!
// In Image 1:
// Row 2335: Step 12, Time 14:25:16.289, Step Time 0, Step All Time 0, 70.4, A_SI, Ot, Off, Off, 0
// Row 2336: Step 12, Time 14:25:16.388, Step Time 0, Step All Time 0.1, 70.4, A_SI, Ot, On, Off, 1480
// Row 2337: Step 12, Time 14:25:16.488, Step Time 0, Step All Time 0.2, 70.4, A_SI, Ot, On, Off, 1480
// ...
// What if in the real CSV:
// What columns were parsed?
// What if Col 12 was parsed as rfForwardSetValue, BUT what if there is another column for rfForwardSetValue?
// Or what if rfForwardPowerAct is 0 throughout?
// Or what if in Step 12, the step is continuous from Step 11?
// Or what if Step 12 has NO transition?
// Or what if depo_rfForwardAct is NOT coming from getRfPowerStartTime?
// Let's check!

const csvLines = [
  'LotID: LotID_',
  'Recipe: 260729_3Layer_Heat_X',
  'Date: 2026-07-29',
  '',
  '',
  'StepCount,Step,Time,Step Time,Step All Time,ep Time,Step Name,Oxy.NF3 Se,Oxy.NF3,Oxy.Ar Set,Oxy.Ar,yro.N2O Se,Pyro.N2O,yro.NH3 Se,Pyro.NH3,Pyro.Ar Set,Pyro.Ar,yro.SiH4 Se,Pyro.SiH4,RF On,RF Forward SetValue,RF Forward Power(Act),T/V Ctrl Mode',
];

// Let's test different conditions for Step 12 (A_SI):
// Condition 1: What if rfForwardSetValue is 0, and rfForwardPowerAct has a spike only at the end (72.1s)?
// Condition 2: What if rfForwardSetValue is 1480 in Step 11 too?
// Condition 3: What if getRfPowerStartTime has a bug when...

// Let's test:
csvLines.push('11,11,20260729 14:25:15.288,4.1,7.4,5,STAB3,0,0,0,0,45000,45000,0,0,0,0,2002,2002,Off,0,0,PRESSURE');
csvLines.push('11,11,20260729 14:25:16.189,5.0,8.3,5,STAB3,0,0,0,0,45000,45000,0,0,0,0,2002,2002,Off,0,0,PRESSURE');

// In Step 12:
// What if row 2335 has RF Forward SetValue = 1480 already?
// Or what if RF Forward SetValue is NOT parsed because the header is different?
// Let's check what headers exist in standard CSV for RF:
// In Image 1, look at Col 10, Col 11, Col 12:
// Col 10: Off -> On at 0.1s
// Col 11: Off -> On at 0.5s
// Col 12: 0 -> 1480 at 0.1s
