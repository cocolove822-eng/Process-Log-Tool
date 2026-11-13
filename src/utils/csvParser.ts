import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { HeaterChannelDef, LogMetadata, ParsedLogFile, RawLogRow, StepSummary } from '../types/pecvd';

/**
 * Decode file buffer handling both UTF-8 and EUC-KR / CP949
 */
export async function readFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
    // If UTF-8 fails with byte sequence error, decode as EUC-KR / CP949
    try {
      const eucKrDecoder = new TextDecoder('euc-kr');
      return eucKrDecoder.decode(buffer);
    } catch {
      // Fallback to default
      const defaultDecoder = new TextDecoder();
      return defaultDecoder.decode(buffer);
    }
  }
}

/**
 * Parse time string to milliseconds:
 * Handles:
 * "YYYYMMDD HH:MM:SS.mmm" e.g. "20260917 14:22:31.420"
 * "YYYY-MM-DD HH:MM:SS.mmm"
 * "HH:MM:SS.mmm"
 */
export function parseTimeStrToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim();
  
  // Format: YYYYMMDD HH:MM:SS.mmm
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (compactMatch) {
    const [, y, m, d, hh, mm, ss, ms] = compactMatch;
    const date = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(hh, 10),
      parseInt(mm, 10),
      parseInt(ss, 10),
      parseInt((ms || '0').padEnd(3, '0').slice(0, 3), 10)
    );
    return date.getTime();
  }

  // Format: YYYY-MM-DD HH:MM:SS.mmm
  const stdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (stdMatch) {
    const [, y, m, d, hh, mm, ss, ms] = stdMatch;
    const date = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(hh, 10),
      parseInt(mm, 10),
      parseInt(ss, 10),
      parseInt((ms || '0').padEnd(3, '0').slice(0, 3), 10)
    );
    return date.getTime();
  }

  // Format: HH:MM:SS.mmm
  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (timeOnlyMatch) {
    const [, hh, mm, ss, ms] = timeOnlyMatch;
    return (
      parseInt(hh, 10) * 3600 * 1000 +
      parseInt(mm, 10) * 60 * 1000 +
      parseInt(ss, 10) * 1000 +
      parseInt((ms || '0').padEnd(3, '0').slice(0, 3), 10)
    );
  }

  const parsed = Date.parse(trimmed);
  return isNaN(parsed) ? 0 : parsed;
}

interface SmartGasMapping {
  sih4Act: string[];
  sih4Set: string[];
  n2oAct: string[];
  n2oSet: string[];
  nh3Act: string[];
  nh3Set: string[];
  pn2Act: string[];
  pn2Set: string[];
  arAct: string[];
  arSet: string[];
  h2Act: string[];
  h2Set: string[];
  nf3Act: string[];
  nf3Set: string[];
  oxyArAct: string[];
  oxyArSet: string[];
}

function isGasSetCol(header: string): boolean {
  const l = header.toLowerCase().trim();
  // Set / Target / SV / SP keywords
  if (/(?:^|[\s_\-\/\(\[\{])(set|sv|sp|target)(?:$|[\s_\-\/\)\]\}0-9])/i.test(l)) return true;
  if (l.endsWith('set') || l.endsWith('(set)') || l.endsWith('[set]')) return true;
  if (l.includes('setvalue') || l.includes('set value') || l.includes('target')) return true;
  // Truncated Set suffixes from PLC log column cutoffs: e.g. "Pyro.Ar Se", "Pyro.PN2 S", "Oxy.NF3 S", "Pyro.H2 Se"
  if (/[\s_\-\.](?:se|s)$/i.test(l) && !l.endsWith('seconds')) return true;
  return false;
}

function dedupeGasColumns(cols: string[]): string[] {
  if (cols.length <= 1) return cols;
  const hasNumbered = cols.some(c => /\b[1-9]\b|\d+$/.test(c.trim()));
  if (hasNumbered) {
    // If numbered channels exist (e.g. Oxy.N2O 1, Oxy.N2O 2), prioritize them over unnumbered general columns
    const numbered = cols.filter(c => /\b[1-9]\b|\d+$/.test(c.trim()));
    if (numbered.length > 0) return numbered;
  }
  return cols;
}

function resolveSmartGasColumns(rawHeaders: string[]): SmartGasMapping {
  const result: SmartGasMapping = {
    sih4Act: [], sih4Set: [],
    n2oAct: [], n2oSet: [],
    nh3Act: [], nh3Set: [],
    pn2Act: [], pn2Set: [],
    arAct: [], arSet: [],
    h2Act: [], h2Set: [],
    nf3Act: [], nf3Set: [],
    oxyArAct: [], oxyArSet: [],
  };

  const pushUnique = (arr: string[], item: string) => {
    if (!arr.includes(item)) arr.push(item);
  };

  rawHeaders.forEach(h => {
    const l = h.toLowerCase().trim();
    // Exclude noise that mentions gas names but is not flow/setpoint (valves, alarms, statuses, etc.)
    if (/\b(valve|vlv|status|state|mode|alarm|alm|warning|warn|err|error|zero|cal|relay|sw|switch|leak|interlock|dev)\b/i.test(l)) {
      return;
    }
    // Exclude total/sum summary columns if present to avoid double counting individual MFCs
    if (/\b(total|sum)\b/i.test(l)) {
      return;
    }

    const clean = l.replace(/[\s_\-\/\(\)\[\]\.]/g, '');
    const isSet = isGasSetCol(h);

    // 1. NF3
    if (clean.includes('nf3')) {
      if (isSet) pushUnique(result.nf3Set, h);
      else pushUnique(result.nf3Act, h);
      return;
    }

    // 2. N2O (Supports Oxy.N2O 1, Oxy.N2O 2, Pyro.N2O, MFC_N2O, etc.)
    if (clean.includes('n2o')) {
      if (isSet) pushUnique(result.n2oSet, h);
      else pushUnique(result.n2oAct, h);
      return;
    }

    // 3. NH3
    if (clean.includes('nh3')) {
      if (isSet) pushUnique(result.nh3Set, h);
      else pushUnique(result.nh3Act, h);
      return;
    }

    // 4. SiH4
    if (clean.includes('sih4') || clean.includes('sih_4')) {
      if (isSet) pushUnique(result.sih4Set, h);
      else pushUnique(result.sih4Act, h);
      return;
    }

    // 5. PN2 / N2 (Make sure it is not N2O!)
    if (!clean.includes('n2o') && (clean.includes('pn2') || /(?:^|[^a-z0-9])(pn2|n2)(?:$|[^a-z0-9])/i.test(l) || clean.startsWith('n2') || clean.endsWith('n2'))) {
      if (isSet) pushUnique(result.pn2Set, h);
      else pushUnique(result.pn2Act, h);
      return;
    }

    // 6. H2 (Make sure it is not NH3)
    if (!clean.includes('nh3') && (clean.includes('pyroh2') || clean.includes('mfch2') || /(?:^|[^a-z0-9])h2(?:$|[^a-z0-9])/i.test(l) || clean === 'h2' || clean.startsWith('h2') || clean.endsWith('h2'))) {
      if (isSet) pushUnique(result.h2Set, h);
      else pushUnique(result.h2Act, h);
      return;
    }

    // 7. Ar
    if (!clean.includes('baratron') && !clean.includes('gauge') && !clean.includes('matcher') && (clean.includes('pyroar') || clean.includes('oxyar') || clean.includes('mfcar') || /(?:^|[^a-z0-9])ar(?:$|[^a-z0-9])/i.test(l) || clean === 'ar' || clean.startsWith('ar') || clean.endsWith('ar'))) {
      if (clean.includes('oxy')) {
        if (isSet) pushUnique(result.oxyArSet, h);
        else pushUnique(result.oxyArAct, h);
      } else {
        if (isSet) pushUnique(result.arSet, h);
        else pushUnique(result.arAct, h);
      }
      return;
    }
  });

  // Deduplicate if both numbered MFCs and generic duplicate exist
  result.sih4Act = dedupeGasColumns(result.sih4Act);
  result.sih4Set = dedupeGasColumns(result.sih4Set);
  result.n2oAct = dedupeGasColumns(result.n2oAct);
  result.n2oSet = dedupeGasColumns(result.n2oSet);
  result.nh3Act = dedupeGasColumns(result.nh3Act);
  result.nh3Set = dedupeGasColumns(result.nh3Set);
  result.pn2Act = dedupeGasColumns(result.pn2Act);
  result.pn2Set = dedupeGasColumns(result.pn2Set);
  result.arAct = dedupeGasColumns(result.arAct);
  result.arSet = dedupeGasColumns(result.arSet);
  result.h2Act = dedupeGasColumns(result.h2Act);
  result.h2Set = dedupeGasColumns(result.h2Set);
  result.nf3Act = dedupeGasColumns(result.nf3Act);
  result.nf3Set = dedupeGasColumns(result.nf3Set);
  result.oxyArAct = dedupeGasColumns(result.oxyArAct);
  result.oxyArSet = dedupeGasColumns(result.oxyArSet);

  return result;
}

export function resolveDynamicHeaterChannels(rawHeaders: string[]): {
  discoveredHeaters: HeaterChannelDef[];
  heaterStandardMap: {
    gate1Set?: string;
    gate1Act?: string;
    gate2Set?: string;
    gate2Act?: string;
    win3Set?: string;
    win3Act?: string;
    win4Set?: string;
    win4Act?: string;
    side5Set?: string;
    side5Act?: string;
  };
} {
  const discovered: HeaterChannelDef[] = [];
  const standardMap: {
    gate1Set?: string;
    gate1Act?: string;
    gate2Set?: string;
    gate2Act?: string;
    win3Set?: string;
    win3Act?: string;
    win4Set?: string;
    win4Act?: string;
    side5Set?: string;
    side5Act?: string;
  } = {};

  // 1. Locate RPSC column index (Remote Plasma Source Cleaner)
  // In PECVD log files, Heater zones (Inner, Outer, Center, Gate, Window, etc.) typically appear after RPSC columns
  const rpscIndex = rawHeaders.findIndex(h => /rpsc/i.test(h.trim()));

  const isHeaterCol = (h: string, colIndex: number) => {
    const l = h.toLowerCase().trim();
    // 1. Strictly exclude TV, TV1, TV2, Throttle Valve, RPSC
    if (
      /\b(tv\d*|t\/v\d*|throttle|rpsc)\b/i.test(l) ||
      l.includes('tv1') ||
      l.includes('tv2') ||
      l.includes('rpsc') ||
      l.includes('throttle') ||
      l.startsWith('tv') ||
      l === 'tv' ||
      l === 'tv1' ||
      l === 'tv2' ||
      l === 'rpsc'
    ) {
      return false;
    }

    // 2. Exclude other non-heater noise
    if (/water|generator|gen|rf|matcher|rough|slit|loadlock|cooling|chiller|gauge|pwr|bias|irms|vpp|pressure|pos|position|angle|ctrl|mode|speed|flow|mfc|step|time/i.test(l)) {
      return false;
    }

    // 3. Genuine heater terms (Standard 6G/8.5G/8.6G)
    const hasHeaterKeyword = /gate|window|win\b|side|wall|susceptor|susc\b|zone|heater|htr|ht\d/i.test(l) ||
      ((/temp|deg|℃/i.test(l)) && !/ambient|room/i.test(l));

    // 4. Position + Number pattern (e.g. Inner 1, Inner 2, Outer 2, Center 1, Gate In 1, Win In 3, Top 1, Bottom 2, In 1, Out 2 등)
    const hasPositionNumberPattern = /(?:inner|outer|center|gate|window|win|side|wall|susceptor|zone|top|bottom|in|out)[\s._-]*\d+/i.test(l);

    // 5. Positioned after RPSC column check
    // If the column is located after RPSC columns, give high confidence to position/zone keywords
    const isAfterRpsc = rpscIndex !== -1 && colIndex > rpscIndex;
    if (isAfterRpsc) {
      if (hasHeaterKeyword || hasPositionNumberPattern) return true;
      // Also catch terms like "Inner Set", "Outer Set", "Center Set" even without number if after RPSC
      if (/(?:inner|outer|center|susceptor|wall)\b/i.test(l)) return true;
    }

    return hasHeaterKeyword || hasPositionNumberPattern;
  };

  const isSet = (h: string) => {
    const l = h.toLowerCase();
    return /\b(set|sv|target|sp)\b/i.test(l) || l.includes('set') || l.includes('(set)') || l.includes('[set]');
  };

  // Group candidate columns by base zone name
  const zoneGroups = new Map<string, { rawSetName?: string; rawActName?: string }>();

  rawHeaders.forEach((h, colIndex) => {
    if (!isHeaterCol(h, colIndex)) return;
    const isSetCol = isSet(h);

    // Extract base name
    let baseName = h
      .replace(/\b(Set\s*Value|Set|Act\s*Value|Act|Actual|Real|Temp|Temperature|PV|SV)\b/gi, '')
      .replace(/[\(\)\[\]\{\}]/g, '')
      .replace(/[._\-]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    if (!baseName) {
      baseName = h.trim();
    }

    const baseLower = baseName.toLowerCase();
    // Double check baseName does not match TV or RPSC
    if (
      /\b(tv\d*|t\/v\d*|throttle|rpsc)\b/i.test(baseLower) ||
      baseLower.startsWith('tv') ||
      baseLower.includes('rpsc') ||
      baseLower.includes('throttle') ||
      baseLower === 'tv1' ||
      baseLower === 'tv2'
    ) {
      return;
    }

    if (!zoneGroups.has(baseName)) {
      zoneGroups.set(baseName, {});
    }
    const g = zoneGroups.get(baseName)!;
    if (isSetCol) {
      if (!g.rawSetName) g.rawSetName = h;
    } else {
      if (!g.rawActName) g.rawActName = h;
    }
  });

  let idx = 0;
  zoneGroups.forEach((val, name) => {
    const nameLower = name.toLowerCase();
    if (
      /\b(tv\d*|t\/v\d*|throttle|rpsc)\b/i.test(nameLower) ||
      nameLower.startsWith('tv') ||
      nameLower.includes('rpsc') ||
      nameLower.includes('throttle')
    ) {
      return;
    }

    // Pair fallback: If rawActName is missing, check if rawHeaders has exact match for name (e.g. 'Inner 1')
    if (!val.rawActName) {
      const directActCol = rawHeaders.find(h => h.trim().toLowerCase() === name.trim().toLowerCase());
      if (directActCol) {
        val.rawActName = directActCol;
      }
    }
    // Vice versa: if rawSetName is missing, check for 'name Set'
    if (!val.rawSetName) {
      const directSetCol = rawHeaders.find(h => {
        const l = h.toLowerCase().trim();
        return l.startsWith(name.toLowerCase()) && /\bset\b/i.test(l);
      });
      if (directSetCol) {
        val.rawSetName = directSetCol;
      }
    }

    discovered.push({
      id: `ht_${idx++}`,
      name,
      rawSetName: val.rawSetName || null,
      rawActName: val.rawActName || null,
    });
  });

  // Also map to standard 6G 4/5 zone slots
  discovered.forEach(d => {
    const l = d.name.toLowerCase();
    if (l.includes('gate') && (l.includes('1') || l.includes('in'))) {
      standardMap.gate1Set = d.rawSetName || undefined;
      standardMap.gate1Act = d.rawActName || undefined;
    } else if (l.includes('gate') && (l.includes('2') || l.includes('out'))) {
      standardMap.gate2Set = d.rawSetName || undefined;
      standardMap.gate2Act = d.rawActName || undefined;
    } else if ((l.includes('win') || l.includes('window')) && (l.includes('3') || l.includes('in') || l.includes('1'))) {
      if (!standardMap.win3Set) {
        standardMap.win3Set = d.rawSetName || undefined;
        standardMap.win3Act = d.rawActName || undefined;
      }
    } else if ((l.includes('win') || l.includes('window')) && (l.includes('4') || l.includes('out') || l.includes('2'))) {
      standardMap.win4Set = d.rawSetName || undefined;
      standardMap.win4Act = d.rawActName || undefined;
    } else if (l.includes('side') || (l.includes('5') && !l.includes('gate') && !l.includes('win'))) {
      standardMap.side5Set = d.rawSetName || undefined;
      standardMap.side5Act = d.rawActName || undefined;
    }
  });

  return { discoveredHeaters: discovered, heaterStandardMap: standardMap };
}

/**
 * Universal raw log parsing from a CSV string
 */
export function parseRawLogCsv(csvContent: string, fileName: string): ParsedLogFile {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  // Extract Metadata from rows 1 to 5
  const meta: LogMetadata = {
    cid: '',
    lotId: '',
    substrateId: '',
    recipeName: '',
    date: '',
  };

  // Find header line: dynamically find line containing "step" and "time"
  let headerLineIndex = 5; // default row 6 (0-indexed 5)
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if ((lower.includes('step') && lower.includes('time')) || (lower.includes('stepcount') && lower.includes('time'))) {
      headerLineIndex = i;
      break;
    }
  }

  for (let i = 0; i < headerLineIndex; i++) {
    const line = lines[i];
    // Check for colon separation: "Key: Value"
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      let val = line.slice(colonIdx + 1).replace(/^[,"]+|[",]+$/g, '').trim();
      val = val.split(',')[0].trim();

      if (key.includes('cid')) meta.cid = val;
      else if (key.includes('lotid')) meta.lotId = val;
      else if (key.includes('subst')) meta.substrateId = val;
      else if (key.includes('recipe')) meta.recipeName = val;
      else if (key.includes('date')) meta.date = val;
    } else {
      // Check for comma or tab separation: "Key,Value"
      const parts = line.split(/[,\t]/).map(p => p.replace(/^["']|["']$/g, '').trim());
      if (parts.length >= 2) {
        const key = parts[0].toLowerCase();
        const val = parts[1];
        if (key.includes('cid')) meta.cid = val;
        else if (key.includes('lotid')) meta.lotId = val;
        else if (key.includes('subst')) meta.substrateId = val;
        else if (key.includes('recipe')) meta.recipeName = val;
        else if (key.includes('date')) meta.date = val;
      }
    }
  }

  // If recipeName not in meta, fallback to cleaned fileName
  if (!meta.recipeName) {
    meta.recipeName = fileName.replace(/\.(csv|xlsx|xls|xlsm)$/i, '').replace(/^[0-9_]+/, '');
  }

  // Pre-normalize header row to resolve truncated columns and duplicate headers (Set/Act pairs)
  try {
    const rawHeaderLine = lines[headerLineIndex];
    const parsedHeaderRow = Papa.parse<string[]>(rawHeaderLine).data[0];
    if (parsedHeaderRow && parsedHeaderRow.length > 0) {
      const tokens = parsedHeaderRow.map(h => (h || '').trim());

      // Step 1: Normalize truncated known column names & abbreviated Set tokens
      for (let i = 0; i < tokens.length; i++) {
        const cur = tokens[i];
        if (!cur) continue;
        if (/^step\s*all\s*ti(?:me)?$/i.test(cur)) tokens[i] = 'Step All Time';
        if (/^step\s*nam(?:e)?$/i.test(cur)) tokens[i] = 'Step Name';
        // Abbreviated Set suffix: e.g. "Pyro.Ar Se" -> "Pyro.Ar Set", "Oxy.NF3 S" -> "Oxy.NF3 Set", "Pyro.PN2 S" -> "Pyro.PN2 Set"
        if (/[\s._\-](?:se|s)$/i.test(cur) && !cur.toLowerCase().endsWith('seconds')) {
          tokens[i] = cur.replace(/[\s._\-](?:se|s)$/i, ' Set');
        }
      }

      // Step 2: Disambiguate duplicate headers & pair patterns
      let stepTimeCount = 0;
      for (let i = 0; i < tokens.length; i++) {
        const cur = tokens[i];
        if (/^step\s*time$/i.test(cur)) {
          stepTimeCount++;
          if (stepTimeCount === 2) {
            tokens[i] = 'Step Time Set';
          }
        }

        const next = tokens[i + 1];
        if (next && cur.toLowerCase() === next.toLowerCase()) {
          // Two identical adjacent headers without Set/Act specified (e.g. Pyro.N2O & Pyro.N2O, Pyro.SiH4 & Pyro.SiH4)
          // In standard PLC logs, the first column is the Set value and the second is the Act value
          if (!/set|act/i.test(cur)) {
            tokens[i] = `${cur} Set`;
            tokens[i + 1] = `${next} Act`;
          }
        }
      }

      lines[headerLineIndex] = Papa.unparse([tokens]);
    }
  } catch {
    // If header row pre-normalization fails, proceed with original lines
  }

  // Use PapaParse to parse headers and data starting from headerLineIndex
  const dataCsv = lines.slice(headerLineIndex).join('\n');
  const parsed = Papa.parse<Record<string, string>>(dataCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rawHeaders = parsed.meta.fields || [];
  const headerMap = new Map<string, string>();
  rawHeaders.forEach(h => {
    headerMap.set(h.toLowerCase(), h);
  });

  // Resolve Smart Gas and Dynamic Heater Mappings
  const gasMap = resolveSmartGasColumns(rawHeaders);
  const { discoveredHeaters, heaterStandardMap } = resolveDynamicHeaterChannels(rawHeaders);

  // Dynamically resolve Step Time Set / Set Time column
  let stepTimeSetCol: string | null = null;
  for (const h of rawHeaders) {
    const l = h.toLowerCase().trim();
    if (l.includes('ramp') || l.includes('delay') || l.includes('wait') || l.includes('rf') || l.includes('stable')) {
      continue;
    }
    const clean = l.replace(/[\s._\-\/\(\)\[\]]/g, '');
    if (
      clean === 'set' ||
      clean === 'settime' ||
      clean === 'steptimeset' ||
      clean === 'steptime1' ||
      clean === 'timeset' ||
      clean === 'settimesec' ||
      clean === 'steptimesetsec' ||
      clean === 'settimes' ||
      clean === 'steptimesets' ||
      clean === 'timesetsec' ||
      l === 'set' ||
      l === 'time (set)' ||
      l === 'step time (set)' ||
      (l.includes('set') && l.includes('time') && !l.includes('date'))
    ) {
      stepTimeSetCol = h;
      break;
    }
  }

  // Check missing critical operational columns
  const missingColumns: string[] = [];
  const hasColFuzzy = (name: string) => {
    const clean = name.toLowerCase().replace(/[\s._\-\/\(\)\[\]]/g, '');
    return rawHeaders.some(h => h.toLowerCase().replace(/[\s._\-\/\(\)\[\]]/g, '').includes(clean));
  };

  if (!hasColFuzzy('time')) missingColumns.push('Time');
  if (!hasColFuzzy('step')) missingColumns.push('Step');
  if (!hasColFuzzy('steptime')) missingColumns.push('Step Time');
  if (!hasColFuzzy('rfforward') && !hasColFuzzy('rfpower') && !hasColFuzzy('poweract')) missingColumns.push('RF Forward Power');
  if (!hasColFuzzy('pressure') && !hasColFuzzy('tvpress')) missingColumns.push('Pressure');

  // BB Mode / Specific Gas 플래그 열 감지
  // - BB: 장비마다 열 이름이 다르므로 'BB'라는 단어가 들어간 모든 열을 BB Mode 관련 열로 간주 (예: 'RF BB.mode')
  // - Specific Gas: 'Specific.Gas.Adj' 등 'specificgas'가 포함된 열
  const bbFlagCols = rawHeaders.filter(h => /BB/.test(h) || /(^|[^a-z])bb([^a-z]|$)/i.test(h));
  const specificGasCols = rawHeaders.filter(h => h.toLowerCase().replace(/[\s._\-\/()\[\]]/g, '').includes('specificgas'));
  const parseFlag = (v: unknown): boolean | null => {
    const t = String(v ?? '').trim().toLowerCase();
    if (!t) return null;
    if (['enable', 'enabled', 'true', 'on', 'yes', 't', 'y', '1'].includes(t)) return true;
    if (['disable', 'disabled', 'false', 'off', 'no', 'f', 'n', '0'].includes(t)) return false;
    return null;
  };
  /** 여러 열 중 하나라도 Enable/True면 true, 모두 Disable/False면 false, 읽을 수 있는 값이 없으면 null */
  const readFlagCols = (row: Record<string, string>, cols: string[]): boolean | null => {
    let seen: boolean | null = null;
    for (const c of cols) {
      const f = parseFlag(row[c]);
      if (f === true) return true;
      if (f === false) seen = false;
    }
    return seen;
  };

  // Helper to extract numeric value from row with case-insensitive and trimmed lookup
  const getNum = (row: Record<string, string>, colName: string, def = 0): number => {
    const actualCol = headerMap.get(colName.toLowerCase()) || colName;
    const v = row[actualCol];
    if (v === undefined || v === null || v === '') return def;
    const n = parseFloat(v.toString().replace(/,/g, '').trim());
    return isNaN(n) ? def : n;
  };

  const getNumOrNull = (row: Record<string, string>, colNames: string[]): number | null => {
    for (const name of colNames) {
      if (!name) continue;
      const actualCol = headerMap.get(name.toLowerCase()) || (rawHeaders.includes(name) ? name : undefined);
      if (actualCol) {
        const v = row[actualCol];
        if (v !== undefined && v !== null && v !== '') {
          const n = parseFloat(v.toString().replace(/,/g, '').trim());
          return isNaN(n) ? null : n;
        }
        return null;
      }
    }
    return null;
  };

  const getStr = (row: Record<string, string>, colName: string, def = ''): string => {
    const actualCol = headerMap.get(colName.toLowerCase()) || colName;
    const v = row[actualCol];
    if (v === undefined || v === null) return def;
    return v.toString().trim();
  };

  const getNumOr = (row: Record<string, string>, colNames: string[], def = 0): number => {
    for (const name of colNames) {
      if (!name) continue;
      const actualCol = headerMap.get(name.toLowerCase()) || (rawHeaders.includes(name) ? name : undefined);
      if (actualCol) {
        const v = row[actualCol];
        if (v !== undefined && v !== null && v !== '') {
          const n = parseFloat(v.toString().replace(/,/g, '').trim());
          return isNaN(n) ? def : n;
        }
        return def;
      }
    }
    return def;
  };

  const getStrOr = (row: Record<string, string>, colNames: string[], def = ''): string => {
    for (const name of colNames) {
      if (!name) continue;
      const actualCol = headerMap.get(name.toLowerCase()) || (rawHeaders.includes(name) ? name : undefined);
      if (actualCol) {
        const v = row[actualCol];
        if (v !== undefined && v !== null && v.toString().trim() !== '') {
          return v.toString().trim();
        }
      }
    }
    return def;
  };

  const getSumOfCols = (row: Record<string, string>, colNames: string[]): number => {
    if (!colNames || colNames.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const name of colNames) {
      if (!name) continue;
      const actualCol = headerMap.get(name.toLowerCase()) || (rawHeaders.includes(name) ? name : undefined);
      if (actualCol) {
        const v = row[actualCol];
        if (v !== undefined && v !== null && v !== '') {
          const n = parseFloat(v.toString().replace(/,/g, '').trim());
          if (!isNaN(n)) {
            sum += n;
            count++;
          }
        }
      }
    }
    return count > 0 ? Math.round(sum * 100) / 100 : 0;
  };

  let firstTimestampMs = 0;
  const rows: RawLogRow[] = [];

  for (let idx = 0; idx < parsed.data.length; idx++) {
    const r = parsed.data[idx];
    if (!r) continue;

    const timeStr = getStr(r, 'Time');
    const ts = parseTimeStrToMs(timeStr);
    if (idx === 0 && ts > 0) {
      firstTimestampMs = ts;
    }

    const elapsedSec = (firstTimestampMs > 0 && ts >= firstTimestampMs)
      ? (ts - firstTimestampMs) / 1000
      : idx * 0.1;

    // Dynamic Heaters for this row
    const dynamicHeaterRowValues: Record<string, { set: number | null; act: number | null }> = {};
    discoveredHeaters.forEach(def => {
      let sVal = def.rawSetName ? getNumOrNull(r, [def.rawSetName]) : null;
      const aVal = def.rawActName ? getNumOrNull(r, [def.rawActName]) : null;
      // 만약 'Set' 항목의 데이터가 null, undefined, 또는 '0'과 같이 값이 없다면, Real(Act) 값을 가져옴
      if ((sVal === null || sVal === undefined || sVal === 0) && aVal !== null && aVal !== undefined && aVal > 0) {
        sVal = aVal;
      }
      dynamicHeaterRowValues[def.name] = { set: sVal, act: aVal };
    });

    // Heater Zones Standard slots calculation (with fallback to Act when Set is 0)
    const g1SetRaw = heaterStandardMap.gate1Set ? getNum(r, heaterStandardMap.gate1Set, 0) : getNumOr(r, ['Gate In 1 Set', 'GateIn1 Set', 'Gate 1 Set'], 0);
    const g1ActRaw = heaterStandardMap.gate1Act ? getNum(r, heaterStandardMap.gate1Act, 0) : getNumOr(r, ['Gate In 1', 'GateIn1', 'Gate 1'], 0);
    const gateIn1Set = g1SetRaw > 0 ? g1SetRaw : (g1ActRaw > 0 ? g1ActRaw : 0);
    const gateIn1 = g1ActRaw;

    const g2SetRaw = heaterStandardMap.gate2Set ? getNum(r, heaterStandardMap.gate2Set, 0) : getNumOr(r, ['Gate Out 2 Set', 'GateOut2 Set', 'Gate 2 Set'], 0);
    const g2ActRaw = heaterStandardMap.gate2Act ? getNumOrNull(r, [heaterStandardMap.gate2Act]) : getNumOrNull(r, ['Gate Out 2', 'GateOut2', 'Gate 2']);
    const gateOut2Set = (g2SetRaw && g2SetRaw > 0) ? g2SetRaw : ((g2ActRaw && g2ActRaw > 0) ? g2ActRaw : 0);
    const gateOut2 = g2ActRaw;

    const w3SetRaw = heaterStandardMap.win3Set ? getNum(r, heaterStandardMap.win3Set, 0) : getNumOr(r, ['Window In 3 Set', 'WindowIn3 Set', 'Win In 3 Set', 'Window 3 Set'], 0);
    const w3ActRaw = heaterStandardMap.win3Act ? getNum(r, heaterStandardMap.win3Act, 0) : getNumOr(r, ['Window In 3', 'WindowIn3', 'Win In 3', 'Window 3'], 0);
    const windowIn3Set = w3SetRaw > 0 ? w3SetRaw : (w3ActRaw > 0 ? w3ActRaw : 0);
    const windowIn3 = w3ActRaw;

    const w4SetRaw = heaterStandardMap.win4Set ? getNum(r, heaterStandardMap.win4Set, 0) : getNumOr(r, ['Window Out 4 Set', 'WindowOut4 Set', 'Win Out 4 Set', 'Window 4 Set'], 0);
    const w4ActRaw = heaterStandardMap.win4Act ? getNum(r, heaterStandardMap.win4Act, 0) : getNumOr(r, ['Window Out 4', 'WindowOut4', 'Win Out 4', 'Window 4'], 0);
    const windowOut4Set = w4SetRaw > 0 ? w4SetRaw : (w4ActRaw > 0 ? w4ActRaw : 0);
    const windowOut4 = w4ActRaw;

    const s5SetRaw = heaterStandardMap.side5Set ? getNum(r, heaterStandardMap.side5Set, 0) : getNumOr(r, ['Side 1 In 5 Set', 'Side1In5 Set', 'Side In 5 Set', 'Side 5 Set'], 0);
    const s5ActRaw = heaterStandardMap.side5Act ? getNum(r, heaterStandardMap.side5Act, 0) : getNumOr(r, ['Side 1 In 5', 'Side1In5', 'Side In 5', 'Side 5'], 0);
    const side1In5Set = s5SetRaw > 0 ? s5SetRaw : (s5ActRaw > 0 ? s5ActRaw : 0);
    const side1In5 = s5ActRaw;

    const rowObj: RawLogRow = {
      rowIndex: idx + 1,
      timeStr,
      timestampMs: ts,
      elapsedSec,
      stepCount: getNumOr(r, ['StepCount', 'Step Count', 'Step_Count'], 0),
      step: getNumOr(r, ['Step', 'StepNo', 'Step No', 'Step_No'], 0),
      stepName: getStrOr(r, ['Step Name', 'StepName', 'Step_Name', 'Step Nam', 'Step_Nam', 'Name']),
      stepTime: getNumOr(r, ['Step Time', 'StepTime', 'Step_Time'], 0),
      stepAllTime: getNumOr(r, ['Step All Time', 'StepAllTime', 'Step_All_Time', 'Step All Ti', 'Step_All_Ti', 'All Time', 'AllTime'], 0),
      stepTimeSet: stepTimeSetCol
        ? getNum(r, stepTimeSetCol, 0)
        : getNumOr(r, [
            'Set',
            'Time (Set)',
            'Time(Set)',
            'Set Time',
            'SetTime',
            'Step Time Set',
            'Step Time_1',
            'StepTime Set',
            'StepTimeSet',
            'Time Set',
            'TimeSet',
            'Step Time (Set)',
            'Step Time [Set]',
            'Set Time (sec)',
            'Set Time(sec)',
            'Set Time (s)',
            'Set Time(s)',
            'Step Time Set (sec)',
            'Step Time Set(sec)',
            'Step Time Set (s)',
            'Step Time Set(s)',
            'Set_Time',
            'Step_Time_Set',
          ], 0),

      // Gases (Multi-MFC Summing & Smart Token Resolver)
      // When a gas has multiple MFCs (e.g. Oxy.N2O 1, Oxy.N2O 2), their values are summed together
      oxyNF3: gasMap.nf3Act.length > 0 ? getSumOfCols(r, gasMap.nf3Act) : getNumOr(r, ['Oxy.NF3', 'MFC_NF3', 'NF3'], 0),
      oxyNF3Set: gasMap.nf3Set.length > 0 ? getSumOfCols(r, gasMap.nf3Set) : getNumOr(r, ['Oxy.NF3 Set', 'MFC_NF3 Set', 'NF3 Set'], 0),
      oxyAr: gasMap.oxyArAct.length > 0 ? getSumOfCols(r, gasMap.oxyArAct) : getNumOr(r, ['Oxy.Ar', 'MFC_OxyAr'], 0),
      oxyArSet: gasMap.oxyArSet.length > 0 ? getSumOfCols(r, gasMap.oxyArSet) : getNumOr(r, ['Oxy.Ar Set', 'MFC_OxyAr Set'], 0),

      pyroN2O: gasMap.n2oAct.length > 0 ? getSumOfCols(r, gasMap.n2oAct) : getNumOr(r, ['Pyro.N2O', 'Oxy.N2O', 'MFC_N2O', 'N2O', 'N2O Flow'], 0),
      pyroN2OSet: gasMap.n2oSet.length > 0 ? getSumOfCols(r, gasMap.n2oSet) : getNumOr(r, ['Pyro.N2O Set', 'Oxy.N2O Set', 'MFC_N2O Set', 'N2O Set', 'N2O_Set', 'N2O (Set)', 'N2O(Set)'], 0),

      pyroNH3: gasMap.nh3Act.length > 0 ? getSumOfCols(r, gasMap.nh3Act) : getNumOr(r, ['Pyro.NH3', 'Oxy.NH3', 'MFC_NH3', 'NH3', 'NH3 Flow'], 0),
      pyroNH3Set: gasMap.nh3Set.length > 0 ? getSumOfCols(r, gasMap.nh3Set) : getNumOr(r, ['Pyro.NH3 Set', 'Oxy.NH3 Set', 'MFC_NH3 Set', 'NH3 Set', 'NH3_Set', 'NH3 (Set)', 'NH3(Set)'], 0),

      pyroAr: gasMap.arAct.length > 0
        ? getSumOfCols(r, gasMap.arAct)
        : (gasMap.oxyArAct.length > 0 ? getSumOfCols(r, gasMap.oxyArAct) : getNumOr(r, ['Pyro.Ar', 'MFC_Ar', 'Ar', 'Ar Flow'], 0)),
      pyroArSet: gasMap.arSet.length > 0
        ? getSumOfCols(r, gasMap.arSet)
        : (gasMap.oxyArSet.length > 0 ? getSumOfCols(r, gasMap.oxyArSet) : getNumOr(r, ['Pyro.Ar Set', 'MFC_Ar Set', 'Ar Set', 'Ar_Set', 'Ar (Set)', 'Ar(Set)'], 0)),

      pyroSiH4: gasMap.sih4Act.length > 0 ? getSumOfCols(r, gasMap.sih4Act) : getNumOr(r, ['Pyro.SiH4', 'Oxy.SiH4', 'MFC_SiH4', 'SiH4', 'SiH4 Flow'], 0),
      pyroSiH4Set: gasMap.sih4Set.length > 0 ? getSumOfCols(r, gasMap.sih4Set) : getNumOr(r, ['Pyro.SiH4 Set', 'Oxy.SiH4 Set', 'MFC_SiH4 Set', 'SiH4 Set', 'SiH4_Set', 'SiH4 (Set)', 'SiH4(Set)'], 0),

      pyroPN2: gasMap.pn2Act.length > 0 ? getSumOfCols(r, gasMap.pn2Act) : getNumOr(r, ['Pyro.PN2', 'Oxy.PN2', 'MFC_PN2', 'PN2', 'PN2 Flow', 'N2', 'MFC_N2'], 0),
      pyroPN2Set: gasMap.pn2Set.length > 0 ? getSumOfCols(r, gasMap.pn2Set) : getNumOr(r, ['Pyro.PN2 Set', 'Oxy.PN2 Set', 'MFC_PN2 Set', 'PN2 Set', 'PN2_Set', 'PN2 (Set)', 'N2 Set', 'N2_Set'], 0),

      pyroH2: gasMap.h2Act.length > 0 ? getSumOfCols(r, gasMap.h2Act) : getNumOr(r, ['Pyro.H2', 'MFC_H2', 'H2', 'H2 Flow'], 0),
      pyroH2Set: gasMap.h2Set.length > 0 ? getSumOfCols(r, gasMap.h2Set) : getNumOr(r, ['Pyro.H2 Set', 'MFC_H2 Set', 'H2 Set', 'H2_Set', 'H2 (Set)', 'H2(Set)'], 0),

      // Pressure & Throttle Valve
      tvPressureSet: getNumOr(r, ['T/V Pressure Set', 'TV Pressure Set', 'T/V Pressure (Set)', 'T/V Pressure S', 'T/V Pressure Se', 'Pressure Set', 'Pressure S', 'TV Pressure (Set)'], 0),
      tvPressure: getNumOr(r, ['T/V Pressure', 'TV Pressure', 'T/V Pressure(Act)', 'T/V Pressure Act', 'Pressure', 'Pressure Act'], 0),
      tvPositionSet: getNumOr(r, ['T/V Position Set', 'TV Position Set', 'T/V Position (Set)', 'Position Set'], 0),
      tvPosition: getNumOr(r, ['T/V Position', 'TV Position', 'Position'], 0),
      tvCtrlModeSet: getStrOr(r, [
        'T/V Ctrl Mode Set',
        'TV Ctrl Mode Set',
        'T/V Ctrl Mode (Set)',
        'T/V Ctrl Mode(Set)',
        'T/V Mode Set',
        'TV Mode Set',
        'T/V Ctrl Mode',
        'TV Ctrl Mode',
      ], ''),
      tvCtrlMode: getStrOr(r, [
        'T/V Ctrl Mode',
        'TV Ctrl Mode',
        'T/V Ctrl Mode Act',
        'TV Ctrl Mode Act',
        'T/V Mode',
        'TV Mode',
        'T/V Ctrl Mode Set',
        'TV Ctrl Mode Set',
      ], ''),

      // Lift
      liftPos: getNumOr(r, ['Lift Pos', 'LiftPos', 'Lift Position'], 0),
      liftSpacingSet: getNumOr(r, ['Lift Spacing Set', 'Lift Spacing (Set)', 'Lift Spacing S', 'Lift Spacing Se', 'Spacing Set', 'Spacing S', 'LiftSpacingSet'], 0),
      liftSpacing: getNumOr(r, ['Lift Spacing', 'Lift Spacing(Act)', 'Lift Spacing Act', 'Spacing', 'LiftSpacing'], 0),
      liftVelocity: getNumOrNull(r, ['Lift Velocity', 'Lift Velcovity', 'Lift Vel', 'Lift Speed', 'LiftVelocity', 'LiftVelcovity']),
      liftAccDec: getNumOrNull(r, ['Lift Acc/Dec', 'Lift ACC/DCC', 'Lift Acc/Dcc', 'Lift Acc', 'Lift Acceleration', 'LiftAccDec', 'Lift Acc Dec']),

      // Matcher (supports standard and vendor variations)
      matcherLoad: getNumOr(r, ['Matcher Load', 'Matcher_Load', 'MatcherLoad', 'Load Pos', 'Load', 'Load(%)'], 0),
      matcherTune: getNumOr(r, ['Matcher Tune', 'Matcher_Tune', 'MatcherTune', 'Tune Pos', 'Tune', 'Tune(%)'], 0),
      matcherVpp: getNumOr(r, ['Matcher Vpp', 'Matcher_Vpp', 'MatcherVpp', 'Vpp', 'Matcher Vpp(V)', 'Matcher Vpp [V]', 'Vpp(V)', 'Vpp [V]', 'RF Vpp'], 0),
      matcherIrms: getNumOr(r, ['Matcher Irms', 'Matcher_Irms', 'MatcherIrms', 'Irms', 'Matcher Irms(A)', 'Matcher Irms [A]', 'Irms(A)', 'RF Irms'], 0),
      matcherDCBias: getNumOr(r, ['Matcher DC Bias', 'Matcher_DC_Bias', 'MatcherDCBias', 'DC Bias', 'DC_Bias', 'Vdc', 'Matcher Vdc', 'DC Bias(V)'], 0),

      // RF (supports standard and vendor variations)
      rfOn: (() => {
        const val = getStrOr(r, [
          'RF On', 'RF_On', 'RFOn', 'RF Generator On', 'RF Status', 'RF_Status',
          'RF Fwd Status', 'RF Fwd On', 'RF State', 'Generator On', 'Plasma On',
          'RF Power On', 'RF Generator'
        ], '');
        if (val) return val;
        const fwdStr = getStr(r, 'RF Fwd');
        if (/^(on|off|1|0)$/i.test(fwdStr)) return fwdStr;
        // Dynamically check any column containing rf and on/status/state
        for (const [key, rawVal] of Object.entries(r)) {
          const lKey = key.toLowerCase();
          if (lKey.includes('rf') && (lKey.includes('on') || lKey.includes('status') || lKey.includes('state') || lKey.includes('gen'))) {
            const trimmed = String(rawVal || '').trim().toLowerCase();
            if (trimmed === 'on' || trimmed === 'off' || trimmed === '1' || trimmed === '0') {
              return trimmed;
            }
          }
        }
        return '';
      })(),
      rfForwardSetValue: getNumOr(r, [
        'RF Forward SetValue', 'RF Forward SetValue(Set)', 'RF Forward SetValue Set', 'RF Forward Set',
        'RF Forward S', 'RF Forward Se', 'RF Forward SetVal', 'RF Power Set', 'RF_Forward_SetValue',
        'RF Set', 'RF Set(W)', 'RF Forward SetValue [W]', 'RF Fwd Set', 'RF Fwd SetValue',
        'RF Forward Power Set', 'RF Forward Power(Set)', 'RF Power Set(W)', 'RF Power (Set)',
        'RF Power', 'Forward Set', 'Forward SetValue', 'Fwd Set', 'Fwd SetValue'
      ], 0),
      bbMode: bbFlagCols.length > 0 ? readFlagCols(r, bbFlagCols) : null,
      specificGasAdj: specificGasCols.length > 0 ? readFlagCols(r, specificGasCols) : null,
      rfForwardSetValueAct: getNumOr(r, ['RF Forward SetValue(Act)', 'RF Forward SetValue (Act)', 'RF Forward SetValue Act', 'RF_Forward_SetValue(Act)', 'RF Forward Set Act'], 0),
      rfForwardPowerAct: getNumOr(r, ['RF Forward Power(Act)', 'RF Forward Power (Act)', 'RF Forward Power Act', 'RF Forward Power', 'RF Forward Act', 'RF Power(Act)', 'RF Power Act', 'RF_Forward_Power(Act)', 'RF Forward Power(W)', 'RF Forward P', 'RF Forward Pow', 'RF Fwd Power', 'RF Fwd Act'], 0),
      rfReflectPower: getNumOr(r, ['RF Reflect Power', 'RF Reflect Power(Act)', 'RF Reflect Power Act', 'RF Reflect', 'RF Ref Power', 'RF_Reflect_Power', 'RF Ref(W)', 'RF Reflect Power(W)'], 0),
      rfRampValueUp: getNumOr(r, ['RF Ramp Value Up', 'RF Ramp Up Value', 'RF Ramp Up'], 0),
      rfRampTimeUp: getNumOr(r, ['RF Ramp Time Up', 'RF Ramp Up Time'], 0),

      // RPSC
      rpscForward: getNum(r, 'RPSC Forward', 0),
      rpscReflect: getNum(r, 'RPSC Reflect', 0),

      // Heater Zones (Standard slots with auto fallback from dynamic discovery)
      gateIn1Set,
      gateIn1,
      gateOut2Set,
      gateOut2,
      windowIn3Set,
      windowIn3,
      windowOut4Set,
      windowOut4,
      side1In5Set,
      side1In5,

      dynamicHeaters: dynamicHeaterRowValues,
      allValues: r,
    };

    rows.push(rowObj);
  }

  // Calculate Steps Summary
  const stepMap = new Map<number, { name: string; count: number; minSec: number; maxSec: number; maxStepAllTime: number }>();
  rows.forEach(row => {
    const s = row.step;
    const cur = stepMap.get(s);
    if (!cur) {
      stepMap.set(s, {
        name: row.stepName || `Step ${s}`,
        count: 1,
        minSec: row.elapsedSec,
        maxSec: row.elapsedSec,
        maxStepAllTime: row.stepAllTime,
      });
    } else {
      cur.count++;
      cur.maxSec = Math.max(cur.maxSec, row.elapsedSec);
      cur.maxStepAllTime = Math.max(cur.maxStepAllTime, row.stepAllTime);
      if (!cur.name && row.stepName) cur.name = row.stepName;
    }
  });

  const stepsSummary: StepSummary[] = [];
  Array.from(stepMap.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([step, info]) => {
      const dur = info.maxStepAllTime > 0 ? info.maxStepAllTime : (info.maxSec - info.minSec);
      stepsSummary.push({
        step,
        stepName: info.name,
        rowCount: info.count,
        durationSec: Math.round(dur * 10) / 10,
        startElapsedSec: Math.round(info.minSec * 10) / 10,
        endElapsedSec: Math.round(info.maxSec * 10) / 10,
      });
    });

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fileName,
    meta,
    headers: rawHeaders,
    missingColumns,
    rows,
    stepsSummary,
    heaterChannelDefs: discoveredHeaters,
  };
}

/**
 * Universal raw log loader that handles:
 * 1. Single CSV files (.csv)
 * 2. Single Excel files (.xlsx, .xls) containing 1 recipe run per file
 * 3. Multi-sheet Excel files containing multiple runs
 */
export async function parseRawLogFile(file: File): Promise<ParsedLogFile[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const results: ParsedLogFile[] = [];

    for (const sheetName of workbook.SheetNames) {
      // Skip CTCL matrix sheets if accidentally uploaded as raw data
      if (sheetName.toLowerCase().replace(/[\s_]/g, '') === 'ctclmatrix') {
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const csvString = XLSX.utils.sheet_to_csv(sheet);
      if (csvString.trim().length > 30) {
        const displayName = workbook.SheetNames.length > 1
          ? `${file.name} [${sheetName}]`
          : file.name;
        const parsed = parseRawLogCsv(csvString, displayName);
        results.push(parsed);
      }
    }

    if (results.length === 0) {
      throw new Error(`엑셀 파일 "${file.name}"에서 유효한 공정 Log 데이터를 찾을 수 없습니다.`);
    }

    return results;
  }

  // Otherwise treat as CSV / Text file
  const text = await readFileAsText(file);
  const parsed = parseRawLogCsv(text, file.name);
  return [parsed];
}
