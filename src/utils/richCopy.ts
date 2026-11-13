/**
 * 엑셀용 서식 복사
 * - 화면의 표(<table>)를 읽어 배경색 · 글자색 · 굵기 · 크기 · 테두리 · 병합 칸 · 열 너비 · 숫자 형식을
 *   엑셀이 읽는 HTML로 만들어 클립보드에 'text/html'로 넣음 (값만 필요한 곳을 위해 'text/plain'도 함께)
 * - 표가 여러 개면 화면 위치대로 배치 (옆에 있는 표는 옆 칸, 아래 표는 한 줄 띄우고 아래)
 * - 그래프는 화면 그대로 PNG 이미지로 복사 (copyElementImage)
 */
import { toBlob } from 'html-to-image';

// ───────── 색: 어떤 CSS 색(oklch 등)이든 흰 바탕 위의 #rrggbb로 ─────────
let colorCtx: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, string | null>();
const isTransparent = (c: string) => !c || c === 'transparent' || /^rgba\((\s*\d+\s*,){3}\s*0\s*\)$/.test(c.replace(/\s/g, '')) || /\/\s*0\s*\)$/.test(c);
/** 흰 바탕 위에 칠한 결과 색 (투명이면 null) */
export function toHex(c: string): string | null {
  if (isTransparent(c)) return null;
  if (colorCache.has(c)) return colorCache.get(c)!;
  let out: string | null = null;
  try {
    if (!colorCtx) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      colorCtx = cv.getContext('2d', { willReadFrequently: true });
    }
    if (colorCtx) {
      colorCtx.fillStyle = '#ffffff';
      colorCtx.fillRect(0, 0, 1, 1);
      colorCtx.fillStyle = c;
      colorCtx.fillRect(0, 0, 1, 1);
      const [r, g, b] = colorCtx.getImageData(0, 0, 1, 1).data;
      out = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    }
  } catch {
    out = null;
  }
  colorCache.set(c, out);
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pt = (px: number) => `${Math.round(px * 0.75 * 10) / 10}pt`;
const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** 셀 배경: 자기 → 줄 → 표 → 카드 순서로 처음 칠해진 색 */
const bgOf = (el: Element | null, stop: Element): string | null => {
  let cur: Element | null = el;
  while (cur) {
    const c = toHex(getComputedStyle(cur).backgroundColor);
    if (c) return c;
    if (cur === stop) break;
    cur = cur.parentElement;
  }
  return null;
};

interface Seg {
  text: string;
  color: string;
  bold: boolean;
  size: number;
  top: number;
  left: number;
  right: number;
}

/** 밝은 색(흰색 계열)인지 */
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
};

/** 셀 안 글자 조각 (화면 줄 단위로 줄바꿈, 색·굵기·크기 유지) */
const segmentsOf = (cell: HTMLElement): Seg[] => {
  const segs: Seg[] = [];
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.nodeValue || '').replace(/[\s ]+/g, ' ');
    if (!t.trim()) continue;
    const pe = n.parentElement;
    if (!pe || !visible(pe) || pe.closest('svg,[data-copy-ignore]')) continue;
    range.selectNodeContents(n);
    const rc = range.getBoundingClientRect();
    if (rc.width === 0 && rc.height === 0) continue;
    const cs = getComputedStyle(pe);
    // 색 배지 위의 흰 글자(A·B 표시 등): 엑셀 칸에는 배지 배경이 없으므로 배지 색을 글자색으로
    let color = toHex(cs.color) || '#000000';
    const ownBg = pe !== cell ? toHex(cs.backgroundColor) : null;
    if (ownBg && isLight(color) && !isLight(ownBg)) color = ownBg;
    segs.push({
      text: t.trim(),
      color,
      bold: Number(cs.fontWeight) >= 600,
      size: parseFloat(cs.fontSize) || 11,
      top: rc.top,
      left: rc.left,
      right: rc.right,
    });
  }
  return segs;
};

/** 숫자 형식: 화면 글자 그대로 보이게 (콤마 · 소수 자리 · +부호 · %) */
const numberFormat = (raw: string): { value: string; fmt: string } | null => {
  const s = raw.replace(/−/g, '-').trim();
  const m = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(%?)$/.exec(s);
  if (!m) return null;
  const [, sign, int, dec = '', pct] = m;
  if (int.length > 1 && int.startsWith('0') && !int.includes(',')) return null; // 0012 같은 코드는 글자로
  const base = `${int.includes(',') ? '#,##0' : '0'}${dec ? `.${'0'.repeat(dec.length)}` : ''}${pct ? '%' : ''}`;
  let num = Number(`${sign === '-' ? '-' : ''}${int.replace(/,/g, '')}.${dec || '0'}`);
  if (pct) num /= 100;
  const fmt = sign === '+' ? `+${base}\\;-${base}\\;+${base}` : base;
  return { value: String(num), fmt };
};

interface GridCell {
  html: string;
  colSpan: number;
  rowSpan: number;
}
interface TableGrid {
  rows: (GridCell | 'covered' | null)[][];
  colW: number[];
  rowH: number[];
  rect: DOMRect;
}

/** 표 하나 → 칸 배열 (병합 칸 풀어서 위치 계산) */
function tableToGrid(table: HTMLTableElement, scope: Element): TableGrid {
  const trs = Array.from(table.rows).filter(tr => visible(tr) && !tr.closest('[data-copy-skip]'));
  const rows: (GridCell | 'covered' | null)[][] = trs.map(() => []);
  const colW: number[] = [];
  const rowH: number[] = [];
  trs.forEach((tr, ri) => {
    rowH[ri] = tr.getBoundingClientRect().height;
    let ci = 0;
    Array.from(tr.cells).forEach(cell => {
      if (!visible(cell)) return;
      while (rows[ri][ci] !== undefined) ci++;
      const cs = Math.max(1, cell.colSpan || 1);
      const rs = Math.max(1, Math.min(cell.rowSpan || 1, trs.length - ri));
      const rect = cell.getBoundingClientRect();
      if (cs === 1) colW[ci] = Math.max(colW[ci] ?? 0, rect.width);
      rows[ri][ci] = { html: cellHtml(cell, scope), colSpan: cs, rowSpan: rs };
      for (let dr = 0; dr < rs; dr++)
        for (let dc = 0; dc < cs; dc++) if (dr || dc) (rows[ri + dr] ??= [])[ci + dc] = 'covered';
      ci += cs;
    });
  });
  const nCols = Math.max(0, ...rows.map(r => r.length));
  rows.forEach(r => {
    for (let c = 0; c < nCols; c++) if (r[c] === undefined) r[c] = null;
  });
  for (let c = 0; c < nCols; c++) if (!colW[c]) colW[c] = 60;
  return { rows, colW, rowH, rect: table.getBoundingClientRect() };
}

/** 셀 하나 → <td ...>내용</td> 의 속성·내용 부분 */
function cellHtml(cell: HTMLTableCellElement, scope: Element): string {
  const cs = getComputedStyle(cell);
  const segs = segmentsOf(cell);
  const fullText = segs.map(s => s.text).join(' ').trim();
  // 배지(배경 있는 작은 상자)만 들어 있는 칸은 배지 색을 칸 색으로
  let bg = toHex(cs.backgroundColor);
  let badgeColor: string | null = null;
  if (fullText) {
    for (const el of Array.from(cell.querySelectorAll<HTMLElement>('*'))) {
      const b = toHex(getComputedStyle(el).backgroundColor);
      if (b && visible(el) && el.innerText.replace(/\s+/g, ' ').trim() === fullText) {
        bg = b;
        badgeColor = toHex(getComputedStyle(el).color);
        break;
      }
    }
  }
  if (!bg) bg = bgOf(cell.parentElement, scope) || '#FFFFFF';
  const base = segs[0];
  const st: string[] = [
    `background:${bg}`,
    `color:${badgeColor || base?.color || toHex(cs.color) || '#000000'}`,
    `font-size:${pt(base?.size ?? (parseFloat(cs.fontSize) || 11))}`,
    `font-weight:${base?.bold || Number(cs.fontWeight) >= 600 ? 700 : 400}`,
    `font-family:"Malgun Gothic","맑은 고딕",sans-serif`,
    `text-align:${/center/.test(cs.textAlign) ? 'center' : /right|end/.test(cs.textAlign) ? 'right' : 'left'}`,
    `vertical-align:${cs.verticalAlign === 'top' ? 'top' : cs.verticalAlign === 'bottom' ? 'bottom' : 'middle'}`,
  ];
  (['top', 'right', 'bottom', 'left'] as const).forEach(side => {
    const w = parseFloat(cs.getPropertyValue(`border-${side}-width`)) || 0;
    const style = cs.getPropertyValue(`border-${side}-style`);
    const col = toHex(cs.getPropertyValue(`border-${side}-color`));
    st.push(w > 0 && style !== 'none' && col ? `border-${side}:${w >= 2.5 ? '2.0pt' : w >= 1.5 ? '1.5pt' : '.5pt'} solid ${col}` : `border-${side}:none`);
  });
  // 줄 나누기: 화면에서 다른 줄에 있는 글자 → 셀 안 줄바꿈
  const lines: Seg[][] = [];
  segs.forEach(s => {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].top - s.top) < s.size * 0.6) last.push(s);
    else lines.push([s]);
  });
  let inner: string;
  const num = lines.length === 1 ? numberFormat(fullText) : null;
  if (num) {
    st.push(`mso-number-format:"${num.fmt}"`);
    inner = num.value;
  } else {
    st.push(`mso-number-format:"\\@"`);
    const same = (s: Seg) => base && s.color === base.color && s.bold === base.bold && Math.abs(s.size - base.size) < 0.5;
    inner = lines
      .map(line =>
        line
          .map((s, i) => {
            const gap = i > 0 && s.left - line[i - 1].right > 1 ? ' ' : i > 0 ? '' : '';
            const t = esc(s.text);
            return gap + (same(s) || badgeColor ? t : `<span style='color:${s.color};font-weight:${s.bold ? 700 : 400};font-size:${pt(s.size)}'>${t}</span>`);
          })
          .join(''),
      )
      .join(`<br style='mso-data-placement:same-cell'>`);
    st.push(lines.length > 1 ? 'white-space:normal' : 'white-space:nowrap');
  }
  return `style='${st.join(';')}'>${inner}`;
}

/** 범위 안의 표들(다른 표 안에 든 표 제외) → 엑셀용 HTML. 표가 없으면 null */
export function tablesToExcelHtml(scope: Element): string | null {
  const tables = Array.from(scope.querySelectorAll('table')).filter(
    t => visible(t) && !t.parentElement?.closest('table') && !t.closest('[data-copy-skip]'),
  );
  if (tables.length === 0) return null;
  const grids = tables.map(t => tableToGrid(t, scope)).filter(g => g.rows.length > 0);
  if (grids.length === 0) return null;
  // 화면 위치대로 배치: 왼쪽 위치가 같은 표끼리 한 단(column), 단 안에서는 위에서 아래로
  const colsX: { x: number; grids: TableGrid[] }[] = [];
  [...grids]
    .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top)
    .forEach(g => {
      const col = colsX.find(c => Math.abs(c.x - g.rect.left) < 20);
      if (col) col.grids.push(g);
      else colsX.push({ x: g.rect.left, grids: [g] });
    });
  colsX.forEach(c => c.grids.sort((a, b) => a.rect.top - b.rect.top));
  // 큰 칸 배열에 붙이기 (단 사이 빈 열 1개, 표 사이 빈 줄 1개)
  const big: (GridCell | 'covered' | null)[][] = [];
  const bigW: number[] = [];
  const bigH: number[] = [];
  let c0 = 0;
  colsX.forEach((col, k) => {
    if (k > 0) {
      bigW[c0] = 20;
      c0++;
    }
    let r0 = 0;
    const width = Math.max(...col.grids.map(g => g.colW.length));
    col.grids.forEach((g, gi) => {
      if (gi > 0) r0++;
      g.rows.forEach((row, ri) => {
        const R = r0 + ri;
        big[R] ??= [];
        bigH[R] = Math.max(bigH[R] ?? 0, g.rowH[ri] ?? 20);
        row.forEach((cell, ci) => (big[R][c0 + ci] = cell));
      });
      g.colW.forEach((w, ci) => (bigW[c0 + ci] = Math.max(bigW[c0 + ci] ?? 0, w)));
      r0 += g.rows.length;
    });
    c0 += width;
  });
  const nCols = c0;
  const out: string[] = [];
  out.push(
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>`,
    `<table border=0 cellpadding=0 cellspacing=0 style='border-collapse:collapse;table-layout:fixed'>`,
  );
  for (let c = 0; c < nCols; c++) {
    const w = Math.round(bigW[c] ?? 20);
    out.push(`<col width=${w} style='width:${pt(w)}'>`);
  }
  for (let r = 0; r < big.length; r++) {
    const row = big[r] ?? [];
    out.push(`<tr height=${Math.round(bigH[r] ?? 20)} style='height:${pt(bigH[r] ?? 20)}'>`);
    for (let c = 0; c < nCols; c++) {
      const cell = row[c];
      if (cell === 'covered') continue;
      if (!cell) {
        out.push(`<td style='background:#FFFFFF;border:none'></td>`);
        continue;
      }
      out.push(`<td${cell.colSpan > 1 ? ` colspan=${cell.colSpan}` : ''}${cell.rowSpan > 1 ? ` rowspan=${cell.rowSpan}` : ''} ${cell.html}</td>`);
    }
    out.push('</tr>');
  }
  out.push('</table></body></html>');
  return out.join('');
}

// ───────── 누른 버튼이 속한 카드 찾기 ─────────
let lastPointer: { el: Element; t: number } | null = null;
if (typeof document !== 'undefined') {
  const remember = (e: Event) => {
    if (e.target instanceof Element) lastPointer = { el: e.target, t: Date.now() };
  };
  document.addEventListener('pointerdown', remember, true);
  document.addEventListener('keydown', () => {
    if (document.activeElement) lastPointer = { el: document.activeElement, t: Date.now() };
  }, true);
}
/** 방금 누른 버튼의 카드(복사 범위) */
export function scopeOfLastClick(): Element | null {
  if (!lastPointer || Date.now() - lastPointer.t > 3000) return null;
  return lastPointer.el.closest('[data-copy-scope], [data-range-stats], [data-multi-chart], section');
}

/**
 * 클립보드에 글자(값) + 서식 표(HTML) 함께 넣기
 * @param scope 표를 찾을 범위 (없으면 방금 누른 버튼의 카드)
 */
export async function copyTextAndTables(text: string, scope?: Element | null): Promise<boolean> {
  let html: string | null = null;
  try {
    const sc = scope === undefined ? scopeOfLastClick() : scope;
    if (sc && !sc.closest('[data-copy-plain]')) html = tablesToExcelHtml(sc);
  } catch (err) {
    console.warn('서식 표 만들기 실패 — 값만 복사', err);
    html = null;
  }
  // 1) copy 이벤트로 넣기 (오프라인 파일에서도 동작)
  let done = false;
  const onCopy = (e: ClipboardEvent) => {
    if (!e.clipboardData) return;
    e.clipboardData.setData('text/plain', text);
    if (html) e.clipboardData.setData('text/html', html);
    e.preventDefault();
    done = true;
  };
  document.addEventListener('copy', onCopy, true);
  try {
    document.execCommand('copy');
  } catch {
    /* 지원 안 함 */
  }
  document.removeEventListener('copy', onCopy, true);
  if (done) return true;
  // 2) 클립보드 API
  try {
    if (html && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * 화면 요소를 그대로 PNG 이미지로 클립보드에 복사 (엑셀·PPT에 붙여 넣기)
 * - 클립보드를 쓸 수 없으면 PNG 파일로 저장
 * @returns 'copied' | 'saved' | 'failed'
 */
/** 이미지에 넣을 글꼴: 파일에 내장된 글꼴(data URI)만 — 인터넷 글꼴을 받으러 가지 않음 (오프라인에서도 빠르게) */
let fontCssCache: string | null = null;
const embeddedFontCss = (): string => {
  if (fontCssCache !== null) return fontCssCache;
  const parts: string[] = [];
  Array.from(document.styleSheets).forEach(sh => {
    let rules: CSSRuleList;
    try {
      rules = sh.cssRules;
    } catch {
      return; // 다른 주소의 스타일(인터넷 글꼴)은 건너뜀
    }
    Array.from(rules).forEach(r => {
      if (r instanceof CSSFontFaceRule && /url\(\s*["']?data:/.test(r.cssText)) parts.push(r.cssText);
    });
  });
  fontCssCache = parts.join('\n');
  return fontCssCache;
};

/**
 * 선택 상자(<select>)는 이미지로 옮길 때 오류가 나므로, 이미지를 만드는 동안만
 * 같은 모양의 글자 상자(선택된 항목 이름)로 잠시 바꿔 둠 → 끝나면 되돌리기
 */
const swapSelects = (el: HTMLElement): (() => void) => {
  const undo: (() => void)[] = [];
  el.querySelectorAll('select').forEach(sel => {
    if (!visible(sel)) return;
    const cs = getComputedStyle(sel);
    const span = document.createElement('span');
    span.textContent = sel.selectedOptions[0]?.textContent ?? '';
    span.style.cssText = `display:inline-flex;align-items:center;box-sizing:border-box;width:${sel.offsetWidth}px;height:${sel.offsetHeight}px;padding:${cs.padding};font:${cs.font};color:${cs.color};background:${cs.backgroundColor};border:${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor};border-radius:${cs.borderRadius};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    const prevDisplay = sel.style.display;
    sel.after(span);
    sel.style.display = 'none';
    undo.push(() => {
      span.remove();
      sel.style.display = prevDisplay;
    });
  });
  return () => undo.forEach(f => f());
};

export async function copyElementImage(el: HTMLElement, fileName = 'graph.png'): Promise<'copied' | 'saved' | 'failed'> {
  const make = () => {
    const restore = swapSelects(el);
    return toBlob(el, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      fontEmbedCSS: embeddedFontCss(),
      // 버튼 자신 · 선택 상자(옆에 둔 글자 상자로 대신 보임)는 이미지에서 뺌
      filter: n => !(n instanceof HTMLElement && (n.dataset.copyIgnore !== undefined || n.tagName === 'SELECT')),
    })
      .then(b => {
        if (!b) throw new Error('이미지 만들기 실패');
        return b;
      })
      .finally(restore);
  };
  const blobP = make();
  try {
    if (typeof ClipboardItem === 'undefined') throw new Error('no ClipboardItem');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
    return 'copied';
  } catch (err) {
    console.warn('그래프 이미지 클립보드 복사 실패 → PNG 저장 시도', err);
    try {
      const b = await blobP;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return 'saved';
    } catch (err2) {
      console.warn('그래프 이미지 만들기 실패', err2);
      return 'failed';
    }
  }
}
