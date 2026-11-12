import * as XLSX from 'xlsx';
import { ComplexNumber, CTCLMatrixData } from '../types/pecvd';

/**
 * Parse complex number string like "2.77-17.07i", " 2.89-15.17i", "0.34+5.21i", "-1.2-3.4i"
 */
export function parseComplexImpedance(str: string | number): ComplexNumber | null {
  if (typeof str === 'number') {
    return { r: str, x: 0 };
  }
  if (!str) return null;
  const s = str.toString().trim();
  if (s === '-' || s === '' || s.toLowerCase() === 'nan') return null;

  // Pattern: [+-]real [+-]imag i
  // Example: "2.77-17.07i" -> real = 2.77, imag = -17.07
  // Also handle spaces: "2.77 - 17.07i" or "2.89+15.17i"
  const clean = s.replace(/\s+/g, '');
  const match = clean.match(/^([+-]?\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)[ij]$/i);
  if (match) {
    const r = parseFloat(match[1]);
    const x = parseFloat(match[2]);
    if (!isNaN(r) && !isNaN(x)) {
      return { r, x };
    }
  }

  // Handle case where only imaginary: e.g. "-17.07i"
  const imagOnly = clean.match(/^([+-]?\d+(?:\.\d+)?)[ij]$/i);
  if (imagOnly) {
    const x = parseFloat(imagOnly[1]);
    return isNaN(x) ? null : { r: 0, x };
  }

  // Handle real only
  const realOnly = parseFloat(clean);
  if (!isNaN(realOnly)) {
    return { r: realOnly, x: 0 };
  }

  return null;
}

/**
 * Parse CTCL Matrix from Excel workbook buffer
 */
export function parseCTCLWorkbook(buffer: ArrayBuffer, fileName: string, selectedSheet?: string): CTCLMatrixData {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  
  if (sheetNames.length === 0) {
    throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
  }

  // Prefer "CTCL_Matrix", or selectedSheet, or first sheet
  let targetSheet = selectedSheet;
  if (!targetSheet) {
    const found = sheetNames.find(s => s.toLowerCase().replace(/[\s_]/g, '') === 'ctclmatrix');
    targetSheet = found || sheetNames[0];
  }

  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) {
    throw new Error(`시트 "${targetSheet}"를 찾을 수 없습니다.`);
  }

  // Convert to 2D array
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawData.length < 2) {
    throw new Error('CTCL Matrix 시트에 유효한 데이터가 없습니다.');
  }

  // Row 0: Tune positions (starting from col 1)
  const tuneRow = rawData[0];
  const tunes: number[] = [];
  const colIndexToTune = new Map<number, number>();

  for (let c = 1; c < tuneRow.length; c++) {
    const val = tuneRow[c];
    if (val !== '' && val !== undefined) {
      const t = typeof val === 'number' ? val : parseFloat(val.toString().trim());
      if (!isNaN(t)) {
        tunes.push(t);
        colIndexToTune.set(c, t);
      }
    }
  }

  // Col 0: Load positions (starting from row 1)
  const loads: number[] = [];
  const grid: Record<number, Record<number, ComplexNumber>> = {};

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.length === 0) continue;
    const loadVal = row[0];
    if (loadVal === '' || loadVal === undefined) continue;

    const loadNum = typeof loadVal === 'number' ? loadVal : parseFloat(loadVal.toString().trim());
    if (isNaN(loadNum)) continue;

    loads.push(loadNum);
    grid[loadNum] = {};

    for (let c = 1; c < row.length; c++) {
      const tuneNum = colIndexToTune.get(c);
      if (tuneNum === undefined) continue;

      const cellVal = row[c];
      const parsedComplex = parseComplexImpedance(cellVal);
      if (parsedComplex) {
        grid[loadNum][tuneNum] = parsedComplex;
      }
    }
  }

  loads.sort((a, b) => a - b);
  tunes.sort((a, b) => a - b);

  // 축 단위 맞춤: 공정 Log의 Matcher Load/Tune은 0~100(%)
  //  - 엑셀 축이 0~1 비율(최대값 ≤ 1.5)이면 ×100 해서 %로 바꿈 (예: 0.43 → 43)
  //  - 원래 0~100이면 그대로
  const maxAxis = Math.max(loads[loads.length - 1] ?? 0, tunes[tunes.length - 1] ?? 0);
  const minAxis = Math.min(loads[0] ?? 0, tunes[0] ?? 0);
  const isFraction = loads.length > 1 && tunes.length > 1 && minAxis >= 0 && maxAxis > 0 && maxAxis <= 1.5;
  if (isFraction) {
    const pct = (v: number) => Math.round(v * 100 * 1e6) / 1e6; // 0.07*100 = 7.000000000000001 같은 오차 제거
    const scaledGrid: Record<number, Record<number, ComplexNumber>> = {};
    for (const l of loads) {
      const row: Record<number, ComplexNumber> = {};
      for (const [t, v] of Object.entries(grid[l] || {})) row[pct(Number(t))] = v;
      scaledGrid[pct(l)] = row;
    }
    return {
      fileName,
      sheetName: targetSheet,
      availableSheets: sheetNames,
      loads: loads.map(pct),
      tunes: tunes.map(pct),
      grid: scaledGrid,
      axisScale: 'fraction',
    };
  }

  return {
    fileName,
    sheetName: targetSheet,
    availableSheets: sheetNames,
    loads,
    tunes,
    grid,
    axisScale: 'percent',
  };
}

/**
 * 정렬된 축에서 값 v를 둘러싼 두 칸의 위치 [i0, i1] (축 간격과 상관없이)
 * - 축 범위 밖이면 가장자리 칸으로 맞춤 (i0 = i1)
 * - 값이 칸에 딱 맞으면 i0 = i1 = 그 칸
 */
export function bracketAxis(arr: number[], v: number): [number, number] {
  const n = arr.length;
  if (n === 0) return [-1, -1];
  if (v <= arr[0]) return [0, 0];
  if (v >= arr[n - 1]) return [n - 1, n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= v) lo = mid;
    else hi = mid;
  }
  if (arr[lo] === v) return [lo, lo];
  return [lo, hi];
}

/**
 * Bilinear interpolation for Load and Tune
 * RF Ch. R, RF Ch. X
 */
export function interpolateCTCL(matrix: CTCLMatrixData, load: number, tune: number): ComplexNumber | null {
  if (!matrix || matrix.loads.length === 0 || matrix.tunes.length === 0) {
    return null;
  }
  if (!Number.isFinite(load) || !Number.isFinite(tune)) return null;

  const { loads, tunes, grid } = matrix;
  // 둘러싼 이웃 칸 찾기 (축 간격 1%, 0.01, 2%, 5%, 고르지 않은 간격 모두)
  const [i0, i1] = bracketAxis(loads, load);
  const [j0, j1] = bracketAxis(tunes, tune);
  const L0 = loads[i0];
  const L1 = loads[i1];
  const T0 = tunes[j0];
  const T1 = tunes[j1];
  // 범위 밖이면 가장자리로 맞춘 값
  const cl = Math.max(loads[0], Math.min(loads[loads.length - 1], load));
  const ct = Math.max(tunes[0], Math.min(tunes[tunes.length - 1], tune));

  const getPt = (l: number, t: number): ComplexNumber | null => grid[l]?.[t] || null;

  const p00 = getPt(L0, T0);
  const p10 = getPt(L1, T0) || p00;
  const p01 = getPt(L0, T1) || p00;
  const p11 = getPt(L1, T1) || p10 || p01 || p00;

  if (!p00) return null;

  const u = L1 === L0 ? 0 : (cl - L0) / (L1 - L0);
  const v = T1 === T0 ? 0 : (ct - T0) / (T1 - T0);

  const r00 = p00.r;
  const r10 = p10?.r ?? r00;
  const r01 = p01?.r ?? r00;
  const r11 = p11?.r ?? r10;

  const x00 = p00.x;
  const x10 = p10?.x ?? x00;
  const x01 = p01?.x ?? x00;
  const x11 = p11?.x ?? x10;

  // 쌍선형 보간: f(u,v) = (1-u)(1-v)*f00 + u(1-v)*f10 + (1-u)v*f01 + uv*f11
  const interpR = (1 - u) * (1 - v) * r00 + u * (1 - v) * r10 + (1 - u) * v * r01 + u * v * r11;
  const interpX = (1 - u) * (1 - v) * x00 + u * (1 - v) * x10 + (1 - u) * v * x01 + u * v * x11;

  return {
    r: Math.round(interpR * 100) / 100,
    x: Math.round(interpX * 100) / 100,
  };
}
