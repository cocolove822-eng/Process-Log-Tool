import React, { useRef, useState, useEffect } from 'react';
import { MANAGER_COLLAPSED_WIDTH, MANAGER_WIDTH } from './ManagerShell';
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
  GripVertical,
} from 'lucide-react';
import { AnalyzerSettings, CTCLMatrixData, ParsedLogFile, AnalysisFileResult } from '../types/pecvd';
import { detectAllDepoSteps } from '../utils/analyzer';
import { useTheme } from '../context/ThemeContext';
import { SidebarSettingsPanel } from './SidebarSettingsPanel';
import { SidebarGuidePanel } from './SidebarGuidePanel';
import { shortRecipeName } from './TrendTab';
import { dropToIndex, RUN_DRAG_TYPE, RunSortMode } from '../utils/runOrder';

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
  /** Run 순서 바꾸기: 끌어서 옮기기 (fileId를 toIndex 자리로) */
  onMoveFile?: (fileId: string, toIndex: number) => void;
  /** Run 정렬 (Recipe별 · 날짜순 · 올린 순서) */
  onSortFiles?: (mode: RunSortMode) => void;
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
  onMoveFile,
  onSortFiles,
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
  // Run 줄 끌어서 옮기기: 끌고 있는 Run · 놓을 위치(그 줄의 위/아래)
  const [dragRunId, setDragRunId] = useState<string | null>(null);
  const [dropMark, setDropMark] = useState<{ idx: number; after: boolean } | null>(null);
  const isRunDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types || []).includes(RUN_DRAG_TYPE);
  const endRunDrag = () => {
    setDragRunId(null);
    setDropMark(null);
  };

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



  // 너비: 세 매니저 공통 (펼침 250px · 접힘 56px)
  const sidebarWidthClass = isCollapsed ? MANAGER_COLLAPSED_WIDTH : MANAGER_WIDTH;

  // Drag event handlers for sidebar
  const handleSidebarDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (isRunDrag(e)) return; // Run 순서 끌기는 파일 추가가 아님
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
    if (isRunDrag(e)) {
      endRunDrag();
      return;
    }
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
        className={`h-[calc(100vh-60px)] sticky top-[57px] flex flex-col bg-[#E6EBF1] border-r ${
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
                  공정 분석 매니저
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
              <div
                className="px-1.5 py-1.5 border-b border-slate-300 bg-[#E6EBF1] flex items-center gap-1.5"
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isRunDrag(e)) setIsDraggingRun(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingRun(false);
                }}
                onDrop={handleRunDrop}
              >
                {/* Log Data 추가: 얇은 한 줄 버튼 (클릭 또는 파일을 끌어다 놓기) */}
                <button
                  type="button"
                  onClick={() => rawInputRef.current?.click()}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-dashed text-[10.5px] font-bold transition-colors cursor-pointer ${
                    isDraggingRun
                      ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                      : 'bg-white border-slate-400 text-[#334155] hover:border-[#2563EB] hover:text-[#2563EB]'
                  }`}
                  title="엑셀(.xlsx) 또는 CSV 파일을 클릭해 추가하거나, 이곳(또는 사이드바)으로 끌어다 놓으세요"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isDraggingRun ? '파일을 놓으세요' : 'Log Data 추가'}</span>
                </button>
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAllFiles}
                    className="shrink-0 p-1 rounded-md text-[#94A3B8] hover:text-[#DC2626] hover:bg-rose-50 transition-colors cursor-pointer"
                    title="등록된 Run 전체 비우기"
                    aria-label="전체 비우기"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              /* Collapsed Mini Action Icons with Drop Support */
              <div
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isRunDrag(e)) setIsDraggingRun(true);
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
                  <div className="flex items-center justify-between gap-1 px-1 pb-0.5 text-[9.5px] font-semibold text-[#64748B]">
                    <span className="whitespace-nowrap">등록된 Run ({files.length})</span>
                    {onSortFiles && files.length > 1 && (
                      <select
                        aria-label="Run 정렬"
                        value=""
                        onChange={e => {
                          const v = e.target.value as RunSortMode;
                          if (v) onSortFiles(v);
                        }}
                        className="h-[18px] px-0.5 bg-white border border-slate-300 rounded text-[9.5px] font-bold text-[#2563EB] cursor-pointer focus:outline-none focus:border-[#2563EB]"
                        title="Run 순서 정렬 · 줄 왼쪽 ⋮⋮ 손잡이를 끌어서 직접 옮길 수도 있습니다"
                      >
                        <option value="">⇅ 정렬</option>
                        <option value="recipe">Recipe별</option>
                        <option value="date">날짜순</option>
                        <option value="upload">올린 순서</option>
                      </select>
                    )}
                    <span className="whitespace-nowrap">Step · 날짜</span>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-400 overflow-hidden divide-y divide-slate-300">
                  {files.map((file, idx) => {
                    const fileResults = results.filter(r => r.fileId === file.id);
                    const firstResult = fileResults[0];
                    const primaryResultIdx = results.findIndex(r => r.fileId === file.id);
                    const rcpDisplay = file.meta.recipeName || firstResult?.rcpName || file.fileName.replace(/\.(csv|xlsx|xls|xlsm)$/i, '');
                    const shortName = shortRecipeName(rcpDisplay);
                    const dateDisplay = file.meta.date ? file.meta.date.slice(5, 10) : '';
                    const isSelected = selectedRunIdx !== null && results[selectedRunIdx]?.fileId === file.id;
                    const detectedDepo = detectAllDepoSteps(file, settings);
                    const isManual = file.manualDepoStep !== null && file.manualDepoStep !== undefined;
                    const allRecipeSteps = (file.stepsSummary && file.stepsSummary.length > 0)
                      ? file.stepsSummary.map(st => ({ step: st.step, name: st.stepName, duration: st.durationSec as number | undefined }))
                      : Array.from(new Set(file.rows.map(r => r.step)))
                          .sort((a, b) => a - b)
                          .map(stepNum => ({
                            step: stepNum,
                            name: file.rows.find(r => r.step === stepNum)?.stepName || `Step ${stepNum}`,
                            duration: undefined as number | undefined,
                          }));

                    return (
                      <div
                        key={file.id}
                        data-run-row={file.id}
                        onClick={() => onSelectRunIdx(isSelected ? null : (primaryResultIdx !== -1 ? primaryResultIdx : idx))}
                        onDragOver={e => {
                          if (!isRunDrag(e) || !onMoveFile) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          const rc = e.currentTarget.getBoundingClientRect();
                          const after = e.clientY > rc.top + rc.height / 2;
                          if (!dropMark || dropMark.idx !== idx || dropMark.after !== after) setDropMark({ idx, after });
                        }}
                        onDrop={e => {
                          if (!isRunDrag(e) || !onMoveFile) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const id = e.dataTransfer.getData(RUN_DRAG_TYPE) || dragRunId;
                          const from = files.findIndex(f => f.id === id);
                          const rc = e.currentTarget.getBoundingClientRect();
                          const after = e.clientY > rc.top + rc.height / 2;
                          if (id && from >= 0) onMoveFile(id, dropToIndex(from, idx, after));
                          endRunDrag();
                        }}
                        className={`flex items-center gap-1 pl-0.5 pr-0.5 h-[26px] cursor-pointer group transition-colors ${
                          isSelected ? 'bg-[#DBEAFE]' : 'bg-white hover:bg-[#F1F5F9]'
                        } ${dragRunId === file.id ? 'opacity-40' : ''}`}
                        style={
                          dropMark && dropMark.idx === idx && dragRunId && dragRunId !== file.id
                            ? { boxShadow: dropMark.after ? 'inset 0 -2px 0 #2563EB' : 'inset 0 2px 0 #2563EB' }
                            : undefined
                        }
                        title={`#${idx + 1} ${rcpDisplay}${file.meta.date ? ` · ${file.meta.date.slice(0, 10)}` : ''}`}
                      >
                        {/* 끌어서 순서 바꾸기 손잡이 */}
                        {onMoveFile && files.length > 1 && (
                          <span
                            draggable
                            data-run-grip
                            onClick={e => e.stopPropagation()}
                            onDragStart={e => {
                              e.stopPropagation();
                              e.dataTransfer.setData(RUN_DRAG_TYPE, file.id);
                              e.dataTransfer.effectAllowed = 'move';
                              const row = (e.currentTarget as HTMLElement).closest('[data-run-row]') as HTMLElement | null;
                              if (row) e.dataTransfer.setDragImage(row, 12, 13);
                              setDragRunId(file.id);
                            }}
                            onDragEnd={endRunDrag}
                            className="shrink-0 w-3 flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] cursor-grab active:cursor-grabbing"
                            title="끌어서 순서 바꾸기"
                            aria-label={`#${idx + 1} 끌어서 순서 바꾸기`}
                          >
                            <GripVertical className="w-3 h-3" />
                          </span>
                        )}
                        <span
                          className={`w-[26px] shrink-0 text-center text-[9px] font-bold tabular-nums rounded py-[1px] ${
                            isSelected ? 'bg-[#2563EB] text-white' : 'text-[#2563EB] bg-[#2563EB]/10'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span
                          className={`flex-1 min-w-0 truncate text-[11px] font-bold ${isSelected ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}
                        >
                          {shortName}
                        </span>
                        <select
                          value={isManual ? String(file.manualDepoStep) : 'all'}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const val = e.target.value;
                            onChangeManualDepoStep(file.id, val === 'all' ? null : parseInt(val, 10));
                          }}
                          className={`w-[68px] shrink-0 border rounded text-[9.5px] font-bold px-0.5 py-0 h-[18px] focus:outline-none focus:border-[#2563EB] cursor-pointer ${
                            isManual
                              ? 'border-[#2563EB] text-[#1D4ED8] bg-blue-50'
                              : 'border-slate-200 text-[#2563EB] bg-white hover:border-slate-300'
                          }`}
                          title="분석할 Step 선택 (첫 항목: 조건 기반 자동 감지)"
                        >
                          <option value="all">
                            {detectedDepo.length > 1 ? `Step ×${detectedDepo.length}` : `Step ${detectedDepo[0] ?? 3}`}
                          </option>
                          {detectedDepo.length > 0 && (
                            <optgroup label="조건 감지 Step">
                              {detectedDepo.map(stepNum => {
                                const sName =
                                  file.stepsSummary?.find(st => st.step === stepNum)?.stepName ||
                                  file.rows?.find(r => r.step === stepNum)?.stepName ||
                                  '';
                                return (
                                  <option key={`auto_${stepNum}`} value={String(stepNum)}>
                                    Step {stepNum} {sName}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          <optgroup label={`전체 Step (${allRecipeSteps.length})`}>
                            {allRecipeSteps.map(st => (
                              <option key={`all_${st.step}`} value={String(st.step)}>
                                Step {st.step} {st.name}
                                {st.duration !== undefined && st.duration !== null ? ` · ${st.duration.toFixed(0)}s` : ''}
                                {detectedDepo.includes(st.step) ? ' ★' : ''}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <span className="w-[30px] shrink-0 text-right text-[9px] text-[#94A3B8] tabular-nums">{dateDisplay}</span>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onRemoveFile(file.id);
                          }}
                          className="shrink-0 w-4 text-[#CBD5E1] hover:text-[#DC2626] text-[10px] leading-none cursor-pointer"
                          title={`${file.fileName} 삭제`}
                          aria-label={`#${idx + 1} 삭제`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  </div>
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

      </aside>
    </>
  );
};
