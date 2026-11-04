import React, { useRef, useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  Sliders,
  BookOpen,
  Calendar,
  Upload,
} from 'lucide-react';
import { AnalyzerSettings, CTCLMatrixData, ParsedLogFile, AnalysisFileResult } from '../types/pecvd';
import { detectAllDepoSteps } from '../utils/analyzer';
import { useTheme } from '../context/ThemeContext';
import { SidebarSettingsPanel } from './SidebarSettingsPanel';
import { SidebarGuidePanel } from './SidebarGuidePanel';

interface LeftRunSidebarProps {
  files: ParsedLogFile[];
  ctclMatrix: CTCLMatrixData | null;
  results?: AnalysisFileResult[];
  selectedRunIdx: number | null;
  onSelectRunIdx: (idx: number | null) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUploadRawFiles: (files: FileList | File[]) => void;
  onUploadCtclFile: (file: File) => void;
  onRemoveFile: (fileId: string) => void;
  onClearAllFiles: () => void;
  onChangeManualDepoStep: (fileId: string, step: number | null) => void;
  onSelectCtclSheet?: (sheetName: string) => void;
  settings: AnalyzerSettings;
  onUpdateSettings: (newSettings: AnalyzerSettings) => void;
  isSettingsOpen?: boolean;
  onToggleSettings?: () => void;
}

export const LeftRunSidebar: React.FC<LeftRunSidebarProps> = ({
  files,
  ctclMatrix,
  results = [],
  selectedRunIdx,
  onSelectRunIdx,
  isCollapsed,
  onToggleCollapse,
  onUploadRawFiles,
  onUploadCtclFile,
  onRemoveFile,
  onClearAllFiles,
  onChangeManualDepoStep,
  onSelectCtclSheet,
  settings,
  onUpdateSettings,
  isSettingsOpen = false,
  onToggleSettings,
}) => {
  const { theme } = useTheme();
  const rawInputRef = useRef<HTMLInputElement>(null);
  const ctclInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop States
  const [isDraggingRun, setIsDraggingRun] = useState<boolean>(false);
  const [isDraggingCtcl, setIsDraggingCtcl] = useState<boolean>(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const sidebarDragCounter = useRef<number>(0);

  // Sidebar Internal Tab: 'runs' (Run 목록) | 'settings' (분석 설정) | 'guide' (사용설명서)
  const [sidebarTab, setSidebarTab] = useState<'runs' | 'settings' | 'guide'>('runs');

  // 외부 isSettingsOpen 상태가 변경되면 'settings' 탭으로 자동 동기화
  useEffect(() => {
    if (isSettingsOpen) {
      setSidebarTab('settings');
    }
  }, [isSettingsOpen]);

  const handleTabChange = (newTab: 'runs' | 'settings' | 'guide') => {
    setSidebarTab(newTab);
    if (isCollapsed) {
      onToggleCollapse();
    }
  };



  // Determine Sidebar Width (280px for run list, 310px for settings & guide for clean side-by-side layout)
  const sidebarWidthClass = isCollapsed
    ? 'w-[56px] min-w-[56px] max-w-[56px]'
    : sidebarTab === 'settings' || sidebarTab === 'guide'
    ? 'w-[310px] min-w-[310px] max-w-[310px]'
    : 'w-[280px] min-w-[280px] max-w-[280px]';

  // Drag event handlers for sidebar
  const handleSidebarDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    sidebarDragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingSidebar(true);
    }
  };

  const handleSidebarDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    sidebarDragCounter.current -= 1;
    if (sidebarDragCounter.current <= 0) {
      setIsDraggingSidebar(false);
      setIsDraggingRun(false);
      setIsDraggingCtcl(false);
      sidebarDragCounter.current = 0;
    }
  };

  const handleSidebarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSidebarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(false);
    setIsDraggingRun(false);
    setIsDraggingCtcl(false);
    sidebarDragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const firstFile = e.dataTransfer.files[0];
      // If a single dropped file has CTCL in the name, route to CTCL parser
      if (
        e.dataTransfer.files.length === 1 &&
        (firstFile.name.toLowerCase().includes('ctcl') || firstFile.name.toLowerCase().includes('matrix'))
      ) {
        onUploadCtclFile(firstFile);
      } else {
        // Otherwise upload as process raw log files (.csv, .xlsx, .xls)
        onUploadRawFiles(e.dataTransfer.files);
      }
    }
  };

  // Dedicated Run Dropzone Handlers
  const handleRunDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRun(false);
    setIsDraggingSidebar(false);
    sidebarDragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const firstFile = e.dataTransfer.files[0];
      if (
        e.dataTransfer.files.length === 1 &&
        (firstFile.name.toLowerCase().includes('ctcl') || firstFile.name.toLowerCase().includes('matrix'))
      ) {
        onUploadCtclFile(firstFile);
      } else {
        onUploadRawFiles(e.dataTransfer.files);
      }
    }
  };

  // Dedicated CTCL Dropzone Handlers
  const handleCtclDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCtcl(false);
    setIsDraggingSidebar(false);
    sidebarDragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadCtclFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={rawInputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.xlsm,.txt"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadRawFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={ctclInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            onUploadCtclFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Sidebar Container: Sticky on left with full drag and drop support */}
      <aside
        onDragEnter={handleSidebarDragEnter}
        onDragOver={handleSidebarDragOver}
        onDragLeave={handleSidebarDragLeave}
        onDrop={handleSidebarDrop}
        className={`h-[calc(100vh-60px)] sticky top-[57px] flex flex-col bg-[#F1F5F9] border-r ${
          isDraggingSidebar ? 'border-[#2563EB] ring-2 ring-[#2563EB]/40 bg-blue-50/20' : 'border-slate-400'
        } transition-all duration-200 select-none shrink-0 z-20 ${sidebarWidthClass} relative`}
      >
        {/* Dragging over entire sidebar indicator overlay */}
        {isDraggingSidebar && !isDraggingRun && !isDraggingCtcl && (
          <div className="absolute inset-0 bg-[#2563EB]/10 backdrop-blur-2xs z-30 flex flex-col items-center justify-center p-2 text-center pointer-events-none">
            <Upload className="w-6 h-6 text-[#2563EB] animate-bounce mb-1" />
            <span className="text-[11px] font-bold text-[#2563EB] leading-tight">
              파일을 놓아 추가하세요
            </span>
            <span className="text-[9px] text-[#475569] mt-0.5">
              공정 Log (Excel/CSV)
            </span>
          </div>
        )}

        {/* 1. Sidebar Top Header */}
        <div className="p-2 border-b border-slate-300 bg-[#E2E8F0] flex items-center justify-between gap-1">
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 truncate">
              <div className="w-6 h-6 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <span className={`text-xs font-bold ${theme.cardTitleColor} tracking-tight`}>
                  공정 Run 매니저
                </span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#2563EB]/10 text-[#2563EB] font-mono text-[10px] font-bold">
                  {files.length}
                </span>
              </div>
            </div>
          )}

          {/* Collapse/Expand Toggle Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors mx-auto cursor-pointer"
            title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* 2. Top Segmented Tabs (Run 목록 / 분석 설정 / 사용설명서) */}
        {!isCollapsed ? (
          <div className="p-1 border-b border-slate-300 bg-[#E2E8F0]">
            <div className="grid grid-cols-3 gap-0.5 bg-slate-300/80 p-0.5 rounded-lg text-[10.5px] font-semibold">
              <button
                type="button"
                onClick={() => handleTabChange('runs')}
                className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md transition-all cursor-pointer truncate ${
                  sidebarTab === 'runs'
                    ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
                title="Run 목록"
              >
                <Layers className="w-3 h-3 shrink-0" />
                <span className="truncate">Run 목록</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('settings')}
                className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md transition-all cursor-pointer truncate ${
                  sidebarTab === 'settings'
                    ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
                title="공정 분석 설정"
              >
                <Sliders className="w-3 h-3 shrink-0" />
                <span className="truncate">분석 설정</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('guide')}
                className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md transition-all cursor-pointer truncate ${
                  sidebarTab === 'guide'
                    ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
                title="사용설명서"
              >
                <BookOpen className="w-3 h-3 shrink-0" />
                <span className="truncate">설명서</span>
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed Mini Tab Switchers */
          <div className="p-1 border-b border-[#E2E8F0] flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => handleTabChange('runs')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                sidebarTab === 'runs' ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-slate-100'
              }`}
              title="Run 목록"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('settings')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                sidebarTab === 'settings' ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-slate-100'
              }`}
              title="공정 분석 설정"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('guide')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                sidebarTab === 'guide' ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-slate-100'
              }`}
              title="사용설명서"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. Middle Content Area (Switch based on sidebarTab) */}
        {!isCollapsed && sidebarTab === 'settings' ? (
          <SidebarSettingsPanel
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onOpenGuide={() => setSidebarTab('guide')}
          />
        ) : !isCollapsed && sidebarTab === 'guide' ? (
          <SidebarGuidePanel onOpenSettings={() => setSidebarTab('settings')} />
        ) : (
          /* Tab: 'runs' (Standard Run Vertical File List) */
          <>
            {!isCollapsed ? (
              <div className="p-2 border-b border-slate-300 bg-[#F1F5F9]">
                {/* Dedicated Drag & Drop Dropzone Box */}
                <div
                  onDragOver={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingRun(true);
                  }}
                  onDragLeave={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingRun(false);
                  }}
                  onDrop={handleRunDrop}
                  onClick={() => rawInputRef.current?.click()}
                  className={`p-3 rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
                    isDraggingRun
                      ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] scale-[1.01] ring-2 ring-[#2563EB]/20 shadow-xs'
                      : 'bg-white hover:bg-blue-50/40 border-slate-400 hover:border-[#2563EB] text-[#475569]'
                  }`}
                  title="엑셀(.xlsx) 또는 CSV 파일을 여기로 드래그 앤 드롭하거나 클릭하여 추가"
                >
                  <Upload
                    className={`w-4 h-4 transition-transform ${
                      isDraggingRun ? 'text-[#2563EB] scale-125 animate-bounce' : 'text-[#475569]'
                    }`}
                  />
                  <span className="text-[11px] font-bold text-[#0F172A] leading-tight">
                    {isDraggingRun ? '파일을 놓으세요!' : '공정 Log 엑셀 / CSV 드롭'}
                  </span>
                  <span className="text-[9.5px] text-[#475569]">드래그하거나 클릭하여 추가</span>
                </div>
              </div>
            ) : (
              /* Collapsed Mini Action Icons with Drop Support */
              <div
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingRun(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingRun(false);
                }}
                onDrop={handleRunDrop}
                className={`p-2 border-b border-slate-300 flex flex-col items-center gap-2 ${
                  isDraggingRun ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => rawInputRef.current?.click()}
                  className={`w-8 h-8 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer ${
                    isDraggingRun ? 'ring-2 ring-[#2563EB] animate-pulse' : ''
                  }`}
                  title="공정 Log 엑셀 / CSV 추가 (드래그 & 드롭 가능)"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClearAllFiles}
                  className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#DC2626] border border-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                  title="전체 비우기"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Run File List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
              {!isCollapsed ? (
                <>
                  <div className="flex items-center justify-between px-1 py-1 text-[11px]">
                    <span className="text-[#475569] font-bold text-[10px]">등록된 Run ({files.length})</span>
                    {files.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearAllFiles}
                        className="flex items-center gap-1 text-[10px] text-[#64748B] hover:text-[#DC2626] px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer font-medium"
                        title="모든 파일 전체 비우기"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>전체 비우기</span>
                      </button>
                    )}
                  </div>

                  {files.map((file, idx) => {
                    const fileResults = results.filter(r => r.fileId === file.id);
                    const firstResult = fileResults[0];
                    const primaryResultIdx = results.findIndex(r => r.fileId === file.id);
                    const rcpDisplay = file.meta.recipeName || firstResult?.rcpName || file.fileName.replace(/\.(csv|xlsx|xls|xlsm)$/i, '');
                    const dateDisplay = file.meta.date ? file.meta.date.slice(0, 10) : '';
                    const isSelected = selectedRunIdx !== null && results[selectedRunIdx]?.fileId === file.id;
                    const detectedDepo = detectAllDepoSteps(file, settings);
                    const isMultiDepo = detectedDepo.length > 1;

                    return (
                      <div
                        key={`${file.id}_${idx}`}
                        onClick={() => onSelectRunIdx(isSelected ? null : (primaryResultIdx !== -1 ? primaryResultIdx : idx))}
                        className={`px-2 py-1.5 rounded-lg border transition-all shadow-2xs group relative cursor-pointer ${
                          isSelected
                            ? 'border-[#2563EB] ring-1 ring-[#2563EB]/40 bg-[#DBEAFE]'
                            : 'border-slate-300 hover:border-[#2563EB] bg-white'
                        }`}
                      >
                        {/* 1행: Run 인덱스 + 레시피 이름 + 삭제 버튼 */}
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span
                              className={`text-[9px] font-bold font-mono px-1 py-0.2 rounded shrink-0 leading-none transition-colors ${
                                isSelected ? 'bg-[#2563EB] text-white' : 'text-[#2563EB] bg-[#2563EB]/10'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <span
                              className={`text-[11px] font-bold truncate leading-tight ${
                                isSelected ? 'text-[#2563EB]' : theme.cardTitleColor
                              }`}
                              title={rcpDisplay}
                            >
                              {rcpDisplay}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onRemoveFile(file.id);
                            }}
                            className="text-[#94A3B8] hover:text-[#DC2626] p-0.5 rounded transition-colors text-[10px] leading-none shrink-0 cursor-pointer"
                            title={`${file.fileName} 삭제`}
                          >
                            ✕
                          </button>
                        </div>

                        {/* 2행: Recipe Step 선택 드롭다운 (상시 제공: 조건 감지 Step + 전체 Recipe Step + All 복귀) + 날짜 */}
                        <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] gap-1 leading-none">
                          {(() => {
                            const allRecipeSteps = (file.stepsSummary && file.stepsSummary.length > 0)
                              ? file.stepsSummary.map(s => ({
                                  step: s.step,
                                  name: s.stepName,
                                  duration: s.durationSec,
                                }))
                              : Array.from(new Set(file.rows.map(r => r.step)))
                                  .sort((a, b) => a - b)
                                  .map(stepNum => {
                                    const stepRow = file.rows.find(r => r.step === stepNum);
                                    return {
                                      step: stepNum,
                                      name: stepRow?.stepName || `Step ${stepNum}`,
                                      duration: undefined,
                                    };
                                  });

                            return (
                              <div className="flex items-center gap-1 min-w-0 flex-1" onClick={e => e.stopPropagation()}>
                                <span className="text-[#64748B] text-[9px] shrink-0 font-medium">Step:</span>
                                <select
                                  value={
                                    file.manualDepoStep === undefined || file.manualDepoStep === null
                                      ? 'all'
                                      : String(file.manualDepoStep)
                                  }
                                  onChange={e => {
                                    const val = e.target.value;
                                    onChangeManualDepoStep(file.id, val === 'all' ? null : parseInt(val, 10));
                                  }}
                                  className={`bg-white border font-bold text-[9px] rounded px-1 py-0 h-4.5 focus:outline-none focus:border-[#2563EB] cursor-pointer flex-1 min-w-0 max-w-[140px] truncate transition-colors ${
                                    file.manualDepoStep !== null && file.manualDepoStep !== undefined
                                      ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/60 ring-1 ring-[#2563EB]/30'
                                      : 'border-slate-200 text-[#2563EB] hover:border-slate-300'
                                  }`}
                                  title="분석할 Step 선택 (All 선택 시 조건 기반 자동 감지 모드로 복귀)"
                                >
                                  {/* 1. All (원래대로 / 자동 감지 모드로 복귀) */}
                                  <option value="all">
                                    ⚡ All ({detectedDepo.length > 1 ? `자동 감지 ${detectedDepo.length}개 전체` : `기본 감지: Step ${detectedDepo[0] ?? 3}`})
                                  </option>

                                  {/* 2. 조건 기반 자동 감지된 Step 목록 */}
                                  {detectedDepo.length > 0 && (
                                    <optgroup label="── ⚡ 조건 감지 Step ──">
                                      {detectedDepo.map(stepNum => {
                                        const stepSummary = file.stepsSummary?.find(s => s.step === stepNum);
                                        const sName = stepSummary?.stepName || file.rows?.find(r => r.step === stepNum)?.stepName || '';
                                        return (
                                          <option key={`auto_${stepNum}`} value={String(stepNum)}>
                                            Step {stepNum} {sName ? `(${sName})` : ''} [Auto]
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                  )}

                                  {/* 3. Recipe 전체 Step 목록 (1 ~ N) */}
                                  <optgroup label={`── 📋 전체 Recipe Step (${allRecipeSteps.length}개) ──`}>
                                    {allRecipeSteps.map(s => {
                                      const isAuto = detectedDepo.includes(s.step);
                                      const durStr = s.duration !== undefined && s.duration !== null ? ` · ${s.duration.toFixed(0)}s` : '';
                                      return (
                                        <option key={`all_${s.step}`} value={String(s.step)}>
                                          Step {s.step} {s.name ? `(${s.name})` : ''}{durStr}{isAuto ? ' ★' : ''}
                                        </option>
                                      );
                                    })}
                                  </optgroup>
                                </select>
                              </div>
                            );
                          })()}

                          {dateDisplay && (
                            <span className="text-[9px] text-[#94A3B8] font-mono whitespace-nowrap ml-auto shrink-0">
                              {dateDisplay}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                /* Collapsed File Number Icons */
                <>
                  <button
                    type="button"
                    onClick={() => onSelectRunIdx(null)}
                    className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center cursor-pointer text-[10px] font-bold font-mono transition-colors ${
                      selectedRunIdx === null ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                    }`}
                    title="전체 Run 통합 비교"
                  >
                    ALL
                  </button>
                  {files.map((file, idx) => {
                    const primaryResultIdx = results.findIndex(r => r.fileId === file.id);
                    const isSelected = selectedRunIdx !== null && results[selectedRunIdx]?.fileId === file.id;
                    const fileResults = results.filter(r => r.fileId === file.id);
                    const firstResult = fileResults[0];
                    const rcpDisplay = file.meta.recipeName || firstResult?.rcpName || file.fileName.replace(/\.(csv|xlsx|xls|xlsm)$/i, '');
                    return (
                      <button
                        key={`${file.id}_mini_${idx}`}
                        type="button"
                        onClick={() => onSelectRunIdx(isSelected ? null : (primaryResultIdx !== -1 ? primaryResultIdx : idx))}
                        className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center cursor-pointer text-[10px] font-bold font-mono shadow-2xs transition-all ${
                          isSelected ? 'bg-[#2563EB] text-white ring-2 ring-[#2563EB]/30' : 'bg-slate-100 hover:bg-slate-200 text-[#2563EB]'
                        }`}
                        title={`#${idx + 1} ${rcpDisplay}`}
                      >
                        #{idx + 1}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}

        {/* 4. Bottom CTCL Matrix Card (Fixed at sidebar bottom with Drag & Drop Support) */}
        <div className="p-2 border-t border-slate-300 bg-[#E2E8F0]">
          {!isCollapsed ? (
            <div className="space-y-1">
              <div
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingCtcl(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingCtcl(false);
                }}
                onDrop={handleCtclDrop}
                onClick={() => ctclInputRef.current?.click()}
                className={`p-2 rounded-xl border-2 transition-all cursor-pointer shadow-2xs ${
                  isDraggingCtcl
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300 scale-[1.02]'
                    : `bg-white border-dashed ${
                        ctclMatrix
                          ? 'border-emerald-300 hover:border-emerald-500'
                          : 'border-amber-300 hover:border-[#2563EB]'
                      }`
                }`}
                title="클릭하거나 엑셀 파일(.xlsx, .xlsm)을 여기로 드래그 앤 드롭하여 CTCL Matrix 등록/교체"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet
                      className={`w-3.5 h-3.5 ${
                        isDraggingCtcl
                          ? 'text-emerald-600 animate-bounce'
                          : ctclMatrix
                          ? 'text-[#10B981]'
                          : 'text-amber-500'
                      }`}
                    />
                    <span className="font-bold text-[#0F172A]">CTCL Matrix</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isDraggingCtcl ? 'bg-emerald-500 animate-ping' : ctclMatrix ? 'bg-[#10B981]' : 'bg-amber-500'
                    }`}
                  />
                </div>

                <div className="text-[10px] text-[#64748B] truncate mt-0.5 flex items-center justify-between">
                  <span className="truncate">
                    {isDraggingCtcl
                      ? '여기에 놓으세요!'
                      : ctclMatrix
                      ? ctclMatrix.fileName
                      : '미연결 (클릭/드롭)'}
                  </span>
                  <span className="text-[9px] text-[#2563EB] font-semibold shrink-0 ml-1">
                    드래그 가능
                  </span>
                </div>
              </div>

              {/* CTCL Sheet selector if multiple */}
              {ctclMatrix && ctclMatrix.availableSheets.length > 1 && onSelectCtclSheet && (
                <div className="flex items-center justify-between text-[10px] px-1">
                  <span className="text-[#64748B]">시트:</span>
                  <select
                    value={ctclMatrix.sheetName}
                    onChange={e => onSelectCtclSheet(e.target.value)}
                    className="bg-white border border-slate-200 text-[#0F172A] rounded px-1 py-0.5 text-[10px] max-w-[170px] truncate focus:outline-none"
                  >
                    {ctclMatrix.availableSheets.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            /* Collapsed CTCL Indicator Icon with Drop Support */
            <button
              type="button"
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingCtcl(true);
              }}
              onDragLeave={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingCtcl(false);
              }}
              onDrop={handleCtclDrop}
              onClick={() => ctclInputRef.current?.click()}
              className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center relative hover:bg-slate-200 transition-all cursor-pointer ${
                isDraggingCtcl ? 'bg-emerald-100 ring-2 ring-emerald-500' : ''
              }`}
              title={`CTCL Matrix: ${
                ctclMatrix ? ctclMatrix.fileName : '미연결 (클릭 또는 엑셀 드래그 앤 드롭)'
              }`}
            >
              <FileSpreadsheet
                className={`w-4 h-4 ${
                  isDraggingCtcl ? 'text-emerald-600 animate-bounce' : ctclMatrix ? 'text-[#10B981]' : 'text-amber-500'
                }`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full absolute top-1 right-1 ${
                  ctclMatrix ? 'bg-[#10B981]' : 'bg-amber-500'
                }`}
              />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
