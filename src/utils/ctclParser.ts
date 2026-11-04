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

  return {
    fileName,
    sheetName: targetSheet,
    availableSheets: sheetNames,
    loads,
    tunes,
    grid,
  };
}

/**
 * Bilinear interpolation for Load and Tune
 * RF Ch. R, RF Ch. X
 */
export function interpolateCTCL(matrix: CTCLMatrixData, load: number, tune: number): ComplexNumber | null {
  if (!matrix || matrix.loads.length === 0 || matrix.tunes.length === 0) {
    return null;
  }

  const { loads, tunes, grid } = matrix;
  const minLoad = loads[0];
  const maxLoad = loads[loads.length - 1];
  const minTune = tunes[0];
  const maxTune = tunes[tunes.length - 1];

  // Clamp
  const clampedLoad = Math.max(minLoad, Math.min(maxLoad, load));
  const clampedTune = Math.max(minTune, Math.min(maxTune, tune));

  // Find nearest bounding integers / grid coordinates
  const floorLoad = Math.floor(clampedLoad);
  const ceilLoad = Math.ceil(clampedLoad);
  const floorTune = Math.floor(clampedTune);
  const ceilTune = Math.ceil(clampedTune);

  const L0 = findClosestCoordinate(loads, floorLoad);
  const L1 = findClosestCoordinate(loads, ceilLoad === floorLoad ? (floorLoad + 1 <= maxLoad ? floorLoad + 1 : floorLoad) : ceilLoad);
  const T0 = findClosestCoordinate(tunes, floorTune);
  const T1 = findClosestCoordinate(tunes, ceilTune === floorTune ? (floorTune + 1 <= maxTune ? floorTune + 1 : floorTune) : ceilTune);

  const getPt = (l: number, t: number): ComplexNumber | null => {
    return grid[l]?.[t] || null;
  };

  const p00 = getPt(L0, T0);
  const p10 = getPt(L1, T0) || p00;
  const p01 = getPt(L0, T1) || p00;
  const p11 = getPt(L1, T1) || p10 || p01 || p00;

  if (!p00) return null;

  const dL = L1 - L0;
  const dT = T1 - T0;

  const u = dL === 0 ? 0 : (clampedLoad - L0) / dL;
  const v = dT === 0 ? 0 : (clampedTune - T0) / dT;

  const r00 = p00.r;
  const r10 = p10?.r ?? r00;
  const r01 = p01?.r ?? r00;
  const r11 = p11?.r ?? r10;

  const x00 = p00.x;
  const x10 = p10?.x ?? x00;
  const x01 = p01?.x ?? x00;
  const x11 = p11?.x ?? x10;

  // Bilinear formula:
  // f(u,v) = (1-u)(1-v)*f00 + u(1-v)*f10 + (1-u)v*f01 + uv*f11
  const interpR = (1 - u) * (1 - v) * r00 + u * (1 - v) * r10 + (1 - u) * v * r01 + u * v * r11;
  const interpX = (1 - u) * (1 - v) * x00 + u * (1 - v) * x10 + (1 - u) * v * x01 + u * v * x11;

  return {
    r: Math.round(interpR * 100) / 100,
    x: Math.round(interpX * 100) / 100,
  };
}

function findClosestCoordinate(arr: number[], target: number): number {
  if (arr.includes(target)) return target;
  let closest = arr[0];
  let minDiff = Math.abs(target - arr[0]);
  for (let i = 1; i < arr.length; i++) {
    const diff = Math.abs(target - arr[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = arr[i];
    }
  }
  return closest;
}
