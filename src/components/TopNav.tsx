import React, { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { CTCLMatrixData } from '../types/pecvd';
import { HIRUJA_SYMBOL_PNG } from '../assets/hirujaLogo';
import { useTheme } from '../context/ThemeContext';

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  fileCount: number;
  /** CTCL Matrix (상단 오른쪽: 클릭해서 파일 선택 또는 끌어다 놓기) */
  ctclMatrix: CTCLMatrixData | null;
  onUploadCtclFile: (file: File) => void;
  onSelectCtclSheet?: (sheetName: string) => void;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
  onOpenUploadScreen?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  fileCount,
  ctclMatrix,
  onUploadCtclFile,
  onSelectCtclSheet,
}) => {
  const { theme } = useTheme();
  const ctclInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingCtcl, setIsDraggingCtcl] = useState(false);

  const tabs = [
    { id: 'integrated', label: '공정 종합 분석' },
    { id: 'trend', label: '그래프 분석' },
    { id: 'raw', label: '원본 Log Data' },
  ];

  return (
    <header className={`sticky top-0 z-40 ${theme.navBg} border-b ${theme.navBorder} px-4 lg:px-7 py-2.5 transition-colors`}>
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-3">
        {/* Zone 1: Wordmark & Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src={HIRUJA_SYMBOL_PNG}
              alt="H&iruja"
              title="H&iruja"
              className="w-8 h-8 object-contain shrink-0 select-none"
              draggable={false}
            />
            <span className={`text-base font-bold tracking-tight ${theme.cardTitleColor} font-sans whitespace-nowrap`}>
              PECVD Process Log 분석 Tool
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        {fileCount > 0 && (
          <nav className={`flex items-center gap-1 ${theme.navPillBg} p-1 rounded-2xl border ${theme.navPillBorder} overflow-x-auto max-w-xl scrollbar-none`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? theme.navTabActive
                    : theme.navTabInactive
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Zone 3: CTCL Matrix (클릭 = 파일 선택, 엑셀을 끌어다 놓아도 등록/교체) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={ctclInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onUploadCtclFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => ctclInputRef.current?.click()}
            onDragOver={e => {
              e.preventDefault();
              setIsDraggingCtcl(true);
            }}
            onDragLeave={() => setIsDraggingCtcl(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDraggingCtcl(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onUploadCtclFile(f);
            }}
            className={`flex items-center gap-2 pl-2.5 pr-3 py-1 rounded-xl border-2 transition-all cursor-pointer max-w-[280px] ${
              isDraggingCtcl
                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300'
                : ctclMatrix
                ? 'bg-white border-emerald-300 hover:border-emerald-500'
                : 'bg-white border-dashed border-amber-400 hover:border-[#2563EB]'
            }`}
            title="CTCL Matrix 엑셀(.xlsx, .xlsm): 클릭해서 선택하거나 여기로 끌어다 놓으면 등록/교체됩니다"
            data-ctcl-nav
          >
            <FileSpreadsheet className={`w-4 h-4 shrink-0 ${ctclMatrix ? 'text-[#10B981]' : 'text-amber-500'}`} />
            <span className="flex flex-col items-start min-w-0 leading-tight">
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#0F172A]">
                CTCL Matrix
                <span className={`w-1.5 h-1.5 rounded-full ${isDraggingCtcl ? 'bg-emerald-500 animate-ping' : ctclMatrix ? 'bg-[#10B981]' : 'bg-amber-500'}`} />
              </span>
              <span className="text-[10px] text-[#64748B] truncate max-w-[220px]">
                {isDraggingCtcl ? '여기에 놓으세요' : ctclMatrix ? ctclMatrix.fileName : '미연결 (클릭/드롭)'}
              </span>
            </span>
          </button>
          {ctclMatrix && ctclMatrix.availableSheets.length > 1 && onSelectCtclSheet && (
            <select
              aria-label="CTCL 시트"
              value={ctclMatrix.sheetName}
              onChange={e => onSelectCtclSheet(e.target.value)}
              className="h-[30px] max-w-[120px] bg-white border border-slate-300 rounded-lg px-1 text-[10.5px] font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
              title="CTCL 시트 선택"
            >
              {ctclMatrix.availableSheets.map(sh => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </header>
  );
};
