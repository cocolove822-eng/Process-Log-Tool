import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileSpreadsheet, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { AnalysisFileResult, CTCLMatrixData } from '../types/pecvd';
import { interpolateCTCL } from '../utils/ctclParser';
import { useTheme } from '../context/ThemeContext';
import { TABLE_TD_DATA_CLASS, TINT_FIXED_TH1, TINT_FIXED_TH2, TINT_RF_TH1, TINT_RF_TH2 } from './IntegratedDashboard';

/**
 * CTCL Matrix 간략 패널 (원본 로그 탭 맨 위, 접고 펴기)
 * - 접힘: 파일 · 선택 Run의 Load/Tune · 보간 R/X 한 줄 요약
 * - 펼침: Load/Tune 입력 + 보간 결과 + 주변 격자(Load ±3 × Tune ±4, 보간에 쓰인 4점 강조)
 * - 미등록: 파일 등록 · 샘플 불러오기 (패널에 끌어다 놓기 가능)
 */
interface CtclPanelProps {
  ctclMatrix: CTCLMatrixData | null;
  results?: AnalysisFileResult[];
  selectedRunIdx?: number | null;
  onSelectRunIdx?: (idx: number | null) => void;
  onUploadCtclFile?: (file: File) => void;
  onSelectCtclSheet?: (sheetName: string) => void;
  onLoadSampleCtcl?: () => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}

const CELL = TABLE_TD_DATA_CLASS;

export const CtclPanel: React.FC<CtclPanelProps> = ({
  ctclMatrix,
  results = [],
  selectedRunIdx = null,
  onSelectRunIdx,
  onUploadCtclFile,
  onSelectCtclSheet,
  onLoadSampleCtcl,
  open,
  onToggle,
}) => {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const runIdx = results.length === 0 ? -1 : selectedRunIdx !== null && results[selectedRunIdx] ? selectedRunIdx : 0;
  const activeRun = runIdx >= 0 ? results[runIdx] : null;
  const runLoad = activeRun?.monitoringData?.matcherLoadAvg ?? null;
  const runTune = activeRun?.monitoringData?.matcherTuneAvg ?? null;

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const [testLoad, setTestLoad] = useState<number>(runLoad !== null ? r2(runLoad) : 50);
  const [testTune, setTestTune] = useState<number>(runTune !== null ? r2(runTune) : 50);
  // 선택 Run이 바뀌면 그 Run의 실제 평균 Load/Tune(소수 둘째 자리)으로 맞춤
  useEffect(() => {
    if (runLoad !== null && runTune !== null) {
      setTestLoad(r2(runLoad));
      setTestTune(r2(runTune));
    }
  }, [activeRun?.resultId, runLoad, runTune]);
  const synced = runLoad !== null && runTune !== null && testLoad === r2(runLoad) && testTune === r2(runTune);

  const interp = useMemo(() => (ctclMatrix ? interpolateCTCL(ctclMatrix, testLoad, testTune) : null), [ctclMatrix, testLoad, testTune]);

  const pickFile = () => fileInputRef.current?.click();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && onUploadCtclFile) onUploadCtclFile(f);
  };

  const fmt2 = (v: number | null | undefined) => (v === null || v === undefined || isNaN(v) ? '-' : v.toFixed(2));
  const floorL = Math.floor(testLoad);
  const ceilL = Math.ceil(testLoad);
  const floorT = Math.floor(testTune);
  const ceilT = Math.ceil(testTune);
  const visibleLoads = ctclMatrix ? ctclMatrix.loads.filter(l => l >= floorL - 3 && l <= ceilL + 3) : [];
  const visibleTunes = ctclMatrix ? ctclMatrix.tunes.filter(t => t >= floorT - 4 && t <= ceilT + 4) : [];

  return (
    <section
      className={`${theme.cardBg} ${theme.cardRadius} overflow-hidden ${theme.cardShadow} ${isDragging ? 'ring-2 ring-[#2563EB]' : ''}`}
      onDragOver={e => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && onUploadCtclFile) onUploadCtclFile(f);
          e.target.value = '';
        }}
      />

      {/* 머리줄: 누르면 접기/펴기 */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(!open);
          }
        }}
        className={`px-3 py-1.5 ${theme.cardHeaderBg} ${open ? `border-b ${theme.cardHeaderBorder}` : ''} flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer select-none`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#3182F6] shadow-xs shrink-0" />
          <h3 className={`text-[13px] font-bold tracking-tight ${theme.cardTitleColor} whitespace-nowrap`}>[CTCL Matrix] Matcher 임피던스</h3>
        </div>

        {ctclMatrix ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] min-w-0">
            <span className="flex items-center gap-1 text-[#475569] min-w-0">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[220px]" title={`${ctclMatrix.fileName} · ${ctclMatrix.sheetName}`}>
                {ctclMatrix.fileName}
              </span>
              <span className="text-[#94A3B8]">· {ctclMatrix.loads.length}×{ctclMatrix.tunes.length}</span>
            </span>
            <span className="h-3.5 w-px bg-slate-300" />
            <span className="font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
              L {testLoad.toFixed(1)}% · T {testTune.toFixed(1)}%
            </span>
            <span className="font-bold text-[#1E3A8A] tabular-nums whitespace-nowrap">
              R {fmt2(interp?.r)} Ω · X {fmt2(interp?.x)} Ω
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px]" onClick={e => e.stopPropagation()}>
            <span className="text-[#64748B]">미등록 · 엑셀(.xlsx, .xlsm)을 이 줄에 끌어다 놓아도 됩니다</span>
            <button
              type="button"
              onClick={pickFile}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              파일 등록
            </button>
            {onLoadSampleCtcl && (
              <button
                type="button"
                onClick={onLoadSampleCtcl}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold cursor-pointer ${theme.btnSecondary}`}
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                샘플
              </button>
            )}
          </div>
        )}

        {ctclMatrix && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] shrink-0">
            {open ? '접기' : '펼치기'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        )}
      </div>

      {/* 펼친 내용 */}
      {ctclMatrix && open && (
        <div className="p-2 flex flex-col lg:flex-row gap-2 items-start text-[11px]">
          {/* 왼쪽: 설정 + 결과 */}
          <div className="w-full lg:w-[250px] shrink-0 space-y-1.5">
            <div className="flex items-center gap-1">
              {ctclMatrix.availableSheets.length > 1 && onSelectCtclSheet ? (
                <select
                  aria-label="CTCL 시트"
                  value={ctclMatrix.sheetName}
                  onChange={e => onSelectCtclSheet(e.target.value)}
                  className="flex-1 min-w-0 bg-white border border-slate-300 rounded px-1 py-0.5 font-bold focus:outline-none focus:border-[#2563EB] cursor-pointer"
                >
                  {ctclMatrix.availableSheets.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 min-w-0 truncate font-semibold text-[#334155]" title={ctclMatrix.sheetName}>
                  시트: {ctclMatrix.sheetName}
                </span>
              )}
              <button
                type="button"
                onClick={pickFile}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold cursor-pointer shrink-0 ${theme.btnSecondary}`}
                title="다른 CTCL Matrix 엑셀로 교체 (패널에 끌어다 놓아도 됩니다)"
              >
                <Upload className="w-3 h-3 text-[#2563EB]" />
                파일 교체
              </button>
            </div>

            {results.length > 0 && (
              <select
                aria-label="공정 Run 선택"
                value={runIdx}
                onChange={e => onSelectRunIdx?.(parseInt(e.target.value, 10))}
                className="w-full bg-white border border-slate-400 rounded-lg px-1.5 py-0.5 font-bold text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer truncate"
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
            )}

            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'ctcl-load', label: 'Load', value: testLoad, set: setTestLoad },
                  { id: 'ctcl-tune', label: 'Tune', value: testTune, set: setTestTune },
                ] as const
              ).map(c => (
                <label key={c.id} className="flex-1 flex items-center gap-1 bg-white border border-slate-400 rounded-lg px-1.5 py-0.5">
                  <span className="font-bold text-[#475569]">{c.label}</span>
                  <input
                    id={c.id}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={c.value}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) c.set(Math.max(0, Math.min(100, v)));
                    }}
                    className="w-full min-w-0 text-right font-bold tabular-nums text-[#0F172A] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-[#475569]">%</span>
                </label>
              ))}
            </div>

            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr>
                  <th className={`${TINT_RF_TH2} text-center`}>R (Ω)</th>
                  <th className={`${TINT_RF_TH2} text-center`}>X (Ω)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className={`${CELL} text-[13px] py-1`}>{fmt2(interp?.r)}</td>
                  <td className={`${CELL} text-[13px] py-1`}>{fmt2(interp?.x)}</td>
                </tr>
              </tbody>
            </table>

            {runLoad !== null && runTune !== null && !synced && (
              <button
                type="button"
                onClick={() => {
                  setTestLoad(r2(runLoad));
                  setTestTune(r2(runTune));
                }}
                className={`w-full flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg font-semibold cursor-pointer ${theme.btnSecondary}`}
              >
                <RotateCcw className="w-3 h-3 text-[#2563EB]" />
                Run 실제값으로 (L {runLoad.toFixed(1)}%, T {runTune.toFixed(1)}%)
              </button>
            )}
            <p className="text-[10px] text-[#64748B] leading-snug">
              선택한 Run의 평균 Load/Tune으로 인접 격자 4점에서 2차원 선형 보간합니다. 오른쪽 격자의 파란 칸이 보간에 쓰인 점입니다.
            </p>
          </div>

          {/* 오른쪽: 주변 격자 */}
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin border border-slate-300 rounded-lg bg-white">
            <table className="w-full border-collapse table-fixed select-text min-w-[640px]">
              <thead>
                <tr>
                  <th rowSpan={2} className={`${TINT_FIXED_TH1} w-[64px] text-center`}>
                    Load \ Tune
                  </th>
                  <th colSpan={visibleTunes.length} className={`${TINT_RF_TH1} text-center`}>
                    Matcher Tune (%) — R + jX (Ω)
                  </th>
                </tr>
                <tr>
                  {visibleTunes.map(t => (
                    <th key={t} className={`${TINT_RF_TH2} text-center tabular-nums ${t === floorT || t === ceilT ? '!bg-[#BFDBFE] !text-[#1E3A8A]' : ''}`}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleLoads.map((l, ri) => {
                  const lf = l === floorL || l === ceilL;
                  return (
                    <tr key={l} className={ri % 2 ? theme.tableRowAltBg : theme.tableRowBg}>
                      <td className={`${TINT_FIXED_TH2} text-center tabular-nums ${lf ? '!bg-[#BFDBFE] !text-[#1E3A8A]' : ''}`}>{l}%</td>
                      {visibleTunes.map(t => {
                        const pt = ctclMatrix.grid[l]?.[t];
                        const focus = lf && (t === floorT || t === ceilT);
                        return (
                          <td key={t} className={`${CELL} !px-1 py-0.5 ${focus ? 'bg-[#DBEAFE] ring-2 ring-inset ring-[#2563EB]' : ''}`}>
                            {pt ? (
                              <span className="inline-flex items-baseline justify-center gap-[2px] font-semibold text-[10.5px]">
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
        </div>
      )}
    </section>
  );
};
