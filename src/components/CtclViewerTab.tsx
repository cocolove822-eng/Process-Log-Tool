import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Calculator,
  Layers,
  CheckCircle2,
  Upload,
  Sparkles,
  HelpCircle,
  Link2,
  RotateCcw,
  ArrowRight,
  Target,
} from 'lucide-react';
import { CTCLMatrixData, AnalysisFileResult } from '../types/pecvd';
import { interpolateCTCL } from '../utils/ctclParser';

interface CtclViewerTabProps {
  ctclMatrix: CTCLMatrixData | null;
  results?: AnalysisFileResult[];
  selectedRunIdx?: number | null;
  onSelectRunIdx?: (idx: number | null) => void;
  onUploadCtclFile?: (file: File) => void;
  onSelectCtclSheet?: (sheetName: string) => void;
  onLoadSampleCtcl?: () => void;
  onNavigateToIntegrated?: () => void;
}

export const CtclViewerTab: React.FC<CtclViewerTabProps> = ({
  ctclMatrix,
  results = [],
  selectedRunIdx = null,
  onSelectRunIdx,
  onUploadCtclFile,
  onSelectCtclSheet,
  onLoadSampleCtcl,
  onNavigateToIntegrated,
}) => {
  // Active selected run from results
  const activeRun = useMemo(() => {
    if (!results || results.length === 0) return null;
    if (selectedRunIdx !== null && results[selectedRunIdx]) {
      return results[selectedRunIdx];
    }
    return results[0];
  }, [results, selectedRunIdx]);

  const activeRunLoad = activeRun?.monitoringData?.matcherLoadAvg ?? null;
  const activeRunTune = activeRun?.monitoringData?.matcherTuneAvg ?? null;

  // Initialize testLoad and testTune to the active run's monitored Load & Tune if available
  const [testLoad, setTestLoad] = useState<number>(() => {
    if (activeRunLoad !== null && !isNaN(activeRunLoad)) return activeRunLoad;
    return 62.73;
  });
  const [testTune, setTestTune] = useState<number>(() => {
    if (activeRunTune !== null && !isNaN(activeRunTune)) return activeRunTune;
    return 50.71;
  });
  const [loadFilter, setLoadFilter] = useState<number>(() => {
    if (activeRunLoad !== null && !isNaN(activeRunLoad)) return Math.round(activeRunLoad);
    return 62;
  });

  // Automatically sync when activeRun or its monitored Load/Tune changes
  useEffect(() => {
    if (activeRunLoad !== null && activeRunTune !== null) {
      setTestLoad(activeRunLoad);
      setTestTune(activeRunTune);
      setLoadFilter(Math.round(activeRunLoad));
    }
  }, [activeRun?.resultId, activeRunLoad, activeRunTune]);

  const isSyncedWithActiveRun =
    activeRunLoad !== null &&
    activeRunTune !== null &&
    Math.abs(testLoad - activeRunLoad) < 0.001 &&
    Math.abs(testTune - activeRunTune) < 0.001;

  const handleResetToActiveRun = () => {
    if (activeRunLoad !== null && activeRunTune !== null) {
      setTestLoad(activeRunLoad);
      setTestTune(activeRunTune);
      setLoadFilter(Math.round(activeRunLoad));
    }
  };

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef<number>(0);

  // Drag and drop event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (onUploadCtclFile) {
        onUploadCtclFile(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (onUploadCtclFile) {
        onUploadCtclFile(e.target.files[0]);
      }
      e.target.value = '';
    }
  };

  // If CTCL Matrix is NOT loaded yet, render dedicated Drag & Drop onboarding card
  if (!ctclMatrix) {
    return (
      <div
        className="w-full max-w-4xl mx-auto py-8 space-y-6"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Hero Dropzone Card */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative p-10 md:p-14 text-center rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer shadow-xs ${
            isDragging
              ? 'bg-blue-50/90 border-[#2563EB] scale-[1.01] ring-4 ring-[#2563EB]/20'
              : 'bg-white hover:bg-slate-50/80 border-[#CBD5E1] hover:border-[#2563EB]'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-transform ${
              isDragging
                ? 'bg-[#2563EB] text-white scale-110 animate-bounce'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
            }`}
          >
            {isDragging ? (
              <Upload className="w-8 h-8 stroke-[2.5]" />
            ) : (
              <FileSpreadsheet className="w-8 h-8 stroke-[2.2]" />
            )}
          </div>

          <h2 className="text-xl font-bold text-[#0F172A] mb-2 tracking-tight">
            {isDragging ? 'CTCL Matrix 엑셀 파일을 놓으세요!' : 'Matcher CTCL Matrix 엑셀 파일 등록'}
          </h2>
          <p className="text-xs md:text-sm text-[#64748B] max-w-lg mx-auto mb-6 leading-relaxed">
            엑셀 파일(<span className="font-semibold text-[#0F172A]">.xlsx, .xlsm</span>)을 이곳으로{' '}
            <strong className="text-[#2563EB]">드래그 앤 드롭</strong>하거나 클릭하여 등록하세요.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>CTCL 엑셀 파일 선택하기</span>
            </button>

            {onLoadSampleCtcl && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onLoadSampleCtcl();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#0F172A] border border-slate-300 text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="기본 보정된 101x101 샘플 CTCL Matrix를 즉시 로드합니다"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>샘플 CTCL Matrix 불러오기</span>
              </button>
            )}
          </div>
        </div>

        {/* CTCL Format Guide Card */}
        <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#E2E8F0]">
            <HelpCircle className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#0F172A]">CTCL Matrix 엑셀 파일 구조 안내</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
              <span className="font-bold text-[#2563EB] block">① 행 & 열 구성</span>
              <p className="text-[#64748B] leading-relaxed">
                A열에 Matcher Load (0~100), 1행에 Matcher Tune (0~100) 정수 격자(101×101)가 구성되어 있어야 합니다.
              </p>
            </div>
            <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
              <span className="font-bold text-[#2563EB] block">② 복소 임피던스(R+Xi) 셀</span>
              <p className="text-[#64748B] leading-relaxed">
                격자 교차 셀에 <code className="font-mono text-[#0F172A] font-bold">0.34+5.21i</code>, <code className="font-mono text-[#0F172A] font-bold">2.77-17.07i</code> 형태의 복소수가 입력되어야 합니다.
              </p>
            </div>
            <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
              <span className="font-bold text-[#2563EB] block">③ 2차원 선형 보간</span>
              <p className="text-[#64748B] leading-relaxed">
                실제 Log의 소수점 Load/Tune 센서값을 기반으로 인접 4개 좌표로부터 2차원 Bilinear 보간을 수행합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // When CTCL Matrix is loaded, provide full interactive simulator + raw grid viewer
  const interpolated = interpolateCTCL(ctclMatrix, testLoad, testTune);

  const floorL = Math.floor(testLoad);
  const ceilL = Math.ceil(testLoad);
  const floorT = Math.floor(testTune);
  const ceilT = Math.ceil(testTune);

  const p00 = ctclMatrix.grid[floorL]?.[floorT];
  const p10 = ctclMatrix.grid[ceilL]?.[floorT];
  const p01 = ctclMatrix.grid[floorL]?.[ceilT];
  const p11 = ctclMatrix.grid[ceilL]?.[ceilT];

  const visibleLoads = ctclMatrix.loads.filter(l => Math.abs(l - loadFilter) <= 5);
  const visibleTunes = ctclMatrix.tunes.filter(t => Math.abs(t - Math.round(testTune)) <= 6);

  return (
    <div
      className="space-y-3 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Drag & Drop Overlay Feedback */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#2563EB]/15 backdrop-blur-xs flex items-center justify-center p-6 pointer-events-none">
          <div className="bg-white border-2 border-[#2563EB] rounded-2xl p-8 max-w-md w-full text-center shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mx-auto text-[#2563EB]">
              <Upload className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">
              새로운 CTCL Matrix 엑셀 파일 놓기
            </h3>
            <p className="text-xs text-[#64748B]">
              파일을 놓으면 현재 CTCL Matrix가 즉시 교체 및 재분석됩니다. (.xlsx, .xlsm)
            </p>
          </div>
        </div>
      )}

      {/* Side-by-Side:
          Left = Compact Bilinear Simulator with integrated File info & replacement (~240px)
          Right = CTCL Matrix Raw Grid Viewer (Stretched to match left panel height)
      */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch">
        {/* Left Column: Ultra-compressed Simulator Panel */}
        <div className="w-full lg:w-[240px] xl:w-[248px] shrink-0 bg-white border border-slate-300 rounded-xl p-2 shadow-xs space-y-1.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            {/* 1. Simulator Header */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Calculator className="w-3 h-3 stroke-[2.2]" />
                </div>
                <h3 className="text-[11.5px] font-bold text-slate-900 leading-none">2차원 선형 보간기</h3>
              </div>
              <span className="text-[8.5px] text-slate-500 font-mono bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                Bilinear
              </span>
            </div>

            {/* 2. CTCL File Info & File Replace Action (Inside Simulator) */}
            <div className="bg-[#F8FAFC] border border-slate-300 rounded-lg p-1.5 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span
                    className="text-[10px] font-bold text-slate-900 truncate max-w-[130px]"
                    title={ctclMatrix.fileName}
                  >
                    {ctclMatrix.fileName}
                  </span>
                </div>
                <span className="px-1 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[8.5px] font-bold shrink-0">
                  연결됨
                </span>
              </div>

              <div className="text-[9.5px] text-slate-500">
                {ctclMatrix.availableSheets.length > 1 && onSelectCtclSheet ? (
                  <div className="flex items-center gap-1">
                    <span className="shrink-0 text-slate-600 font-medium text-[9px]">시트:</span>
                    <select
                      value={ctclMatrix.sheetName}
                      onChange={e => onSelectCtclSheet(e.target.value)}
                      className="flex-1 min-w-0 bg-white border border-slate-300 rounded px-1 py-0.2 text-slate-800 font-bold text-[9.5px] focus:outline-none cursor-pointer truncate"
                    >
                      {ctclMatrix.availableSheets.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-600 truncate">시트: <strong className="text-slate-800">{ctclMatrix.sheetName}</strong></span>
                    <span className="font-mono text-slate-400 shrink-0">({ctclMatrix.loads.length}×{ctclMatrix.tunes.length})</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1 py-1 px-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-300 hover:border-blue-400 rounded text-[9.5px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="다른 CTCL Matrix 엑셀 파일로 교체 또는 화면으로 드래그 앤 드롭"
              >
                <Upload className="w-2.5 h-2.5" />
                <span>파일 교체 (드래그 가능)</span>
              </button>
            </div>

            {/* 3. 공정 Run 실제값 실시간 연동 */}
            {results && results.length > 0 && (
              <div className="bg-[#F1F5F9] border border-slate-300 rounded-lg p-1.5 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 text-[9.5px] font-bold text-slate-800">
                    <Link2 className="w-2.5 h-2.5 text-blue-600" />
                    <span>공정 Run 연동</span>
                  </div>
                  {onNavigateToIntegrated && (
                    <button
                      type="button"
                      onClick={onNavigateToIntegrated}
                      className="flex items-center gap-0.5 text-[8.5px] font-semibold text-blue-600 hover:underline cursor-pointer"
                      title="공정 종합 분석 표로 바로 이동"
                    >
                      <span>종합표</span>
                      <ArrowRight className="w-2 h-2" />
                    </button>
                  )}
                </div>

                {/* Run Selector */}
                <select
                  value={
                    activeRun
                      ? results.findIndex(r => r === activeRun || r.resultId === activeRun.resultId)
                      : 0
                  }
                  onChange={e => {
                    const idx = parseInt(e.target.value, 10);
                    onSelectRunIdx?.(idx);
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 font-bold text-slate-900 focus:outline-none cursor-pointer text-[9.5px] truncate shadow-2xs"
                >
                  {results.map((r, idx) => {
                    const m = r.monitoringData;
                    return (
                      <option key={r.resultId || idx} value={idx}>
                        #{m.no} {m.rcpName} (L:{m.matcherLoadAvg !== null ? m.matcherLoadAvg.toFixed(1) : '-'}%, T:{m.matcherTuneAvg !== null ? m.matcherTuneAvg.toFixed(1) : '-'}%)
                      </option>
                    );
                  })}
                </select>

                {/* Sync Status Badge / Reset Button */}
                {activeRunLoad !== null && activeRunTune !== null && (
                  <div>
                    {isSyncedWithActiveRun ? (
                      <div className="flex items-center justify-center gap-1 w-full px-1 py-0.5 rounded bg-emerald-100/90 border border-emerald-300 text-emerald-800 text-[8.5px] font-bold">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Run 실제값 일치 ({activeRunLoad.toFixed(1)}%, {activeRunTune.toFixed(1)}%)</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResetToActiveRun}
                        className="w-full flex items-center justify-center gap-1 px-1 py-0.5 rounded bg-white border border-blue-400 text-blue-600 hover:bg-blue-50 text-[8.5px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                        title={`현재 Run 실제값 (Load: ${activeRunLoad.toFixed(2)}%, Tune: ${activeRunTune.toFixed(2)}%)으로 동기화`}
                      >
                        <RotateCcw className="w-2.5 h-2.5 text-blue-600" />
                        <span>Run 실제값 동기화 ({activeRunLoad.toFixed(1)}%, {activeRunTune.toFixed(1)}%)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Controls (Sliders + Direct Numeric Inputs) */}
            <div className="bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-300 space-y-1.5">
              {/* Load Input */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-700 font-semibold">Load (%)</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={testLoad}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) {
                          const clamped = Math.max(0, Math.min(100, v));
                          setTestLoad(clamped);
                          setLoadFilter(Math.round(clamped));
                        }
                      }}
                      className="w-13 bg-white border border-slate-300 rounded px-1 py-0.2 text-right font-mono font-bold text-[10.5px] text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[9px] text-slate-500 font-bold">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.01"
                  value={testLoad}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setTestLoad(v);
                    setLoadFilter(Math.round(v));
                  }}
                  className="w-full h-1.5 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Tune Input */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-700 font-semibold">Tune (%)</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={testTune}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) {
                          const clamped = Math.max(0, Math.min(100, v));
                          setTestTune(clamped);
                        }
                      }}
                      className="w-13 bg-white border border-slate-300 rounded px-1 py-0.2 text-right font-mono font-bold text-[10.5px] text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[9px] text-slate-500 font-bold">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.01"
                  value={testTune}
                  onChange={e => setTestTune(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            {/* 5. 2차원 보간 복소 임피던스 계산 결과 */}
            <div className="p-1.5 bg-[#ECFDF5] border border-emerald-300 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-[9.5px] text-emerald-800 font-bold">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                <span>2차원 보간 임피던스 결과</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="bg-white/95 p-1 rounded border border-emerald-200 text-center">
                  <span className="text-[8.5px] text-slate-500 block font-medium">실수부 R</span>
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    {interpolated ? `${interpolated.r.toFixed(2)} Ω` : '-'}
                  </span>
                </div>
                <div className="bg-white/95 p-1 rounded border border-emerald-200 text-center">
                  <span className="text-[8.5px] text-slate-500 block font-medium">허수부 X</span>
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    {interpolated ? `${interpolated.x.toFixed(2)} Ω` : '-'}
                  </span>
                </div>
              </div>
              {isSyncedWithActiveRun && (
                <div className="text-[8px] text-emerald-800 bg-white/70 px-1 py-0.5 rounded border border-emerald-200 font-medium leading-tight">
                  ✓ Monitoring Data 실제 값 일치
                </div>
              )}
            </div>

            {/* 6. 보간에 사용된 인접 4개 정수 격자 좌표점 */}
            <div className="bg-[#F1F5F9] p-1.5 rounded-lg border border-slate-300 space-y-0.5">
              <h4 className="text-[9px] font-bold text-slate-700">인접 4개 정수 좌표점</h4>
              <div className="grid grid-cols-2 gap-0.5 text-[8.5px] font-mono">
                <div className="p-0.5 px-1 bg-white rounded border border-slate-300">
                  <div className="text-[7.5px] text-slate-500">P00: L{floorL}, T{floorT}</div>
                  <div className="font-bold text-slate-900 truncate">
                    {p00 ? `${p00.r}+(${p00.x})i` : '-'}
                  </div>
                </div>
                <div className="p-0.5 px-1 bg-white rounded border border-slate-300">
                  <div className="text-[7.5px] text-slate-500">P01: L{floorL}, T{ceilT}</div>
                  <div className="font-bold text-slate-900 truncate">
                    {p01 ? `${p01.r}+(${p01.x})i` : '-'}
                  </div>
                </div>
                <div className="p-0.5 px-1 bg-white rounded border border-slate-300">
                  <div className="text-[7.5px] text-slate-500">P10: L{ceilL}, T{floorT}</div>
                  <div className="font-bold text-slate-900 truncate">
                    {p10 ? `${p10.r}+(${p10.x})i` : '-'}
                  </div>
                </div>
                <div className="p-0.5 px-1 bg-white rounded border border-slate-300">
                  <div className="text-[7.5px] text-slate-500">P11: L{ceilL}, T{ceilT}</div>
                  <div className="font-bold text-slate-900 truncate">
                    {p11 ? `${p11.r}+(${p11.x})i` : '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: CTCL Matrix Raw Grid Viewer (Height matching Left Column) */}
        <div className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs flex flex-col">
          {/* Grid Viewer Header */}
          <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-300 flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-xs font-bold text-[#0F172A]">
                CTCL Matrix 원본 격자 뷰어 (Load {loadFilter - 5} ~ {loadFilter + 5}%, Tune {Math.round(testTune) - 6} ~ {Math.round(testTune) + 6}%)
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setLoadFilter(Math.round(testLoad))}
                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-300 rounded text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer"
                title={`현재 Matcher Load(${testLoad.toFixed(1)}%) 기준으로 격자 중심 이동`}
              >
                <Target className="w-3 h-3 text-blue-600" />
                <span>현재 Load({Math.round(testLoad)}%) 중심</span>
              </button>

              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5">
                <span className="text-[#64748B] font-medium text-[11px]">중심 Load:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={loadFilter}
                  onChange={e => setLoadFilter(parseInt(e.target.value, 10) || 0)}
                  className="w-12 text-[#0F172A] text-xs font-mono font-bold text-center focus:outline-none"
                />
              </div>

              <span className="text-[10.5px] font-mono text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded border border-slate-300">
                전체 {ctclMatrix.loads.length}×{ctclMatrix.tunes.length}
              </span>
            </div>
          </div>

          {/* Grid Table: Expands to fill container vertically and horizontally, with crisp legible typography */}
          <div className="flex-1 min-h-0 overflow-auto scrollbar-thin flex flex-col p-0.5">
            <table className="w-full h-full table-fixed text-center border-collapse font-mono select-text min-w-[780px]">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-20 border-b border-slate-300 shadow-2xs">
                <tr className="h-9">
                  <th className="w-20 px-2 py-2 border-r border-b border-slate-300 bg-slate-200 text-slate-900 font-bold text-[12px] sticky left-0 z-30 shadow-xs align-middle">
                    Load \ Tune
                  </th>
                  {visibleTunes.map(t => (
                    <th
                      key={t}
                      className={`px-1 py-2 border-r border-b border-slate-300 text-[12px] align-middle ${
                        t === floorT || t === ceilT
                          ? 'bg-blue-100 text-blue-900 font-extrabold ring-1 ring-blue-400/50'
                          : 'text-slate-700 font-bold'
                      }`}
                    >
                      {t}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {visibleLoads.map(l => (
                  <tr key={l} className="hover:bg-blue-50/40 transition-colors">
                    <td
                      className={`w-20 px-2 py-2 font-bold border-r border-slate-300 sticky left-0 z-10 align-middle text-[12px] ${
                        l === floorL || l === ceilL
                          ? 'bg-blue-100 text-blue-900 font-extrabold ring-1 ring-blue-400/50'
                          : 'bg-slate-100/90 text-slate-800'
                      }`}
                    >
                      {l}%
                    </td>
                    {visibleTunes.map(t => {
                      const pt = ctclMatrix.grid[l]?.[t];
                      const isFocus = (l === floorL || l === ceilL) && (t === floorT || t === ceilT);
                      return (
                        <td
                          key={t}
                          className={`px-1 py-2 border-r border-slate-200 align-middle transition-all ${
                            isFocus
                              ? 'bg-blue-100 font-extrabold text-blue-950 text-[12.5px] ring-2 ring-blue-500 ring-inset shadow-xs'
                              : 'text-[12px] hover:bg-slate-100/80'
                          }`}
                        >
                          {pt ? (
                            <span className="tabular-nums tracking-tight">
                              <span className="font-semibold text-slate-900">{pt.r}</span>
                              <span className={pt.x >= 0 ? 'text-blue-700 font-medium' : 'text-rose-700 font-medium'}>
                                {pt.x >= 0 ? '+' : ''}
                                {pt.x}i
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
