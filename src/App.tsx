/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TopNav } from './components/TopNav';
import { FileUploadScreen } from './components/FileUploadScreen';
import { IntegratedDashboard } from './components/IntegratedDashboard';
import { TrendTab } from './components/TrendTab';
import { RawDataTab } from './components/RawDataTab';
import { CtclPanel } from './components/CtclPanel';
import { ThemePreviewModal } from './components/ThemePreviewModal';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LeftRunSidebar } from './components/LeftRunSidebar';
import { AnalyzerSettings, CTCLMatrixData, ParsedLogFile } from './types/pecvd';
import { DEFAULT_SETTINGS, analyzeLogFileSteps } from './utils/analyzer';
import { moveItem, RunSortMode, sortRuns } from './utils/runOrder';
import { COMPARE_MAX, resultKey } from './components/ComparePanel';
import { parseRawLogFile } from './utils/csvParser';
import { parseCTCLWorkbook } from './utils/ctclParser';
import { createSampleCTCLMatrix } from './utils/sampleData';

function AppContent() {
  const { theme } = useTheme();
  const [files, setFiles] = useState<ParsedLogFile[]>([]);
  const [ctclMatrix, setCtclMatrix] = useState<CTCLMatrixData | null>(null);
  const [settings, setSettings] = useState<AnalyzerSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<string>('integrated');
  // 그래프 분석 / Log 분석 매니저가 그려질 왼쪽 자리 (DOM 노드)
  const [managerHost, setManagerHost] = useState<HTMLElement | null>(null);
  // 원본 로그 탭 맨 위 CTCL Matrix 패널 펼침 여부 (기본 접힘)
  const [isCtclOpen, setIsCtclOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [selectedRunIdx, setSelectedRunIdx] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Run analysis pipeline across all loaded files (supports unlimited N files & multi-step Depo)
  const results = useMemo(() => {
    return files.flatMap((file, idx) => analyzeLogFileSteps(file, settings, ctclMatrix, idx));
  }, [files, settings, ctclMatrix]);

  // Run 순서 바꾸기 (공정 분석 매니저에서 끌어서 옮기기 · 정렬)
  // - 처음 올린 순서를 기억 (정렬 '올린 순서'로 되돌리기용)
  const uploadSeqRef = useRef<Map<string, number>>(new Map());
  const uploadCounterRef = useRef(0);
  // - 순서가 바뀌어도 선택했던 Run(파일 + Depo 순번)을 그대로 선택
  const pendingSelectRef = useRef<{ fileId: string; sub: number } | null>(null);
  const reorderFiles = (mutate: (prev: ParsedLogFile[]) => ParsedLogFile[]) => {
    const cur = selectedRunIdx !== null ? results[selectedRunIdx] : null;
    pendingSelectRef.current = cur ? { fileId: cur.fileId, sub: cur.subIndex ?? 1 } : null;
    setFiles(mutate);
  };
  useEffect(() => {
    const k = pendingSelectRef.current;
    if (!k) return;
    pendingSelectRef.current = null;
    const i = results.findIndex(r => r.fileId === k.fileId && (r.subIndex ?? 1) === k.sub);
    setSelectedRunIdx(i >= 0 ? i : null);
  }, [results]);
  const handleMoveFile = (fileId: string, toIndex: number) =>
    reorderFiles(prev => moveItem(prev, prev.findIndex(f => f.id === fileId), toIndex));
  const handleSortFiles = (mode: RunSortMode) => reorderFiles(prev => sortRuns(prev, mode, uploadSeqRef.current));

  // 비교 선택 (최대 3개, A·B·C 순서) — 키는 '파일 + Depo 순번'이라 순서를 바꿔도 유지
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [compareOnly, setCompareOnly] = useState<boolean>(false);
  const [compareNotice, setCompareNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashCompareNotice = (msg: string) => {
    setCompareNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setCompareNotice(null), 2500);
  };
  const toggleCompareKey = (key: string) =>
    setCompareKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= COMPARE_MAX) {
        flashCompareNotice(`최대 ${COMPARE_MAX}개까지 비교할 수 있습니다 — 하나를 빼고 다시 골라 주세요`);
        return prev;
      }
      return [...prev, key];
    });
  // 매니저 체크칸: 그 Log의 Depo가 하나라도 비교 중이면 모두 빼고, 아니면 첫 Depo를 추가
  const toggleCompareFile = (fileId: string) => {
    const keys = results.filter(r => r.fileId === fileId).map(resultKey);
    if (keys.length === 0) return;
    if (compareKeys.some(k => keys.includes(k))) setCompareKeys(prev => prev.filter(k => !keys.includes(k)));
    else toggleCompareKey(keys[0]);
  };
  const clearCompare = () => {
    setCompareKeys([]);
    setCompareOnly(false);
  };
  // 파일 삭제·Depo 변경으로 없어진 Run은 비교에서 자동으로 뺌
  useEffect(() => {
    const valid = new Set(results.map(resultKey));
    setCompareKeys(prev => (prev.every(k => valid.has(k)) ? prev : prev.filter(k => valid.has(k))));
  }, [results]);
  useEffect(() => {
    if (compareKeys.length === 0 && compareOnly) setCompareOnly(false);
  }, [compareKeys.length, compareOnly]);

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
      parsedList.forEach(f => {
        if (!uploadSeqRef.current.has(f.id)) uploadSeqRef.current.set(f.id, uploadCounterRef.current++);
      });
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


  return (
    <div className={`min-h-screen ${theme.appBg} ${theme.appText} flex flex-col font-sans transition-colors selection:bg-[#3182F6]/20`}>
      {/* Top Bar with Toss Design Style Switcher */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fileCount={files.length}
        ctclMatrix={ctclMatrix}
        onUploadCtclFile={handleUploadCtclFile}
        onSelectCtclSheet={handleSelectCtclSheet}
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
          {/* 공정 분석 매니저: '공정 종합 분석' 탭에서만 표시 */}
          {activeTab === 'integrated' && (
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
            onMoveFile={handleMoveFile}
            onSortFiles={handleSortFiles}
            compareKeys={compareKeys}
            onToggleCompareFile={toggleCompareFile}
          />
          )}

          {/* 그래프 분석 / Log 분석 매니저 자리: 각 탭이 이 자리에 패널을 그림 (공정 분석 매니저와 같은 위치) */}
          {activeTab !== 'integrated' && <div ref={setManagerHost} className="contents" />}

          {/* Main Dashboard & Tabs Area */}
          <main className="flex-1 min-w-0 p-2 lg:p-3 space-y-2 overflow-x-clip">
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
                compareKeys={compareKeys}
                onToggleCompare={toggleCompareKey}
                onClearCompare={clearCompare}
                compareOnly={compareOnly}
                onToggleCompareOnly={setCompareOnly}
                compareNotice={compareNotice}
                onNavigateToCtcl={() => {
                  setIsCtclOpen(true);
                  setActiveTab('raw');
                }}
              />
            )}

            {/* Tab 2: 그래프 분석 (Trend) */}
            {activeTab === 'trend' && (
              <TrendTab files={files} results={results} managerHost={managerHost} />
            )}

            {/* Tab 3: 원본 로그 (Raw Data) — 맨 위에 CTCL Matrix 간략 패널(접고 펴기) */}
            {activeTab === 'raw' && (
              <div className="space-y-2">
                <CtclPanel
                  ctclMatrix={ctclMatrix}
                  results={results}
                  selectedRunIdx={selectedRunIdx}
                  onSelectRunIdx={setSelectedRunIdx}
                  onUploadCtclFile={handleUploadCtclFile}
                  onSelectCtclSheet={handleSelectCtclSheet}
                  onLoadSampleCtcl={() => setCtclMatrix(createSampleCTCLMatrix())}
                  open={isCtclOpen}
                  onToggle={setIsCtclOpen}
                />
                <RawDataTab
                  files={files}
                  results={results}
                  selectedRunIdx={selectedRunIdx}
                  onSelectRunIdx={setSelectedRunIdx}
                  managerHost={managerHost}
                />
              </div>
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
