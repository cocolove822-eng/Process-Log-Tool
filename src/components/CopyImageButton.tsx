import React, { useState } from 'react';
import { Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { copyElementImage } from '../utils/richCopy';

/**
 * '그래프 복사' 버튼: 카드(그래프)를 화면 그대로 이미지로 클립보드에 복사 → 엑셀·PPT에 붙여 넣기
 * - target: 복사할 요소 (없으면 버튼이 속한 카드 [data-copy-image] / section)
 * - 버튼 자신은 이미지에서 빠짐 (data-copy-ignore)
 */
export const CopyImageButton: React.FC<{
  target?: () => HTMLElement | null;
  fileName?: string;
  className?: string;
  compact?: boolean;
}> = ({ target, fileName = 'graph.png', className = '', compact }) => {
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'saved' | 'failed'>('idle');
  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const el = target?.() ?? (e.currentTarget.closest('[data-copy-image], section, [data-multi-chart]') as HTMLElement | null);
    if (!el || state === 'busy') return;
    setState('busy');
    const r = await copyElementImage(el, fileName);
    setState(r);
    setTimeout(() => setState('idle'), 2000);
  };
  const label =
    state === 'busy' ? '만드는 중' : state === 'copied' ? '복사 완료' : state === 'saved' ? 'PNG 저장됨' : state === 'failed' ? '실패' : '그래프 복사';
  return (
    <button
      type="button"
      data-copy-ignore
      data-copy-image-btn
      onClick={onClick}
      title="그래프를 화면 그대로 이미지로 복사 (엑셀·PPT에 Ctrl+V)"
      className={`flex items-center gap-1 whitespace-nowrap cursor-pointer ${
        compact
          ? 'px-1.5 py-0.5 rounded-md border border-slate-300 bg-white text-[10.5px] font-semibold text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB]'
          : 'px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl shadow-xs text-[#334155] hover:bg-slate-50'
      } ${className}`}
    >
      {state === 'busy' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#64748B]" />
      ) : state === 'copied' || state === 'saved' ? (
        <Check className="w-3.5 h-3.5 text-[#059669]" />
      ) : (
        <ImageIcon className="w-3.5 h-3.5 text-[#8B95A1]" />
      )}
      <span className={state === 'copied' || state === 'saved' ? 'text-[#059669]' : state === 'failed' ? 'text-[#DC2626]' : ''}>{label}</span>
    </button>
  );
};
