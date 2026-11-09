import React from 'react';
import { Download } from 'lucide-react';
import { HIRUJA_SYMBOL_PNG } from '../assets/hirujaLogo';
import { useTheme } from '../context/ThemeContext';

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  fileCount: number;
  onExportExcel: () => void;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
  onOpenUploadScreen?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  fileCount,
  onExportExcel,
}) => {
  const { theme } = useTheme();

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

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={onExportExcel}
            disabled={fileCount === 0}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap active:scale-[0.98] ${
              fileCount > 0
                ? theme.btnPrimary
                : `${theme.cardBg} ${theme.appMutedText} cursor-not-allowed border ${theme.cardBorder}`
            }`}
            title="전체 분석 결과를 다중 시트 Excel(.xlsx)로 내보내기"
          >
            <Download className="w-3.5 h-3.5" />
            <span>전체 Excel 다운로드</span>
          </button>
        </div>
      </div>
    </header>
  );
};
