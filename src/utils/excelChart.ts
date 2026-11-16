/**
 * '엑셀 저장': 그래프를 엑셀이 직접 그리는 차트(.xlsx)로 저장
 * - 시트 '그래프': 커서 Time 입력 칸 · 그 시간의 모든 값 표(수식) · Step 표 · 엑셀 차트
 * - 시트 'Data' : 선별 Time · 값 + 도우미(커서 세로선 · Step 경계 점선)
 * - 엑셀에서: 선 위 마우스 = 값 표시, 축 오른쪽 클릭 → 축 서식, B3 숫자를 바꾸면 커서 선과 값 표가 바뀜
 * - 좌·우 2축 지원 (통합 그래프)
 * 라이브러리 없이 xlsx 구조(XML)를 직접 만들고 fflate로 압축
 */
import { saveFile, SaveOutcome } from './saveFile';
import { strToU8, zipSync } from 'fflate';

export interface XSeries {
  name: string;
  unit: string;
  color: string;
  /** [시간(s), 값] — 시간 순 */
  points: [number, number][];
  side?: 'L' | 'R';
}
export interface XAxis {
  min: number;
  max: number;
  /** 눈금 간격 (null = 엑셀 자동) */
  major: number | null;
  title: string;
  format?: string;
  log?: boolean;
  grid?: boolean;
}
export interface XStep {
  step: number;
  name: string;
  start: number;
  end: number;
}
export interface XChartSpec {
  title: string;
  series: XSeries[];
  x: XAxis;
  yL: XAxis;
  yR?: XAxis | null;
  steps?: XStep[];
  /** 커서 Time 처음 값 */
  cursorT: number;
  fileName: string;
}

// ───────── 보조 ─────────
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colName = (i: number) => {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const num = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : '0');
const hex = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  return m ? m[1].toUpperCase() : '334155';
};
const DATA = 'Data';
const GRAPH = '그래프';
const qs = (name: string) => `'${name.replace(/'/g, "''")}'`;

/** 셀 하나 */
type Cell = { v?: number | string | null; f?: string; s?: number };
const cellXml = (ref: string, c: Cell) => {
  const st = c.s ? ` s="${c.s}"` : '';
  if (c.f !== undefined) {
    const isStr = typeof c.v === 'string';
    return `<c r="${ref}"${st}${isStr ? ' t="str"' : ''}><f>${esc(c.f)}</f>${c.v === null || c.v === undefined ? '' : `<v>${isStr ? esc(String(c.v)) : num(c.v as number)}</v>`}</c>`;
  }
  if (c.v === null || c.v === undefined || c.v === '') return c.s ? `<c r="${ref}"${st}/>` : '';
  if (typeof c.v === 'number') return `<c r="${ref}"${st}><v>${num(c.v)}</v></c>`;
  return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
};
const sheetXml = (rows: Map<number, Map<number, Cell>>, opts: { cols?: number[]; drawing?: boolean; freezeRow1?: boolean }) => {
  const out: string[] = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
  ];
  // 그래프 시트: 인쇄하면 가로 한 장에 맞춤
  if (opts.drawing) out.push(`<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`);
  if (opts.freezeRow1)
    out.push(`<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`);
  else out.push(`<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>`);
  out.push(`<sheetFormatPr defaultRowHeight="16.5"/>`);
  if (opts.cols?.length) out.push(`<cols>${opts.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`);
  out.push('<sheetData>');
  [...rows.keys()]
    .sort((a, b) => a - b)
    .forEach(r => {
      const cells = rows.get(r)!;
      const xs = [...cells.keys()].sort((a, b) => a - b).map(c => cellXml(`${colName(c)}${r}`, cells.get(c)!)).join('');
      if (xs) out.push(`<row r="${r}">${xs}</row>`);
    });
  out.push('</sheetData>');
  out.push(`<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>`);
  if (opts.drawing) out.push(`<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1"/>`);
  if (opts.drawing) out.push(`<drawing r:id="rId1"/>`);
  out.push('</worksheet>');
  return out.join('');
};
const put = (rows: Map<number, Map<number, Cell>>, r: number, c: number, cell: Cell) => {
  if (!rows.has(r)) rows.set(r, new Map());
  rows.get(r)!.set(c, cell);
};

// ───────── 차트 XML ─────────
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const FONT = '맑은 고딕';
const rich = (text: string, sz = 1000, bold = true) =>
  `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${bold ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="ko-KR" sz="${sz}" b="${bold ? 1 : 0}"><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx>`;
const lineSp = (color: string, w: number, dash = 'solid') =>
  `<c:spPr><a:ln w="${w}" cap="rnd"><a:solidFill><a:srgbClr val="${hex(color)}"/></a:solidFill><a:prstDash val="${dash}"/><a:round/></a:ln></c:spPr>`;
const numCache = (vals: (number | null)[]) =>
  `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>${vals
    .map((v, i) => (v === null ? '' : `<c:pt idx="${i}"><c:v>${num(v)}</c:v></c:pt>`))
    .join('')}</c:numCache>`;

interface SerRef {
  name: string;
  nameRef: string;
  xRef: string;
  yRef: string;
  xs: (number | null)[];
  ys: (number | null)[];
  color: string;
  width: number;
  dash: string;
}
const serXml = (s: SerRef, idx: number) =>
  `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/><c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>${lineSp(s.color, s.width, s.dash)}<c:marker><c:symbol val="none"/></c:marker><c:xVal><c:numRef><c:f>${esc(s.xRef)}</c:f>${numCache(s.xs)}</c:numRef></c:xVal><c:yVal><c:numRef><c:f>${esc(s.yRef)}</c:f>${numCache(s.ys)}</c:numRef></c:yVal><c:smooth val="0"/></c:ser>`;

const axTxPr = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="334155"/></a:solidFill><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>`;
const valAx = (o: {
  id: number;
  cross: number;
  pos: 'b' | 'l' | 'r';
  ax: XAxis;
  deleted?: boolean;
  crosses: 'min' | 'max' | 'autoZero';
}) =>
  `<c:valAx><c:axId val="${o.id}"/><c:scaling>${o.ax.log ? '<c:logBase val="10"/>' : ''}<c:orientation val="minMax"/><c:max val="${num(o.ax.max)}"/><c:min val="${num(o.ax.min)}"/></c:scaling><c:delete val="${o.deleted ? 1 : 0}"/><c:axPos val="${o.pos}"/>${
    o.ax.grid && !o.deleted ? `<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9DEE5"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>` : ''
  }${o.deleted ? '' : `<c:title>${rich(o.ax.title, 1000)}<c:overlay val="0"/></c:title>`}<c:numFmt formatCode="${esc(o.ax.format || 'General')}" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="${o.pos === 'b' ? 'low' : 'nextTo'}"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill></a:ln></c:spPr>${axTxPr}<c:crossAx val="${o.cross}"/><c:crosses val="${o.crosses}"/><c:crossBetween val="midCat"/>${
    o.ax.major && o.ax.major > 0 ? `<c:majorUnit val="${num(o.ax.major)}"/>` : ''
  }</c:valAx>`;

function chartXml(spec: XChartSpec, left: SerRef[], right: SerRef[], helpers: SerRef[], hideFromLegend: number[]) {
  let idx = 0;
  const leftXml = [...left, ...helpers].map(s => serXml(s, idx++)).join('');
  const rightXml = right.map(s => serXml(s, idx++)).join('');
  const hasR = right.length > 0 && !!spec.yR;
  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:roundedCorners val="0"/><c:chart>`,
    `<c:title>${rich(spec.title, 1300)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`,
    `<c:plotArea><c:layout/>`,
    `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${leftXml}<c:axId val="1001"/><c:axId val="1002"/></c:scatterChart>`,
    hasR ? `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${rightXml}<c:axId val="1003"/><c:axId val="1004"/></c:scatterChart>` : '',
    valAx({ id: 1001, cross: 1002, pos: 'b', ax: spec.x, crosses: 'min' }),
    valAx({ id: 1002, cross: 1001, pos: 'l', ax: spec.yL, crosses: 'min' }),
    hasR ? valAx({ id: 1003, cross: 1004, pos: 'b', ax: spec.x, deleted: true, crosses: 'autoZero' }) : '',
    hasR ? valAx({ id: 1004, cross: 1003, pos: 'r', ax: spec.yR!, crosses: 'max' }) : '',
    `<c:spPr><a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></c:spPr>`,
    `</c:plotArea>`,
    `<c:legend><c:legendPos val="b"/>${hideFromLegend.map(i => `<c:legendEntry><c:idx val="${i}"/><c:delete val="1"/></c:legendEntry>`).join('')}<c:overlay val="0"/>${axTxPr}</c:legend>`,
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>`,
    `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></c:spPr>`,
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="${FONT}"/><a:ea typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>`,
    `</c:chartSpace>`,
  ].join('');
}

// ───────── 값: 시간 t의 값 (t 이하 마지막 점, 엑셀 MATCH(…,1)과 같은 규칙) ─────────
const valueAt = (pts: [number, number][], t: number): number | null => {
  let lo = 0;
  let hi = pts.length - 1;
  if (hi < 0 || t < pts[0][0]) return null;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (pts[m][0] <= t) lo = m;
    else hi = m - 1;
  }
  return pts[lo][1];
};

/** .xlsx 파일 내용 만들기 */
export function buildChartXlsx(spec: XChartSpec): Uint8Array {
  const data = new Map<number, Map<number, Cell>>();
  const graph = new Map<number, Map<number, Cell>>();
  const dataCols: number[] = [];

  // 1) Data 시트: 선마다 [Time, 값] 두 칸
  const refs: SerRef[] = [];
  spec.series.forEach((s, i) => {
    const cx = i * 2;
    const cy = cx + 1;
    put(data, 1, cx, { v: `${s.name} Time(s)`, s: 1 });
    put(data, 1, cy, { v: s.name, s: 1 });
    s.points.forEach(([t, v], k) => {
      put(data, k + 2, cx, { v: t });
      put(data, k + 2, cy, { v });
    });
    dataCols.push(14, Math.max(12, Math.min(28, s.name.length + 4)));
    const last = Math.max(2, s.points.length + 1);
    refs.push({
      name: s.name,
      nameRef: `${DATA}!$${colName(cy)}$1`,
      xRef: `${DATA}!$${colName(cx)}$2:$${colName(cx)}$${last}`,
      yRef: `${DATA}!$${colName(cy)}$2:$${colName(cy)}$${last}`,
      xs: s.points.map(p => p[0]),
      ys: s.points.map(p => p[1]),
      color: s.color,
      width: 19050,
      dash: 'solid',
    });
  });

  // 2) 도우미: 커서 세로선 (X = 그래프!B3, Y = 왼쪽 축 최소·최대), Step 경계 점선
  const hc = spec.series.length * 2 + 1; // 한 칸 띄움
  dataCols.push(4, 12, 12, 4, 12, 12);
  put(data, 1, hc, { v: '커서', s: 1 });
  put(data, 1, hc + 1, { v: '커서 선 Y (높이)', s: 1 });
  [spec.yL.min, spec.yL.max].forEach((y, k) => {
    put(data, k + 2, hc, { f: `${qs(GRAPH)}!$B$3`, v: spec.cursorT });
    put(data, k + 2, hc + 1, { v: y });
  });
  const cursorRef: SerRef = {
    name: '커서',
    nameRef: `${DATA}!$${colName(hc)}$1`,
    xRef: `${DATA}!$${colName(hc)}$2:$${colName(hc)}$3`,
    yRef: `${DATA}!$${colName(hc + 1)}$2:$${colName(hc + 1)}$3`,
    xs: [spec.cursorT, spec.cursorT],
    ys: [spec.yL.min, spec.yL.max],
    color: '#DC2626',
    width: 15875,
    dash: 'dash',
  };
  // Step 경계: 경계마다 (t, 최소) · (t, 최대) · 빈칸 → 끊어진 세로 점선
  const sc = hc + 3;
  put(data, 1, sc, { v: 'Step 경계', s: 1 });
  put(data, 1, sc + 1, { v: 'Step 경계 Y (높이)', s: 1 });
  const bounds = (spec.steps ?? [])
    .slice(1)
    .map(st => st.start)
    .filter(t => t > spec.x.min && t < spec.x.max);
  const sx: (number | null)[] = [];
  const sy: (number | null)[] = [];
  bounds.forEach(t => {
    sx.push(t, t, null);
    sy.push(spec.yL.min, spec.yL.max, null);
  });
  sx.forEach((x, k) => {
    if (x !== null) {
      put(data, k + 2, sc, { v: x });
      put(data, k + 2, sc + 1, { v: sy[k] });
    }
  });
  const stepRef: SerRef | null = sx.length
    ? {
        name: 'Step 경계',
        nameRef: `${DATA}!$${colName(sc)}$1`,
        xRef: `${DATA}!$${colName(sc)}$2:$${colName(sc)}$${sx.length + 1}`,
        yRef: `${DATA}!$${colName(sc + 1)}$2:$${colName(sc + 1)}$${sx.length + 1}`,
        xs: sx,
        ys: sy,
        color: '#94A3B8',
        width: 9525,
        dash: 'sysDash',
      }
    : null;

  // 3) 그래프 시트: 제목 · 커서 Time · 모든 값 표 · Step 표
  put(graph, 1, 0, { v: spec.title, s: 3 });
  put(graph, 2, 0, { v: '선 위에 마우스 = 값 · 축 오른쪽 클릭 → 축 서식 · Data 시트 = 원본 값', s: 5 });
  put(graph, 3, 0, { v: '커서 Time (sec)', s: 1 });
  put(graph, 3, 1, { v: spec.cursorT, s: 2 });
  put(graph, 4, 0, { v: '↑ B3 숫자를 바꾸면 빨간 커서 선과 아래 값이 바뀝니다', s: 5 });
  put(graph, 6, 0, { v: '항목', s: 1 });
  put(graph, 6, 1, { v: '커서 값', s: 1 });
  put(graph, 6, 2, { v: '단위', s: 1 });
  if (spec.yR) put(graph, 6, 3, { v: '축', s: 1 });
  spec.series.forEach((s, i) => {
    const r = 7 + i;
    const ref = refs[i];
    const v = valueAt(s.points, spec.cursorT);
    put(graph, r, 0, { v: s.name, s: 4 });
    put(graph, r, 1, { f: `IFERROR(INDEX(${ref.yRef},MATCH($B$3,${ref.xRef},1)),"-")`, v: v === null ? '-' : v, s: 6 });
    put(graph, r, 2, { v: s.unit, s: 4 });
    if (spec.yR) put(graph, r, 3, { v: s.side === 'R' ? '우' : '좌', s: 4 });
  });
  if (spec.steps?.length) {
    const r0 = 7 + spec.series.length + 1;
    ['Step', '이름', '시작(s)', '끝(s)'].forEach((h, c) => put(graph, r0, c, { v: h, s: 1 }));
    spec.steps.forEach((st, k) => {
      put(graph, r0 + 1 + k, 0, { v: st.step, s: 4 });
      put(graph, r0 + 1 + k, 1, { v: st.name, s: 4 });
      put(graph, r0 + 1 + k, 2, { v: Math.round(st.start * 10) / 10, s: 4 });
      put(graph, r0 + 1 + k, 3, { v: Math.round(st.end * 10) / 10, s: 4 });
    });
  }

  // 4) 차트: 왼쪽 선 + 도우미(커서 · Step 경계)는 주 축, 오른쪽 선은 보조 축
  const left = refs.filter((_, i) => spec.series[i].side !== 'R');
  const right = spec.yR ? refs.filter((_, i) => spec.series[i].side === 'R') : [];
  const helpers = [cursorRef, ...(stepRef ? [stepRef] : [])];
  const leftList = spec.yR ? left : refs;
  const hide = stepRef ? [leftList.length + 1] : [];
  const chart = chartXml(spec, leftList, right, helpers, hide);

  const anchorRows = Math.max(30, 7 + spec.series.length + (spec.steps?.length ?? 0) + 3);
  const drawing = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${A}"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>21</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${Math.min(anchorRows, 34)}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.###"/></numFmts><fonts count="4"><font><sz val="10"/><name val="${FONT}"/><family val="3"/></font><font><b/><sz val="10"/><name val="${FONT}"/><family val="3"/></font><font><b/><sz val="14"/><name val="${FONT}"/><family val="3"/></font><font><sz val="9"/><color rgb="FF64748B"/><name val="${FONT}"/><family val="3"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD5DDE7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF08A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF94A3B8"/></left><right style="thin"><color rgb="FF94A3B8"/></right><top style="thin"><color rgb="FF94A3B8"/></top><bottom style="thin"><color rgb="FF94A3B8"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    ),
    'docProps/app.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PECVD Process Log 분석 Tool</Application></Properties>`,
    ),
    'docProps/core.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(spec.title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${GRAPH}" sheetId="1" r:id="rId1"/><sheet name="${DATA}" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(graph, { cols: [26, 13, 9, 7, 2], drawing: true })),
    'xl/worksheets/_rels/sheet1.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    ),
    'xl/worksheets/sheet2.xml': strToU8(sheetXml(data, { cols: dataCols, freezeRow1: true })),
    'xl/drawings/drawing1.xml': strToU8(drawing),
    'xl/drawings/_rels/drawing1.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/chart" Target="../charts/chart1.xml"/></Relationships>`,
    ),
    'xl/charts/chart1.xml': strToU8(chart),
  };
  return zipSync(files, { level: 6 });
}

/** 파일로 저장 (링크 페이지 안이면 저장 확인 창) */
export function downloadChartXlsx(spec: XChartSpec): Promise<SaveOutcome> {
  const bytes = buildChartXlsx(spec);
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return saveFile(blob, spec.fileName);
}

// ───────── 축 범위 보조: 보기 좋은 최소·최대·간격 ─────────
export const niceAxis = (lo: number, hi: number, count = 6): { min: number; max: number; major: number } => {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, major: 0.2 };
  if (hi - lo < 1e-9) {
    hi = lo + 1;
  }
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  return { min: Math.floor(lo / step + 1e-9) * step, max: Math.ceil(hi / step - 1e-9) * step, major: step };
};
/** 눈금 숫자 형식: 간격에 맞춘 소수 자리 + 천 단위 콤마 */
export const axisFormat = (step: number, decimals?: number | null) => {
  const d = decimals ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
  return d > 0 ? `#,##0.${'0'.repeat(d)}` : '#,##0';
};
