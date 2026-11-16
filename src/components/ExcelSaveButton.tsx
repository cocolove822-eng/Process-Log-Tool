import React, { useState } from 'react';
import { Check, FileSpreadsheet } from 'lucide-react';
import { downloadChartXlsx, XChartSpec } from '../utils/excelChart';

/**
 * '엑셀 저장' 버튼: 그래프를 엑셀이 직접 그리는 차트(.xlsx)로 저장
 * - 엑셀에서 선 위 마우스 = 값, 축 서식 사용, B3 커서 Time을 바꾸면 커서 선 · 값 표가 바뀜
 */
export const ExcelSaveButton: React.FC<{ getSpec: () => XChartSpec | null; compact?: boolean }> = ({ getSpec, compact }) => {
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle');
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const spec = getSpec();
      if (!spec || spec.series.length === 0) throw new Error('데이터 없음');
      downloadChartXlsx(spec);
      setState('saved');
    } catch (err) {
      console.warn('엑셀 저장 실패', err);
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  };
  return (
    <button
      type="button"
      data-copy-ignore
      data-excel-save-btn
      onClick={onClick}
      title="엑셀 차트로 저장 (.xlsx) — 엑셀에서 커서 값 확인 · 축 서식 사용 가능"
      className={`flex items-center gap-1 whitespace-nowrap cursor-pointer ${
        compact
          ? 'px-1.5 py-0.5 rounded-md border border-slate-300 bg-white text-[10.5px] font-semibold text-[#334155] hover:border-[#059669] hover:text-[#047857]'
          : 'px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl shadow-xs text-[#334155] hover:bg-slate-50'
      }`}
    >
      {state === 'saved' ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-[#059669]" />}
      <span className={state === 'saved' ? 'text-[#059669]' : state === 'failed' ? 'text-[#DC2626]' : ''}>
        {state === 'saved' ? '저장됨' : state === 'failed' ? '실패' : '엑셀 저장'}
      </span>
    </button>
  );
};
