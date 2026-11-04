/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { FileUploadScreen } from './components/FileUploadScreen';
import { IntegratedDashboard } from './components/IntegratedDashboard';
import { TrendTab } from './components/TrendTab';
import { RawDataTab } from './components/RawDataTab';
import { CtclViewerTab } from './components/CtclViewerTab';
import { ThemePreviewModal } from './components/ThemePreviewModal';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LeftRunSidebar } from './components/LeftRunSidebar';
import { AnalyzerSettings, CTCLMatrixData, ParsedLogFile } from './types/pecvd';
import { DEFAULT_SETTINGS, analyzeLogFileSteps } from './utils/analyzer';
import { parseRawLogFile } from './utils/csvParser';
import { parseCTCLWorkbook } from './utils/ctclParser';
import { exportResultsToExcel } from './utils/exportUtils';
import { createSampleCTCLMatrix } from './utils/sampleData';

function AppContent() {
  const { theme } = useTheme();
  const [files, setFiles] = useState<ParsedLogFile[]>([]);
  const [ctclMatrix, setCtclMatrix] = useState<CTCLMatrixData | null>(null);
  const [settings, setSettings] = useState<AnalyzerSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<string>('integrated');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [selectedRunIdx, setSelectedRunIdx] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Run analysis pipeline across all loaded files (supports unlimited N files & multi-step Depo)
  const results = useMemo(() => {
    return files.flatMap((file, idx) => analyzeLogFileSteps(file, settings, ctclMatrix, idx));
  }, [files, settings, ctclMatrix]);

  // Ensure selectedRunIdx remains within bounds when steps or files change
  useEffect(() => {
    if (selectedRunIdx !== null && selectedRunIdx >= results.length) {
      setSelectedRunIdx(results.length > 0 ? results.length - 1 : null);
    }
  }, [results.length, selectedRunIdx]);

  // Handle Raw Log file uploads (supports .csv, .xlsx, .xls individually or batch, unlimited N files)
  const handleUploadRawFiles = async (uploaded: FileList | File[]) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const fileList = Array.from(uploaded);
      const parsedList: ParsedLogFile[] = [];

      for (const file of fileList) {
        const parsedFiles = await parseRawLogFile(file);
        parsedList.push(...parsedFiles);
      }

      // Progressively append new files to the list without any cap!
      setFiles(prev => [...prev, ...parsedList]);
    } catch (err: any) {
      setErrorMessage(`파일 처리 오류: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle CTCL Matrix file upload (.xlsx / .xlsm)
  const handleUploadCtclFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsedMatrix = parseCTCLWorkbook(buffer, file.name);
      setCtclMatrix(parsedMatrix);
    } catch (err: any) {
      setErrorMessage(`CTCL Matrix 엑셀 파싱 오류: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCtclSheet = (sheetName: string) => {
    if (ctclMatrix) {
      setCtclMatrix({
        ...ctclMatrix,
        sheetName,
      });
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleClearAllFiles = () => {
    setFiles([]);
  };

  const handleChangeManualDepoStep = (fileId: string, step: number | null) => {
    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, manualDepoStep: step } : f))
    );
  };

  const handleChangeManualPlSteps = (fileId: string, plStart: number | null, plEnd: number | null) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId
          ? {
              ...f,
              manualPlStepStart: plStart !== null ? plStart : undefined,
              manualPlStepEnd: plEnd !== null ? plEnd : undefined,
            }
          : f
      )
    );
  };

  const handleExportExcel = () => {
    if (results.length === 0) return;
    exportResultsToExcel(results, settings, `PECVD_Analysis_R1_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className={`min-h-screen ${theme.appBg} ${theme.appText} flex flex-col font-sans transition-colors selection:bg-[#3182F6]/20`}>
      {/* Top Bar with Toss Design Style Switcher */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fileCount={files.length}
        onExportExcel={handleExportExcel}
      />

      {/* Main Content Area */}
      {files.length === 0 ? (
        <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 lg:p-6 space-y-4">
          <FileUploadScreen
            ctclMatrix={ctclMatrix}
            settings={settings}
            onUploadRawFiles={handleUploadRawFiles}
            onUploadCtclFile={handleUploadCtclFile}
            onUpdateSettings={setSettings}
          />
        </main>
      ) : (
        <div className="flex-1 flex w-full max-w-[1920px] mx-auto min-h-0 relative">
          {/* Dedicated Left Run & CTCL Manager Sidebar */}
          <LeftRunSidebar
            files={files}
            ctclMatrix={ctclMatrix}
            results={results}
            selectedRunIdx={selectedRunIdx}
            onSelectRunIdx={setSelectedRunIdx}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            settings={settings}
            onUpdateSettings={setSettings}
            isSettingsOpen={isSettingsOpen}
            onToggleSettings={() => setIsSettingsOpen(prev => !prev)}
            onUploadRawFiles={handleUploadRawFiles}
            onUploadCtclFile={handleUploadCtclFile}
            onRemoveFile={handleRemoveFile}
            onClearAllFiles={handleClearAllFiles}
            onChangeManualDepoStep={handleChangeManualDepoStep}
            onSelectCtclSheet={handleSelectCtclSheet}
          />

          {/* Main Dashboard & Tabs Area */}
          <main className="flex-1 min-w-0 p-2 lg:p-3 space-y-2 overflow-y-auto">
            {/* Error notification banner if any */}
            {errorMessage && (
              <div className="p-4 bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] text-xs rounded-2xl flex items-center justify-between shadow-xs">
                <span className="font-semibold">{errorMessage}</span>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-[#DC2626] hover:text-[#991B1B] ml-2 text-xs font-bold cursor-pointer"
                >
                  닫기
                </button>
              </div>
            )}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="p-4 bg-[#EBF4FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-xs">
                <div className="w-4 h-4 border-2 border-[#3182F6] border-t-transparent rounded-full animate-spin" />
                <span>공정 로그 데이터를 고속 파싱 및 분석 중입니다...</span>
              </div>
            )}

            {/* Tab 1: 공정 종합 분석 (Integrated Dashboard) */}
            {activeTab === 'integrated' && (
              <IntegratedDashboard
                results={results}
                settings={settings}
                files={files}
                ctclMatrix={ctclMatrix}
                selectedRunIdx={selectedRunIdx}
                onSelectRunIdx={setSelectedRunIdx}
                onUpdateSettings={setSettings}
                onUploadRawFiles={handleUploadRawFiles}
                onRemoveFile={handleRemoveFile}
                onClearAllFiles={handleClearAllFiles}
                onChangeManualDepoStep={handleChangeManualDepoStep}
                onChangeManualPlSteps={handleChangeManualPlSteps}
                onNavigateToCtcl={() => setActiveTab('ctcl')}
              />
            )}

            {/* Tab 2: 타임 트렌드 (Trend) */}
            {activeTab === 'trend' && (
              <TrendTab files={files} results={results} />
            )}

            {/* Tab 3: 원본 로그 (Raw Data) */}
            {activeTab === 'raw' && (
              <RawDataTab
                files={files}
                results={results}
                selectedRunIdx={selectedRunIdx}
              />
            )}

            {/* Tab 4: CTCL 매트릭스 */}
            {activeTab === 'ctcl' && (
              <CtclViewerTab
                ctclMatrix={ctclMatrix}
                results={results}
                selectedRunIdx={selectedRunIdx}
                onSelectRunIdx={setSelectedRunIdx}
                onUploadCtclFile={handleUploadCtclFile}
                onSelectCtclSheet={handleSelectCtclSheet}
                onLoadSampleCtcl={() => setCtclMatrix(createSampleCTCLMatrix())}
                onNavigateToIntegrated={() => setActiveTab('integrated')}
              />
            )}
          </main>
        </div>
      )}

      {/* Engineering Footer (Toss White Style) */}
      <footer className={`border-t ${theme.navBorder} ${theme.cardBg} px-6 py-3 text-xs ${theme.appMutedText} flex items-center justify-between transition-colors`}>
        <div>PECVD Process Log Analysis Tool · Client-Side High Performance Analytics</div>
        <div className="font-mono">Chamber {settings.processChamber} · Active Theme: {theme.name}</div>
      </footer>

      {/* Visual Design Style Preview Modal */}
      <ThemePreviewModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
