import type { HWCellStatus, HWControlEndRFRow, HWControlStartRow } from '../types/pecvd';

/**
 * H/W Control 칸 표시용 공통 헬퍼 (BB Mode / 연속 Depo 전환)
 * - 'keep'  → "유지" (이전/다음 Step으로 끊기지 않고 이어짐, 값 없음)
 * - 'trans' → "전환 x.x" (Set이 다음 Step 값으로 바뀐 시점, Act 도달 시간은 툴팁)
 */
export const hwStatusOf = (
  row: { cellStatus?: Partial<Record<string, HWCellStatus>> } | null | undefined,
  field: string
): HWCellStatus | undefined => row?.cellStatus?.[field];

export const fmtHwStatus = (status: HWCellStatus, val: number | null | undefined): string => {
  if (status === 'keep') return '유지';
  const ok = val !== null && val !== undefined && isFinite(val);
  return `전환 ${ok ? (val as number).toFixed(1) : '-'}`;
};

/** End 행이 BB 전환(0.0초 = Step 전환 시점)인지 */
export const isBbEndRow = (e: HWControlEndRFRow | null | undefined): boolean => e?.endRef === 'stepChange';

/** 행 이름 옆 배지 문구와 설명 (해당 없으면 null) */
export const hwBoundaryBadge = (
  s: HWControlStartRow | null | undefined,
  e: HWControlEndRFRow | null | undefined
): { label: string; title: string } | null => {
  const parts: string[] = [];
  let isBb = false;
  if (e?.bbEnd) {
    const bb = e.endRef === 'stepChange';
    isBb = isBb || bb;
    const sg = e.bbEnd.specificGas === null ? '' : ` · Specific Gas ${e.bbEnd.specificGas ? 'Enable' : 'Disable'}`;
    parts.push(
      bb
        ? `End: BB 전환으로 RF가 꺼지지 않고 Step ${e.bbEnd.otherStep}로 이어짐 → 0.0초 = Step 전환 시점${sg}`
        : `End: 다음 Step ${e.bbEnd.otherStep}(Depo)로 바로 이어짐 (RF Off 기준 유지)${sg}`
    );
  }
  if (s?.bbStart) {
    const bb = s.bbStart.rfContinuous;
    isBb = isBb || bb;
    parts.push(
      bb
        ? `Start: Step ${s.bbStart.otherStep}에서 BB 전환으로 이어져 들어옴`
        : `Start: 이전 Step ${s.bbStart.otherStep}(Depo)에서 바로 이어져 들어옴`
    );
  }
  if (parts.length === 0) return null;
  parts.push("'유지' = 끊기지 않고 이어짐, '전환' = Set이 다음 Step 값으로 바뀐 시점 (두 칸 모두 주의·경보 판정 제외)");
  return { label: isBb ? 'BB' : '연속', title: parts.join('\n') };
};
