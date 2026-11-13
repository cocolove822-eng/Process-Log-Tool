/**
 * '그래프 분석' 탭 설정 보관소
 * - 탭을 바꾸면 그래프 분석 화면이 내려갔다가 다시 만들어지므로, 설정을 화면 밖(이 모듈)에 보관
 * - 페이지를 켜 둔 동안 유지 (새로고침하면 처음 상태)
 */
import { Dispatch, SetStateAction, useCallback, useState } from 'react';

const store = new Map<string, unknown>();

/** useState와 같지만 값을 보관소에 함께 저장 → 탭을 다녀와도 그대로 */
export function useStoredState<T>(key: string, init: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    store.has(key) ? (store.get(key) as T) : typeof init === 'function' ? (init as () => T)() : init,
  );
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    next =>
      setValue(prev => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        store.set(key, v);
        return v;
      }),
    [key],
  );
  return [value, set];
}

/** 화면을 다시 그리지 않고 보관소에 직접 읽기·쓰기 (스크롤 위치처럼 자주 바뀌는 값) */
export const peekStored = <T,>(key: string): T | undefined => store.get(key) as T | undefined;
export const putStored = (key: string, value: unknown) => {
  store.set(key, value);
};

/**
 * 값이 '마지막으로 본 값'과 달라졌는지 (탭을 떠나기 전 값 포함)
 * - 처음 볼 때는 false, 같은 값이면 false → 탭에 다시 들어올 때 '바뀌면 초기화' 동작이 잘못 돌지 않게
 */
export function changedSince(key: string, value: unknown): boolean {
  const k = `__last:${key}`;
  const s = JSON.stringify(value) ?? 'undefined';
  const first = !store.has(k);
  if (!first && store.get(k) === s) return false;
  store.set(k, s);
  return !first;
}
