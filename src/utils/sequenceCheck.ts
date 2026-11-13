/**
 * Recipe Sequence 판정: BB Mode · Specific Gas 정상 적용 여부
 *
 * - Log의 Step별 설정(RF BB.mode / Specific Gas 열)을 읽고, 경계마다 기대 순서를 정함
 * - Log에서 실제 동작(SiH4 Off, RF RSD Down, RF Off, 압력 제어 Off, Gas Off, 동시 Set 등)의 시점을 찾음
 * - 기대 순서와 비교해 정상 / 확인 필요 / 미적용 + 이유
 *
 * 기준 (평가 시트 6차 4가지 Case + 5차 정상 공정 Rex)
 *  · Specific Gas 켜짐: Step 끝에서 SiH4 Off와 RF Power Down(RSD)이 함께 (정상 Rex 0.2초 차 → 0.35초까지 '함께')
 *  · BB Mode 켜짐(다음 Step): RF가 꺼지지 않고 경계를 넘고, 다음 Step 시작에서 Gas·압력·Power가 동시에 Set
 *  · BB Mode 꺼짐: 경계 전에 RF Off, 압력 제어는 유지, 다음 Step에서도 쓰는 Gas는 유지 · 안 쓰는 Gas는 Off
 *  · 공정 끝: RF Off → 압력 제어 Off → Gas Off (같은 행은 정상 — 정상 Case C2·C3도 같은 행으로 기록됨)
 */
import { ParsedLogFile, RawLogRow } from '../types/pecvd';

export type Verdict = 'ok' | 'warn' | 'fail' | 'na';
export const VERDICT_RANK: Record<Verdict, number> = { na: 0, ok: 1, warn: 2, fail: 3 };
export const worst = (...vs: Verdict[]): Verdict => vs.reduce<Verdict>((a, v) => (VERDICT_RANK[v] > VERDICT_RANK[a] ? v : a), 'na');

export type CheckKind = 'sequence' | 'bb' | 'sg' | 'rsd';

export interface CheckItem {
  kind: CheckKind;
  verdict: Verdict;
  /** 한 줄 설명 */
  text: string;
}

export interface SeqEvent {
  label: string;
  /** 경계(다음 Step 첫 행) 기준 초, 없으면 null */
  t: number | null;
}

export interface BoundaryCheck {
  title: string;
  /** 예: 'BB 꺼짐 · Specific Gas 켜짐' */
  setting: string;
  expected: string[];
  events: SeqEvent[];
  items: CheckItem[];
  verdict: Verdict;
}

export interface StepSetting {
  step: number;
  name: string;
  bb: boolean | null;
  sg: boolean | null;
}

export interface SequenceReport {
  fileId: string;
  settings: StepSetting[];
  hasBbCol: boolean;
  hasSgCol: boolean;
  boundaries: BoundaryCheck[];
  summary: Record<CheckKind, Verdict>;
}

/** 동시로 보는 시간 (같은 행 ~ 바로 다음 행) */
export const SAME_ROW_SEC = 0.15;
/** SiH4 Off ↔ RF Down '함께' 허용 (정상 Rex 0.2초) */
const SG_PAIR_OK = 0.35;
const SG_PAIR_WARN = 1.0;
/** 다음 Step 시작 '동시 Set' 허용 폭 */
const SET_SPAN_OK = 0.35;
const SET_SPAN_WARN = 0.7;

interface GasDef {
  id: string;
  name: string;
  set: (r: RawLogRow) => number;
  act: (r: RawLogRow) => number;
}
const GASES: GasDef[] = [
  { id: 'SiH4', name: 'SiH4', set: r => r.pyroSiH4Set, act: r => r.pyroSiH4 },
  { id: 'N2O', name: 'N2O', set: r => r.pyroN2OSet, act: r => r.pyroN2O },
  { id: 'NH3', name: 'NH3', set: r => r.pyroNH3Set, act: r => r.pyroNH3 },
  { id: 'PN2', name: 'PN2', set: r => r.pyroPN2Set, act: r => r.pyroPN2 },
  { id: 'Ar', name: 'Ar', set: r => r.pyroArSet, act: r => r.pyroAr },
  { id: 'H2', name: 'H2', set: r => r.pyroH2Set, act: r => r.pyroH2 },
  { id: 'NF3', name: 'NF3', set: r => r.oxyNF3Set, act: r => r.oxyNF3 },
  { id: 'OxyAr', name: 'Oxy.Ar', set: r => r.oxyArSet, act: r => r.oxyAr },
];
const num = (v: number | undefined | null) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const fmtT = (t: number | null) => (t === null ? '-' : `${t >= 0 ? '+' : '−'}${Math.abs(t).toFixed(1)}s`);
const fmtGap = (a: number, b: number) => `${Math.abs(a - b).toFixed(1)}초`;

/** Step의 대표 설정값 (가장 많이 나온 값) */
const dominantFlag = (rows: RawLogRow[], get: (r: RawLogRow) => boolean | null | undefined): boolean | null => {
  let t = 0;
  let f = 0;
  rows.forEach(r => {
    const v = get(r);
    if (v === true) t++;
    else if (v === false) f++;
  });
  if (t === 0 && f === 0) return null;
  return t > f;
};

export function checkSequence(file: ParsedLogFile, depoStepsIn: number[]): SequenceReport {
  const rows = file.rows;
  const steps = Array.from(new Set(rows.map(r => r.step))).sort((a, b) => a - b);
  const rowsOf = (s: number) => rows.filter(r => r.step === s);
  const hasBbCol = rows.some(r => r.bbMode !== null && r.bbMode !== undefined);
  const hasSgCol = rows.some(r => r.specificGasAdj !== null && r.specificGasAdj !== undefined);
  const settings: StepSetting[] = steps.map(s => {
    const rs = rowsOf(s);
    const names = new Map<string, number>();
    rs.forEach(r => names.set(r.stepName, (names.get(r.stepName) ?? 0) + 1));
    const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    return { step: s, name, bb: dominantFlag(rs, r => r.bbMode), sg: dominantFlag(rs, r => r.specificGasAdj) };
  });
  const setOf = (s: number) => settings.find(x => x.step === s);
  const depoSteps = Array.from(new Set(depoStepsIn)).sort((a, b) => a - b);

  // ---- 공통 판정 도우미 ----
  const hasFlag = rows.some(r => /^(on|off|1|0|true|false)$/i.test((r.rfOn ?? '').trim()));
  const rfIsOn = (r: RawLogRow) => (hasFlag ? /^(on|1|true)$/i.test((r.rfOn ?? '').trim()) : num(r.rfForwardPowerAct) >= 50);
  const textMode = rows.some(r => /[a-z]/i.test(r.tvCtrlMode ?? ''));
  const isPressCtrl = (r: RawLogRow) =>
    num(r.tvPressureSet) > 0 && (!textMode || /press/i.test(r.tvCtrlMode ?? ''));
  // 시간: 경과 시간(elapsedSec) 기준 — 일부 Log는 시각이 '분:초'만 있어 timestamp를 못 읽음
  const tSec = (r: RawLogRow, ref: RawLogRow) => Math.round((num(r.elapsedSec) - num(ref.elapsedSec)) * 100) / 100;
  const firstIdx = (s: number) => rows.findIndex(r => r.step === s);
  const lastIdx = (s: number) => {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].step === s) return i;
    return -1;
  };
  const usedIn = (s: number) => GASES.filter(g => rowsOf(s).some(r => num(g.set(r)) > 0));
  /** i0~i1 사이에서 조건이 처음 참이 되는 행 */
  const findFrom = (i0: number, i1: number, cond: (r: RawLogRow, i: number) => boolean) => {
    for (let i = Math.max(0, i0); i <= Math.min(rows.length - 1, i1); i++) if (cond(rows[i], i)) return i;
    return -1;
  };
  /** 기준 행에서 앞뒤 sec초 안의 행 범위 */
  const span = (ref: number, back: number, fwd: number) => {
    let a = ref;
    let b = ref;
    while (a > 0 && num(rows[ref].elapsedSec) - num(rows[a - 1].elapsedSec) <= back) a--;
    while (b < rows.length - 1 && num(rows[b + 1].elapsedSec) - num(rows[ref].elapsedSec) <= fwd) b++;
    return [a, b] as const;
  };

  /** Depo Step 끝부분 동작: RSD Down, SiH4 Off, RF Off (경계 행 기준 시간) */
  const endActions = (d: number, bIdx: number) => {
    const d0 = firstIdx(d);
    const d1 = lastIdx(d);
    const ref = rows[bIdx];
    // RF Off: Depo 안에서 마지막으로 켜져 있던 행 다음 (경계 뒤 2초까지)
    const [, searchEnd] = span(bIdx, 0, 3);
    let lastOn = -1;
    for (let i = d0; i <= searchEnd; i++) {
      if (rfIsOn(rows[i])) lastOn = i;
      else if (lastOn >= 0 && i > d1) break;
    }
    const rfOffIdx = lastOn >= 0 && lastOn + 1 <= searchEnd && !rfIsOn(rows[lastOn + 1]) ? lastOn + 1 : -1;
    const rfOffT = rfOffIdx >= 0 ? tSec(rows[rfOffIdx], ref) : null;
    // 본 공정 RF Set (Depo에서 가장 많이 나온 값)
    const cnt = new Map<number, number>();
    rowsOf(d).forEach(r => {
      const v = num(r.rfForwardSetValue);
      if (v > 0) cnt.set(v, (cnt.get(v) ?? 0) + 1);
    });
    const mainSet = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    // RSD Down: Depo 끝쪽에서 RF Set이 본 공정 값보다 낮은 양수로 바뀐 행 (RF가 켜져 있을 때)
    let rsdIdx = -1;
    for (let i = d0 + 1; i <= Math.min(d1, rfOffIdx >= 0 ? rfOffIdx : d1); i++) {
      const v = num(rows[i].rfForwardSetValue);
      const pv = num(rows[i - 1].rfForwardSetValue);
      if (v > 0 && v < mainSet * 0.9 && pv >= mainSet * 0.9 && rfIsOn(rows[i])) rsdIdx = i;
    }
    const rsdT = rsdIdx >= 0 ? tSec(rows[rsdIdx], ref) : null;
    const rsdLevel = rsdIdx >= 0 ? num(rows[rsdIdx].rfForwardSetValue) : null;
    // SiH4 Off: Depo 안에서 Set이 0으로 바뀐 행 (경계 뒤 1초까지)
    const [, gEnd] = span(bIdx, 0, 1);
    const sihIdx = findFrom(d0 + 1, gEnd, (r, i) => num(r.pyroSiH4Set) <= 0 && num(rows[i - 1].pyroSiH4Set) > 0);
    const sihT = sihIdx >= 0 ? tSec(rows[sihIdx], ref) : null;
    return { rfOffIdx, rfOffT, rsdIdx, rsdT, rsdLevel, sihIdx, sihT, mainSet };
  };

  /** Specific Gas 판정 (Step 끝) */
  const sgItems = (d: number, sg: boolean | null, a: ReturnType<typeof endActions>, out: CheckItem[]) => {
    const hasSih = rowsOf(d).some(r => num(r.pyroSiH4Set) > 0);
    if (!hasSih) return;
    if (sg === true) {
      if (a.sihT === null || (a.rfOffT !== null && a.sihT > a.rfOffT + SAME_ROW_SEC)) {
        out.push({ kind: 'sg', verdict: 'fail', text: 'SiH4가 RF Off 전에 꺼지지 않았습니다 (Specific Gas 동작 없음)' });
      } else if (a.rsdT === null) {
        out.push({ kind: 'sg', verdict: 'fail', text: `SiH4는 ${fmtT(a.sihT)}에 꺼졌지만 RF가 RSD로 낮아지지 않았습니다` });
      } else {
        const gap = Math.abs(a.sihT - a.rsdT);
        const v: Verdict = gap <= SG_PAIR_OK ? 'ok' : gap <= SG_PAIR_WARN ? 'warn' : 'fail';
        out.push({
          kind: 'sg',
          verdict: v,
          text: v === 'ok' ? `SiH4 Off와 RF RSD Down이 함께 (${fmtGap(a.sihT, a.rsdT)} 차)` : `SiH4 Off(${fmtT(a.sihT)})와 RF RSD Down(${fmtT(a.rsdT)})이 ${fmtGap(a.sihT, a.rsdT)} 떨어져 있습니다`,
        });
        // RSD 유지
        if (a.rfOffT !== null) {
          const hold = a.rfOffT - a.rsdT;
          out.push({
            kind: 'rsd',
            verdict: hold >= 0.5 ? 'ok' : 'warn',
            text: `RSD ${a.rsdLevel?.toLocaleString()} W 유지 ${hold.toFixed(1)}초 후 RF Off`,
          });
        }
      }
    } else if (sg === false) {
      if (a.sihT !== null && a.rfOffT !== null && a.sihT < a.rfOffT - SAME_ROW_SEC) {
        out.push({ kind: 'sg', verdict: 'warn', text: `Specific Gas 꺼짐인데 SiH4가 RF Off보다 먼저(${fmtT(a.sihT)}) 꺼졌습니다` });
      } else {
        out.push({ kind: 'sg', verdict: 'ok', text: 'Specific Gas 꺼짐: SiH4가 RF Off 전까지 유지' });
      }
    } else {
      // 설정 열 없음: 실제 동작만 알려 줌
      const acted = a.sihT !== null && a.rsdT !== null && Math.abs(a.sihT - a.rsdT) <= SG_PAIR_WARN && (a.rfOffT === null || a.sihT <= a.rfOffT + SAME_ROW_SEC);
      out.push({
        kind: 'sg',
        verdict: 'warn',
        text: acted
          ? 'Log에 Specific Gas 설정 열이 없습니다 (SiH4 Off · RF RSD Down 동작은 확인됨)'
          : 'Log에 Specific Gas 설정 열이 없습니다 · SiH4 Off / RF RSD Down 동작이 보이지 않습니다',
      });
    }
  };

  const boundaries: BoundaryCheck[] = [];
  const settingText = (bb: boolean | null, sg: boolean | null) =>
    `BB ${bb === null ? '?' : bb ? '켜짐' : '꺼짐'} · Specific Gas ${sg === null ? '?' : sg ? '켜짐' : '꺼짐'}`;

  // ---------------- 1) 공정 시작: Gas On → 압력 제어 On → RF On ----------------
  if (depoSteps.length > 0) {
    const d = depoSteps[0];
    const d0 = firstIdx(d);
    const rfSteps = steps.filter(s => s < d && rowsOf(s).filter(r => num(r.rfForwardPowerAct) >= 50).length >= 10);
    const from = rfSteps.length ? lastIdx(rfSteps[rfSteps.length - 1]) + 1 : 0;
    const gases = usedIn(d);
    const rfOnIdxOf = (i0: number) => findFrom(i0, lastIdx(d), rfIsOn);
    const gasOnIdx = findFrom(from + 1, lastIdx(d), (r, i) => gases.some(g => num(g.set(r)) > 0 && num(g.set(rows[i - 1])) <= 0));
    // 압력 제어 On: 꺼져 있다가 켜지는 순간 (앞 Step에서 이어진 압력 제어는 제외), 없으면 처음 켜져 있는 행
    let pOnIdx = -1;
    for (let i = Math.max(1, from); i <= lastIdx(d); i++) if (isPressCtrl(rows[i]) && !isPressCtrl(rows[i - 1])) pOnIdx = i;
    if (pOnIdx > (rfOnIdxOf(d0) >= 0 ? rfOnIdxOf(d0) : lastIdx(d))) pOnIdx = -1;
    if (pOnIdx < 0) pOnIdx = findFrom(from, lastIdx(d), isPressCtrl);
    const rfOnIdx = rfOnIdxOf(d0);
    const ref = rows[d0];
    const ev: SeqEvent[] = [
      { label: 'Gas Flow On', t: gasOnIdx >= 0 ? tSec(rows[gasOnIdx], ref) : null },
      { label: '압력 제어 On', t: pOnIdx >= 0 ? tSec(rows[pOnIdx], ref) : null },
      { label: 'RF Power On', t: rfOnIdx >= 0 ? tSec(rows[rfOnIdx], ref) : null },
    ];
    const items: CheckItem[] = [];
    const [g, p, rf] = ev.map(e => e.t);
    if (g === null || p === null || rf === null) {
      items.push({ kind: 'sequence', verdict: 'warn', text: `시작 동작을 모두 찾지 못했습니다 (${ev.filter(e => e.t === null).map(e => e.label).join(', ')})` });
    } else if (g <= p + SAME_ROW_SEC && p <= rf + SAME_ROW_SEC) {
      items.push({ kind: 'sequence', verdict: 'ok', text: `Gas On → 압력 제어 On → RF On 순서 정상` });
    } else {
      const bad = g > p + SAME_ROW_SEC ? `Gas On(${fmtT(g)})이 압력 제어 On(${fmtT(p)})보다 늦습니다` : `압력 제어 On(${fmtT(p)})이 RF On(${fmtT(rf)})보다 늦습니다`;
      items.push({ kind: 'sequence', verdict: 'fail', text: bad });
    }
    const st = setOf(d);
    boundaries.push({
      title: `공정 시작 → Step ${d} ${st?.name ?? ''}`,
      setting: '시작 순서',
      expected: ['Gas Flow On', '압력 제어 On', 'RF Power On'],
      events: ev,
      items,
      verdict: worst(...items.map(i => i.verdict)),
    });
  }

  // ---------------- 2) Depo → 다음 Step (연속 Depo · 공정 끝) ----------------
  depoSteps.forEach((d, k) => {
    const nextStep = steps.find(s => s > d);
    if (nextStep === undefined) return;
    const bIdx = firstIdx(nextStep);
    const ref = rows[bIdx];
    const isDepoNext = depoSteps[k + 1] === nextStep;
    const sDepo = setOf(d);
    const sNext = setOf(nextStep);
    const sg = sDepo?.sg ?? null;
    const a = endActions(d, bIdx);
    const items: CheckItem[] = [];
    const events: SeqEvent[] = [];
    if (a.rsdT !== null) events.push({ label: `RF RSD Down (${a.rsdLevel?.toLocaleString()} W)`, t: a.rsdT });
    if (a.sihT !== null) events.push({ label: 'SiH4 Off', t: a.sihT });

    if (isDepoNext) {
      // ----- 연속 Depo 경계 (BB) -----
      const bb = sNext?.bb ?? null;
      const [w0, w1] = span(bIdx, 0.5, 0.6);
      const rfContinuous = rows.slice(w0, w1 + 1).every(rfIsOn);
      const pressHeld = rows.slice(w0, w1 + 1).every(r => num(r.tvPressureSet) > 0);
      sgItems(d, sg, a, items);
      if (bb === true) {
        items.push(
          rfContinuous
            ? { kind: 'bb', verdict: 'ok', text: 'BB Mode: RF가 꺼지지 않고 다음 Step으로 이어짐' }
            : { kind: 'bb', verdict: 'fail', text: `BB Mode 켜짐인데 경계에서 RF가 꺼졌습니다${a.rfOffT !== null ? ` (${fmtT(a.rfOffT)})` : ''}` },
        );
        items.push(
          pressHeld
            ? { kind: 'bb', verdict: 'ok', text: 'BB Mode: 압력 제어 유지' }
            : { kind: 'bb', verdict: 'fail', text: 'BB Mode 켜짐인데 경계에서 압력 제어가 풀렸습니다' },
        );
        // 다음 Step 시작 '동시 Set': RF Set · 압력 Set · 바뀌는 Gas Set의 첫 변경 시점
        const prev = rows[bIdx - 1];
        const changeT: number[] = [];
        const [, c1] = span(bIdx, 0, 1.5);
        const firstChange = (get: (r: RawLogRow) => number) => {
          const i = findFrom(bIdx, c1, r => Math.abs(num(get(r)) - num(get(prev))) > Math.max(1, Math.abs(num(get(prev))) * 0.01));
          return i >= 0 ? tSec(rows[i], ref) : null;
        };
        const tRf = firstChange(r => r.rfForwardSetValue);
        const tP = firstChange(r => r.tvPressureSet);
        [tRf, tP, ...GASES.map(g => firstChange(g.set))].forEach(t => t !== null && changeT.push(t));
        if (tRf !== null) events.push({ label: 'RF Set 변경', t: tRf });
        if (tP !== null) events.push({ label: '압력 Set 변경', t: tP });
        if (changeT.length >= 2) {
          const sp = Math.max(...changeT) - Math.min(...changeT);
          const v: Verdict = sp <= SET_SPAN_OK ? 'ok' : sp <= SET_SPAN_WARN ? 'warn' : 'fail';
          events.push({ label: 'Gas Set 변경(마지막)', t: Math.max(...changeT) });
          items.push({ kind: 'bb', verdict: v, text: v === 'ok' ? `다음 Step 시작에서 Gas·압력·Power가 동시에 Set (${sp.toFixed(1)}초 안)` : `다음 Step의 Set 변경이 ${sp.toFixed(1)}초에 걸쳐 나뉘어 있습니다` });
        }
      } else if (bb === false) {
        if (a.rfOffT !== null) events.push({ label: 'RF Off', t: a.rfOffT });
        items.push(
          !rfContinuous && a.rfOffT !== null && a.rfOffT <= SAME_ROW_SEC
            ? { kind: 'sequence', verdict: 'ok', text: `BB Mode 꺼짐: 경계 전에 RF Off (${fmtT(a.rfOffT)})` }
            : { kind: 'sequence', verdict: 'fail', text: 'BB Mode 꺼짐인데 RF가 경계를 넘어 켜져 있습니다' },
        );
        items.push(
          pressHeld
            ? { kind: 'sequence', verdict: 'ok', text: '압력 제어가 다음 Step까지 유지' }
            : { kind: 'sequence', verdict: 'warn', text: '경계에서 압력 제어가 풀렸습니다 (유지 기대)' },
        );
        // Gas: 다음 Step에서도 쓰면 유지, 안 쓰면 Off
        const nextUsed = new Set(usedIn(nextStep).map(g => g.id));
        const [, e1] = span(bIdx, 0, 1);
        const wrong: string[] = [];
        usedIn(d)
          .filter(g => g.id !== 'SiH4' || sg === false)
          .forEach(g => {
            const offIdx = findFrom(lastIdx(d) - 1, e1, (r, i) => num(g.set(r)) <= 0 && num(g.set(rows[i - 1])) > 0);
            if (nextUsed.has(g.id) && offIdx >= 0) wrong.push(`${g.name}(다음 Step에서도 쓰는데 꺼짐)`);
            if (!nextUsed.has(g.id) && offIdx < 0) wrong.push(`${g.name}(다음 Step에서 안 쓰는데 계속 흐름)`);
          });
        items.push(
          wrong.length === 0
            ? { kind: 'sequence', verdict: 'ok', text: '같은 Gas는 유지 · 안 쓰는 Gas는 Off' }
            : { kind: 'sequence', verdict: 'warn', text: `Gas 처리 확인: ${wrong.join(', ')}` },
        );
      } else {
        items.push({ kind: 'bb', verdict: 'warn', text: 'Log에 BB Mode 설정 열이 없어 판정할 수 없습니다' });
      }
      boundaries.push({
        title: `Step ${d} ${sDepo?.name ?? ''} → Step ${nextStep} ${sNext?.name ?? ''}`,
        setting: settingText(bb, sg),
        expected:
          bb === true
            ? sg
              ? ['SiH4 Off + RF RSD Down (다른 Gas·압력 유지)', 'RF 꺼지지 않고 다음 Step으로', 'Gas·압력·Power 동시 Set']
              : ['Gas·압력·Power 유지', 'RF 꺼지지 않고 다음 Step으로', 'Gas·압력·Power 동시 Set']
            : sg
              ? ['SiH4 Off + RF RSD Down', 'RF Off', '압력 유지', '같은 Gas 유지 · 다른 Gas Off']
              : ['RF Off', '압력 유지', '같은 Gas 유지 · 다른 Gas Off'],
        events: events.sort((x, y) => (x.t ?? 0) - (y.t ?? 0)),
        items,
        verdict: worst(...items.map(i => i.verdict)),
      });
    } else {
      // ----- 공정 끝: RF Off → 압력 제어 Off → Gas Off -----
      sgItems(d, sg, a, items);
      const [, e1] = span(bIdx, 0, 3);
      const d1 = lastIdx(d);
      const pOffIdx = findFrom(d1 - 30, e1, (r, i) => i > 0 && isPressCtrl(rows[i - 1]) && !isPressCtrl(r));
      const gasesD = usedIn(d).filter(g => g.id !== 'SiH4' || sg !== true);
      const gasOffIdx = findFrom(d1 - 30, e1, (r, i) => i > 0 && gasesD.some(g => num(g.set(rows[i - 1])) > 0 && num(g.set(r)) <= 0));
      const pOffT = pOffIdx >= 0 ? tSec(rows[pOffIdx], ref) : null;
      const gasOffT = gasOffIdx >= 0 ? tSec(rows[gasOffIdx], ref) : null;
      if (a.rfOffT !== null) events.push({ label: 'RF Off', t: a.rfOffT });
      if (pOffT !== null) events.push({ label: '압력 제어 Off', t: pOffT });
      if (gasOffT !== null) events.push({ label: 'Gas Off', t: gasOffT });
      if (a.rfOffT === null || pOffT === null || gasOffT === null) {
        items.push({ kind: 'sequence', verdict: 'warn', text: `끝 동작을 모두 찾지 못했습니다 (${[a.rfOffT === null && 'RF Off', pOffT === null && '압력 제어 Off', gasOffT === null && 'Gas Off'].filter(Boolean).join(', ')})` });
      } else if (pOffT < a.rfOffT - SAME_ROW_SEC) {
        items.push({ kind: 'sequence', verdict: 'fail', text: `압력 제어 Off(${fmtT(pOffT)})가 RF Off(${fmtT(a.rfOffT)})보다 먼저입니다` });
      } else if (gasOffT < pOffT - SAME_ROW_SEC) {
        items.push({ kind: 'sequence', verdict: 'fail', text: `Gas Off(${fmtT(gasOffT)})가 압력 제어 Off(${fmtT(pOffT)})보다 먼저입니다` });
      } else {
        items.push({
          kind: 'sequence',
          verdict: 'ok',
          text: `RF Off → 압력 제어 Off → Gas Off 순서 정상${Math.abs(gasOffT - pOffT) <= SAME_ROW_SEC ? ' (압력·Gas Off 같은 시점)' : ''}`,
        });
      }
      boundaries.push({
        title: `공정 끝: Step ${d} ${sDepo?.name ?? ''} → Step ${nextStep} ${sNext?.name ?? ''}`,
        setting: settingText(null, sg).replace('BB ? · ', ''),
        expected: sg ? ['SiH4 Off + RF RSD Down', 'RF Off', '압력 제어 Off', 'Gas Off'] : ['RF Off', '압력 제어 Off', 'Gas Off'],
        events: events.sort((x, y) => (x.t ?? 0) - (y.t ?? 0)),
        items,
        verdict: worst(...items.map(i => i.verdict)),
      });
    }
  });

  // ---------------- 3) Depo 뒤 BB Step (PL 등): RF가 이어지는지 ----------------
  const lastDepo = depoSteps[depoSteps.length - 1] ?? Infinity;
  steps
    .filter(s => s > lastDepo + 1 && setOf(s)?.bb === true)
    .forEach(s => {
      const prevStep = steps[steps.indexOf(s) - 1];
      const bIdx = firstIdx(s);
      const [w0, w1] = span(bIdx, 0.5, 0.6);
      const prevOn = rowsOf(prevStep).some(rfIsOn);
      if (!prevOn) return;
      const ok = rows.slice(w0, w1 + 1).every(rfIsOn);
      const item: CheckItem = ok
        ? { kind: 'bb', verdict: 'ok', text: 'BB Mode: RF가 꺼지지 않고 이어짐' }
        : { kind: 'bb', verdict: 'fail', text: 'BB Mode 켜짐인데 경계에서 RF가 꺼졌습니다' };
      boundaries.push({
        title: `Step ${prevStep} ${setOf(prevStep)?.name ?? ''} → Step ${s} ${setOf(s)?.name ?? ''}`,
        setting: 'BB 켜짐',
        expected: ['RF 꺼지지 않고 다음 Step으로'],
        events: [],
        items: [item],
        verdict: item.verdict,
      });
    });

  const all = boundaries.flatMap(b => b.items);
  const sumOf = (k: CheckKind) => worst(...all.filter(i => i.kind === k).map(i => i.verdict));
  return {
    fileId: file.id,
    settings,
    hasBbCol,
    hasSgCol,
    boundaries,
    summary: { sequence: sumOf('sequence'), bb: sumOf('bb'), sg: sumOf('sg'), rsd: sumOf('rsd') },
  };
}
