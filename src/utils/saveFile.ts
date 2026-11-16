/**
 * 파일 저장 (엑셀 · PNG)
 * - claude.ai 링크(아티팩트) 안: 페이지가 직접 내려받을 수 없으므로 'downloads' 기능으로 저장 요청
 *   → 화면에 저장 확인 창이 뜨고, 사용자가 '저장'을 누르면 받아짐
 * - 오프라인 HTML 등 그 밖: 브라우저 다운로드(링크 클릭)
 */
type DownloadsNs = {
  save: (req: { filename: string; data: Blob }) => Promise<{ status: string }>;
};
type ClaudeWin = { claude?: { use?: (name: string) => Promise<unknown> } };

let dlPromise: Promise<DownloadsNs | null> | null = null;
/** 'downloads' 기능 (없으면 null). 한 번만 물어보고 기억 */
const viewerDownloads = (): Promise<DownloadsNs | null> => {
  if (!dlPromise) {
    const c = typeof window !== 'undefined' ? (window as unknown as ClaudeWin).claude : undefined;
    dlPromise =
      c && typeof c.use === 'function'
        ? (c.use('downloads') as Promise<DownloadsNs | null>).then(ns => ns ?? null).catch(() => null)
        : Promise.resolve(null);
  }
  return dlPromise;
};
// 페이지를 열 때 미리 물어 두기 (버튼을 눌렀을 때 기다리지 않게)
if (typeof window !== 'undefined') setTimeout(() => void viewerDownloads(), 0);

export type SaveOutcome = 'saved' | 'declined' | 'failed';

/** 브라우저 다운로드 (링크 클릭) */
const anchorDownload = (data: Blob, filename: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data);
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // 바로 지우면 일부 브라우저가 파일 이름을 놓침 → 잠시 뒤 정리
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(a.href);
  }, 3000);
};

/** 파일 저장: 링크 페이지 안이면 저장 확인 창, 아니면 바로 다운로드 */
export async function saveFile(data: Blob, filename: string): Promise<SaveOutcome> {
  const name = filename.replace(/[\\/:*?"<>|]/g, '_');
  const dl = await viewerDownloads();
  if (dl) {
    try {
      await dl.save({ filename: name, data });
      return 'saved';
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'declined') return 'declined';
      if (code === 'rate_limited' || code === 'bad_request' || code === 'rejected_extension' || code === 'too_large') {
        console.warn('파일 저장 실패', err);
        return 'failed';
      }
      // unavailable 등: 아래 일반 다운로드로
    }
  }
  try {
    anchorDownload(data, name);
    return 'saved';
  } catch (err) {
    console.warn('파일 저장 실패', err);
    return 'failed';
  }
}
