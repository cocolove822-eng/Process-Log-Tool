import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Upload,
  Sparkles,
  Link2,
  RotateCcw,
  ArrowRight,
  Target,
} from 'lucide-react';
import { CTCLMatrixData, AnalysisFileResult } from '../types/pecvd';
import { interpolateCTCL } from '../utils/ctclParser';
import { useTheme } from '../context/ThemeContext';
import {
  TABLE_TD_DATA_CLASS,
  TINT_FIXED_TH1,
  TINT_FIXED_TH2,
  TINT_RF_TH1,
  TINT_RF_TH2,
  TINT_UNIT_TH,
} from './IntegratedDashboard';

/** 공정 종합 분석 탭과 같은 엑셀 그리드 데이터 셀 */
const CELL = TABLE_TD_DATA_CLASS;

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
  const { theme } = useTheme();
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
        <section className={`${theme.cardBg} ${theme.cardRadius} overflow-hidden ${theme.cardShadow}`}>
          <div className={`px-3 py-1.5 ${theme.cardHeaderBg} border-b ${theme.cardHeaderBorder} flex items-center gap-2`}>
            <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs shrink-0" />
            <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor}`}>CTCL Matrix 엑셀 파일 구조 안내</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs p-3">
            <div className="bg-white p-3 rounded-xl border border-slate-300 space-y-1">
              <span className="font-bold text-[#2563EB] block">① 행 & 열 구성</span>
              <p className="text-[#64748B] leading-relaxed">
                A열에 Matcher Load (0~100), 1행에 Matcher Tune (0~100) 정수 격자(101×101)가 구성되어 있어야 합니다.
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-300 space-y-1">
              <span className="font-bold text-[#2563EB] block">② 복소 임피던스(R+Xi) 셀</span>
              <p className="text-[#64748B] leading-relaxed">
                격자 교차 셀에 <code className="font-mono text-[#0F172A] font-bold">0.34+5.21i</code>, <code className="font-mono text-[#0F172A] font-bold">2.77-17.07i</code> 형태의 복소수가 입력되어야 합니다.
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-300 space-y-1">
              <span className="font-bold text-[#2563EB] block">③ 2차원 선형 보간</span>
              <p className="text-[#64748B] leading-relaxed">
                실제 Log의 소수점 Load/Tune 센서값을 기반으로 인접 4개 좌표로부터 2차원 Bilinear 보간을 수행합니다.
              </p>
            </div>
          </div>
        </section>
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
  const visibleTunes = ctclMatrix.tunes.filter(t => Math.abs(t - Math.round(testTune)) <= 5);

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

      {/* 좌: 2차원 선형 보간기 / 우: CTCL Matrix 원본 격자 뷰어 */}
      <div className="flex flex-col lg:flex-row gap-2 items-stretch">
        {/* ① [Bilinear] 2차원 선형 보간기 */}
        <section
          className={`w-full lg:w-[300px] shrink-0 ${theme.cardBg} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} flex flex-col`}
        >
          <div
            className={`px-3 py-1.5 ${theme.cardHeaderBg} border-b ${theme.cardHeaderBorder} flex items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs shrink-0" />
              <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>
                [Bilinear] 2차원 선형 보간기
              </h3>
            </div>
          </div>

          <div className="p-2 space-y-2 text-[11px]">
            {/* 파일 정보 */}
            <table className="w-full border-collapse table-fixed">
              <tbody>
                <tr>
                  <th className={`${TINT_FIXED_TH2} w-[64px] text-center`}>파일</th>
                  <td className={`${CELL} text-left px-1.5 bg-white`}>
                    <div className="flex items-center gap-1 min-w-0">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate" title={ctclMatrix.fileName}>
                        {ctclMatrix.fileName}
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th className={`${TINT_FIXED_TH2} text-center`}>시트</th>
                  <td className={`${CELL} text-left px-1 bg-white`}>
                    {ctclMatrix.availableSheets.length > 1 && onSelectCtclSheet ? (
                      <select
                        id="ctcl-sheet"
                        value={ctclMatrix.sheetName}
                        onChange={e => onSelectCtclSheet(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 font-bold text-[11px] focus:outline-none focus:border-[#2563EB] cursor-pointer truncate"
                      >
                        {ctclMatrix.availableSheets.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="block truncate px-0.5" title={ctclMatrix.sheetName}>
                        {ctclMatrix.sheetName}
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th className={`${TINT_FIXED_TH2} text-center`}>격자</th>
                  <td className={`${CELL} text-left px-1.5 bg-white`}>
                    {ctclMatrix.loads.length} × {ctclMatrix.tunes.length} (Load × Tune)
                  </td>
                </tr>
              </tbody>
            </table>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 cursor-pointer ${theme.btnSecondary}`}
              title="다른 CTCL Matrix 엑셀 파일로 교체합니다. 화면에 파일을 끌어다 놓아도 됩니다."
            >
              <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>파일 교체</span>
            </button>

            {/* 공정 Run 연동 */}
            {results && results.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-[#0F172A]">
                    <Link2 className="w-3 h-3 text-[#2563EB]" />
                    공정 Run 연동
                  </span>
                  {onNavigateToIntegrated && (
                    <button
                      type="button"
                      onClick={onNavigateToIntegrated}
                      className="flex items-center gap-0.5 text-[10.5px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                      title="공정 종합 분석 탭으로 이동"
                    >
                      종합 분석
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <select
                  id="ctcl-run"
                  value={
                    activeRun
                      ? results.findIndex(r => r === activeRun || r.resultId === activeRun.resultId)
                      : 0
                  }
                  onChange={e => onSelectRunIdx?.(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-slate-400 rounded-lg px-1.5 py-1 font-bold text-[11px] text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer truncate"
                >
                  {results.map((r, idx) => {
                    const m = r.monitoringData;
                    return (
                      <option key={r.resultId || idx} value={idx}>
                        #{m.no} {m.rcpName} (L {m.matcherLoadAvg !== null ? m.matcherLoadAvg.toFixed(1) : '-'}%, T{' '}
                        {m.matcherTuneAvg !== null ? m.matcherTuneAvg.toFixed(1) : '-'}%)
                      </option>
                    );
                  })}
                </select>
                {activeRunLoad !== null && activeRunTune !== null && (
                  isSyncedWithActiveRun ? (
                    <div className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg text-[10.5px] font-semibold ${theme.badgeOk}`}>
                      <CheckCircle2 className="w-3 h-3" />
                      Run 실제값 적용됨 (L {activeRunLoad.toFixed(1)}%, T {activeRunTune.toFixed(1)}%)
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetToActiveRun}
                      className={`w-full flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg text-[10.5px] font-semibold transition-all active:scale-95 cursor-pointer ${theme.btnSecondary}`}
                      title={`선택한 Run의 실제값(Load ${activeRunLoad.toFixed(2)}%, Tune ${activeRunTune.toFixed(2)}%)으로 되돌립니다`}
                    >
                      <RotateCcw className="w-3 h-3 text-[#2563EB]" />
                      Run 실제값으로 되돌리기 (L {activeRunLoad.toFixed(1)}%, T {activeRunTune.toFixed(1)}%)
                    </button>
                  )
                )}
              </div>
            )}

            {/* Load / Tune 입력 */}
            <div className="space-y-1.5 border-t border-slate-300 pt-2">
              {(
                [
                  { id: 'ctcl-load', label: 'Load', value: testLoad, set: (v: number) => { setTestLoad(v); setLoadFilter(Math.round(v)); } },
                  { id: 'ctcl-tune', label: 'Tune', value: testTune, set: (v: number) => setTestTune(v) },
                ] as const
              ).map(ctl => (
                <div key={ctl.id} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={ctl.id} className="font-bold text-[#0F172A]">
                      Matcher {ctl.label}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id={ctl.id}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={ctl.value}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) ctl.set(Math.max(0, Math.min(100, v)));
                        }}
                        className="w-16 bg-white border border-slate-400 rounded px-1 py-0.5 text-right font-bold tabular-nums text-[11px] text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                      />
                      <span className="text-[10px] font-semibold text-[#475569]">%</span>
                    </div>
                  </div>
                  <input
                    aria-label={`Matcher ${ctl.label} 슬라이더`}
                    type="range"
                    min="0"
                    max="100"
                    step="0.01"
                    value={ctl.value}
                    onChange={e => ctl.set(parseFloat(e.target.value))}
                    className="w-full h-1.5 accent-[#2563EB] cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* 보간 결과 */}
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr>
                  <th colSpan={2} className={`${TINT_RF_TH1} text-center`}>
                    보간 임피던스 (L {testLoad.toFixed(2)}%, T {testTune.toFixed(2)}%)
                  </th>
                </tr>
                <tr>
                  <th className={`${TINT_RF_TH2} text-center`}>R</th>
                  <th className={`${TINT_RF_TH2} text-center`}>X</th>
                </tr>
                <tr>
                  <th className={`${TINT_UNIT_TH} text-center`}>(Ω)</th>
                  <th className={`${TINT_UNIT_TH} text-center`}>(Ω)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className={`${CELL} text-[13px] py-1.5`}>{interpolated ? interpolated.r.toFixed(2) : '-'}</td>
                  <td className={`${CELL} text-[13px] py-1.5`}>{interpolated ? interpolated.x.toFixed(2) : '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* 인접 4개 격자점 */}
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr>
                  <th colSpan={4} className={`${TINT_FIXED_TH1} text-center`}>
                    보간에 쓰인 인접 격자점
                  </th>
                </tr>
                <tr>
                  <th className={`${TINT_FIXED_TH2} text-center`}>Load</th>
                  <th className={`${TINT_FIXED_TH2} text-center`}>Tune</th>
                  <th className={`${TINT_FIXED_TH2} text-center`}>R</th>
                  <th className={`${TINT_FIXED_TH2} text-center`}>X</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    [floorL, floorT, p00],
                    [floorL, ceilT, p01],
                    [ceilL, floorT, p10],
                    [ceilL, ceilT, p11],
                  ] as const
                ).map(([l, t, p], i) => (
                  <tr key={i} className={i % 2 ? theme.tableRowAltBg : theme.tableRowBg}>
                    <td className={CELL}>{l}%</td>
                    <td className={CELL}>{t}%</td>
                    <td className={CELL}>{p ? p.r : '-'}</td>
                    <td className={CELL}>{p ? p.x : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ② [CTCL Matrix] 원본 격자 뷰어 */}
        <section
          className={`flex-1 min-w-0 ${theme.cardBg} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} flex flex-col`}
        >
          <div
            className={`px-3 py-1.5 ${theme.cardHeaderBg} border-b ${theme.cardHeaderBorder} flex flex-wrap items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs shrink-0" />
              <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>
                [CTCL Matrix] 원본 격자 뷰어
              </h3>
              <span className="h-4 w-px bg-slate-300 mx-0.5 hidden sm:inline-block" />
              <span className={`text-[11px] font-semibold ${theme.cardSubtitleColor} whitespace-nowrap`}>
                Load {visibleLoads[0] ?? '-'}~{visibleLoads[visibleLoads.length - 1] ?? '-'}% · Tune{' '}
                {visibleTunes[0] ?? '-'}~{visibleTunes[visibleTunes.length - 1] ?? '-'}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setLoadFilter(Math.round(testLoad))}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-semibold transition-all active:scale-95 cursor-pointer ${theme.btnSecondary}`}
                title={`보간기의 Load(${testLoad.toFixed(1)}%)를 격자 중심으로 맞춥니다`}
              >
                <Target className="w-3 h-3 text-[#2563EB]" />
                현재 Load({Math.round(testLoad)}%) 중심
              </button>
              <label className="flex items-center gap-1 bg-white border border-slate-400 rounded-lg px-1.5 py-0.5">
                <span className="text-[#475569] font-semibold">중심 Load</span>
                <input
                  id="ctcl-center-load"
                  type="number"
                  min="0"
                  max="100"
                  value={loadFilter}
                  onChange={e => setLoadFilter(parseInt(e.target.value, 10) || 0)}
                  className="w-10 text-[#0F172A] font-bold tabular-nums text-center focus:outline-none"
                />
                <span className="text-[#475569]">%</span>
              </label>
              <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-[#334155] border border-slate-400 font-semibold tabular-nums">
                전체 {ctclMatrix.loads.length}×{ctclMatrix.tunes.length}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto scrollbar-thin bg-white">
            <table className="w-full h-full border-collapse table-fixed select-text min-w-[900px]">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th rowSpan={2} className={`${TINT_FIXED_TH1} w-[76px] text-center sticky left-0 z-30`}>
                    Load \ Tune
                  </th>
                  <th colSpan={visibleTunes.length} className={`${TINT_RF_TH1} text-center`}>
                    Matcher Tune (%) — 셀 값: R + jX (Ω)
                  </th>
                </tr>
                <tr>
                  {visibleTunes.map(t => (
                    <th
                      key={t}
                      className={`${TINT_RF_TH2} text-center tabular-nums ${
                        t === floorT || t === ceilT ? '!bg-[#BFDBFE] !text-[#1E3A8A]' : ''
                      }`}
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleLoads.map((l, ri) => {
                  const loadFocus = l === floorL || l === ceilL;
                  return (
                    <tr key={l} className={`${ri % 2 ? theme.tableRowAltBg : theme.tableRowBg} ${theme.tableRowHover}`}>
                      <td
                        className={`${TINT_FIXED_TH2} text-center tabular-nums sticky left-0 z-10 ${
                          loadFocus ? '!bg-[#BFDBFE] !text-[#1E3A8A]' : ''
                        }`}
                      >
                        {l}%
                      </td>
                      {visibleTunes.map(t => {
                        const pt = ctclMatrix.grid[l]?.[t];
                        const isFocus = loadFocus && (t === floorT || t === ceilT);
                        return (
                          <td
                            key={t}
                            className={`${CELL} !px-1.5 py-1.5 ${isFocus ? 'bg-[#DBEAFE] ring-2 ring-inset ring-[#2563EB]' : ''}`}
                          >
                            {pt ? (
                              <span className="inline-flex items-baseline justify-center gap-[3px] font-semibold">
                                <span>{pt.r}</span>
                                <span className={pt.x >= 0 ? 'text-[#1D4ED8]' : 'text-[#BE123C]'}>
                                  {pt.x >= 0 ? '+' : '−'}
                                  {Math.abs(pt.x)}i
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
