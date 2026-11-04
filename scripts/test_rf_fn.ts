import { RawLogRow } from '../src/types/pecvd';

// Let's copy getRfPowerStartTime exactly as in analyzer.ts:
function getRfPowerStartTime(rowList: RawLogRow[], rows: RawLogRow[]): number | null {
  if (rowList.length === 0) return null;
  const targetSet = Math.max(0, ...rowList.map(r => Math.max(r.rfForwardSetValue ?? 0, r.rfForwardSetValueAct ?? 0)));
  const maxAct = Math.max(0, ...rowList.map(r => r.rfForwardPowerAct ?? 0));

  // 해당 스텝에 RF Set도 없고 실질적 RF 방전(>= 10W)도 없는 경우 null ('-')
  if (targetSet <= 0 && maxAct < 10) return null;

  if (targetSet > 0) {
    // 1순위: RF Forward SetValue가 0에서 목표 Set값에 도달한 첫 행 (전환점)
    let setReachedRow = rowList.find((r, idx) => {
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
      // 2순위: SetValue가 > 0 으로 진입한 첫 행
      setReachedRow = rowList.find((r, idx) => {
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

    if (setReachedRow) return Math.round((setReachedRow.stepAllTime ?? 0) * 10) / 10;
  }

  // 3순위 (Set 정보가 없는 파일 Fallback): 실제 RF 점화 행 (rfForwardPowerAct >= 10W 전환점)
  const actRow = rowList.find((r, idx) => {
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
  }) ?? rowList.find(r => (r.rfForwardPowerAct ?? 0) >= 10);

  return actRow ? Math.round((actRow.stepAllTime ?? 0) * 10) / 10 : null;
}

// Let's create rows for Step 12:
// What could make this function return 72.1?
// Let's test combinations!

const rows: any[] = [];
// Step 11:
rows.push({ step: 11, stepAllTime: 8.3, rfForwardSetValue: 0, rfForwardSetValueAct: 0, rfForwardPowerAct: 0 });

// What if Step 12 has:
// Case 1: rfForwardSetValue = 0, rfForwardSetValueAct = 0 throughout!
// And rfForwardPowerAct = 0 throughout, except at 72.1s rfForwardPowerAct = 10?
// Case 2: What if targetSet > 0, but val >= targetSet occurs ONLY at 72.1s?
// Why would val >= targetSet occur ONLY at 72.1s?
// What if rfForwardSetValue = 0 until 72.1s, then 1480? (No, Image 1 shows 1480 at 0.1s!)

// Case 3: WHAT IF globalIdx findIndex fails?!
// Look at:
// `const globalIdx = rows.findIndex(gr => gr === r);`
// If gr === r matches, globalIdx >= 0.

// Case 4: WHAT IF rowList has ONLY ONE ROW or rows are filtered strangely?
// Case 5: WHAT IF rfForwardSetValue is 1480 in Step 11 ALSO?
// If Step 11 has rfForwardSetValue = 1480:
// Then at Step 12 row 0 (0.0s):
// If row 0 has rfForwardSetValue = 0, row 1 has 1480:
// prevVal in row 1 is row 0 (0) < 1480 -> matches row 1 (0.1s)!

// WAIT! What if row 0 has rfForwardSetValue = 1480?
// If row 0 has 1480, and Step 11 has 1480:
// Then row 0 doesn't match. row 1 doesn't match... none match!
// Then 1순위 is null, 2순위 is null, 3순위:
// What about 3순위? actRow: if rfForwardPowerAct was 1480 in Step 11,
// then actRow doesn't match until... wait!
// What if at 72.1s, rfForwardPowerAct dropped to 0, then in Step 13 jumped?
// That's Step 13, not Step 12.

console.log('Testing getRfPowerStartTime...');
