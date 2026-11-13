/**
 * 공정 분석 매니저 Run 순서 바꾸기 (끌어서 옮기기 · 정렬)
 * - 순서는 App의 files 배열 하나로 관리 → 표·번호(#)·그래프 목록이 모두 같은 순서를 따름
 */
import { ParsedLogFile } from '../types/pecvd';
import { shortRecipeName } from '../components/TrendTab';

/** 매니저 안에서 Run 줄을 끌 때 쓰는 끌기 데이터 종류 (파일 끌어다 놓기와 구분) */
export const RUN_DRAG_TYPE = 'application/x-pecvd-run';

export type RunSortMode = 'recipe' | 'date' | 'upload';

/** Recipe 표시 이름 (매니저와 같은 규칙) */
export const runRecipeName = (f: ParsedLogFile): string =>
  f.meta?.recipeName || f.fileName.replace(/\.(csv|xlsx|xls|xlsm)$/i, '');

/**
 * Recipe 묶음 키: 앞부분이 같으면 같은 묶음
 * - 알려진 Layer 키워드(YILD, YILD2, YMTL …)가 있으면 그 키워드
 * - 없으면 경로를 뗀 이름에서 첫 '_'·'-'·공백 앞부분 (예: ABC_B, ABC_No_Glass → ABC)
 */
export const recipeGroupKey = (name: string): string => {
  const base = ((name || '').split(/[\\/]/).pop() || name || '').trim();
  const short = shortRecipeName(name);
  const key = short !== base ? short : base.split(/[_\-\s]/)[0] || base;
  return key.toUpperCase();
};

/** fromIdx 위치의 Run을 toIdx 위치로 옮긴 새 배열 */
export const moveItem = <T>(arr: T[], fromIdx: number, toIdx: number): T[] => {
  if (fromIdx < 0 || fromIdx >= arr.length) return arr;
  const to = Math.max(0, Math.min(arr.length - 1, toIdx));
  if (to === fromIdx) return arr;
  const next = arr.slice();
  const [it] = next.splice(fromIdx, 1);
  next.splice(to, 0, it);
  return next;
};

/**
 * 끌어서 놓은 위치 → 옮길 자리
 * @param targetIdx 마우스가 올라간 줄
 * @param after 그 줄의 아래쪽 절반이면 true (그 줄 뒤에 놓기)
 */
export const dropToIndex = (fromIdx: number, targetIdx: number, after: boolean): number => {
  let p = after ? targetIdx + 1 : targetIdx;
  if (fromIdx < p) p -= 1;
  return p;
};

const startMs = (f: ParsedLogFile): number => {
  const t = f.rows?.[0]?.timestampMs;
  if (typeof t === 'number' && Number.isFinite(t) && t > 0) return t;
  const d = f.meta?.date ? Date.parse(f.meta.date.replace(/^:+/, '').replace(/\./g, '-')) : NaN;
  return Number.isFinite(d) ? d : Number.POSITIVE_INFINITY;
};

/**
 * 정렬
 * - recipe: 같은 Recipe 묶음끼리 붙임 (묶음은 처음 나온 순서, 묶음 안은 지금 순서 유지)
 * - date: Log 시작 시각 순 (모르면 뒤로, 같으면 지금 순서)
 * - upload: 처음 올린 순서 (uploadSeq)
 */
export const sortRuns = (files: ParsedLogFile[], mode: RunSortMode, uploadSeq: Map<string, number>): ParsedLogFile[] => {
  const pos = new Map(files.map((f, i) => [f.id, i]));
  if (mode === 'recipe') {
    const firstSeen = new Map<string, number>();
    files.forEach((f, i) => {
      const k = recipeGroupKey(runRecipeName(f));
      if (!firstSeen.has(k)) firstSeen.set(k, i);
    });
    return files.slice().sort((a, b) => {
      const ga = firstSeen.get(recipeGroupKey(runRecipeName(a)))!;
      const gb = firstSeen.get(recipeGroupKey(runRecipeName(b)))!;
      return ga - gb || pos.get(a.id)! - pos.get(b.id)!;
    });
  }
  if (mode === 'date') {
    return files.slice().sort((a, b) => {
      const ta = startMs(a);
      const tb = startMs(b);
      if (ta !== tb) return ta < tb ? -1 : 1;
      return pos.get(a.id)! - pos.get(b.id)!;
    });
  }
  return files.slice().sort((a, b) => (uploadSeq.get(a.id) ?? 1e9) - (uploadSeq.get(b.id) ?? 1e9) || pos.get(a.id)! - pos.get(b.id)!);
};
