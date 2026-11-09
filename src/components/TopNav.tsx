import React from 'react';
import { Activity, Download } from 'lucide-react';
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
    { id: 'trend', label: '타임 트렌드' },
    { id: 'raw', label: '원본 Log Data' },
  ];

  return (
    <header className={`sticky top-0 z-40 ${theme.navBg} border-b ${theme.navBorder} px-4 lg:px-7 py-2.5 transition-colors`}>
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-3">
        {/* Zone 1: Wordmark & Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/25 flex items-center justify-center text-[#2563EB] font-bold shadow-xs">
              <Activity className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold tracking-tight ${theme.cardTitleColor} font-sans`}>
                  PECVD Process Log
                </span>
                <span className="text-[10px] font-semibold text-[#2563EB] bg-[#2563EB]/10 border border-[#2563EB]/20 px-2 py-0.5 rounded-full">
                  대시보드
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full tracking-wide">
                  R1
                </span>
              </div>
            </div>
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
